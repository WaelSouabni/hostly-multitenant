"use server";

import { auth } from "@/auth";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createBooking } from "@/lib/booking";
import { calculateStay } from "@/lib/pricing";
import { db } from "@/lib/prisma";

const schema = z.object({
  tenantSlug: z.string().min(1),
  propertySlug: z.string().min(1),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  guests: z.coerce.number().int().positive(),
  clientName: z.string().trim().min(2).max(120),
  clientEmail: z.string().email(),
  clientPhone: z.string().max(40).optional(),
  clientMessage: z.string().max(2000).optional(),
  optionIds: z.array(z.string()).default([]),
  promoCode: z.string().max(60).optional(),
});

async function findProperty(tenantSlug: string, propertySlug: string) {
  return db.property.findFirst({
    where: {
      slug: propertySlug,
      tenant: { slug: tenantSlug, status: "ACTIVE" },
      isActive: true,
      isPublished: true,
    },
    include: {
      pricingRules: { where: { isActive: true } },
      tenant: {
        include: {
          settings: true,
          options: { where: { isActive: true } },
        },
      },
      blockedDates: true,
    },
  });
}

export async function getBookingQuote(
  input: Pick<
    z.input<typeof schema>,
    | "tenantSlug"
    | "propertySlug"
    | "checkIn"
    | "checkOut"
    | "guests"
    | "optionIds"
    | "promoCode"
  >,
) {
  const data = schema
    .pick({
      tenantSlug: true,
      propertySlug: true,
      checkIn: true,
      checkOut: true,
      guests: true,
      optionIds: true,
      promoCode: true,
    })
    .parse(input);

  if (data.checkOut <= data.checkIn) throw new Error("INVALID_DATES");

  const property = await findProperty(data.tenantSlug, data.propertySlug);
  if (!property) throw new Error("PROPERTY_NOT_FOUND");

  const overlap = await db.booking.findFirst({
    where: {
      propertyId: property.id,
      OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", expiresAt: { gt: new Date() } },
      ],
      checkIn: { lt: data.checkOut },
      checkOut: { gt: data.checkIn },
    },
  });

  const blocked = property.blockedDates.some(
    (block) =>
      block.startDate < data.checkOut && block.endDate > data.checkIn,
  );

  const selected = property.tenant.options.filter((option) =>
    data.optionIds.includes(option.id),
  );
  const optionTotals = selected.reduce(
    (sum, option) => sum.add(option.price),
    new Prisma.Decimal(0),
  );

  let discount = new Prisma.Decimal(0);

  if (data.promoCode) {
    const promo = await db.promoCode.findFirst({
      where: {
        tenantId: property.tenantId,
        code: data.promoCode.trim().toUpperCase(),
        isActive: true,
        OR: [{ propertyId: null }, { propertyId: property.id }],
      },
    });

    if (
      promo &&
      (!promo.maxUses || promo.usedCount < promo.maxUses) &&
      (!promo.validFrom || promo.validFrom <= data.checkIn) &&
      (!promo.validUntil || promo.validUntil >= data.checkOut)
    ) {
      const base = calculateStay({
        baseRate: property.baseNightlyRate,
        rules: property.pricingRules,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        cleaningFee: property.cleaningFee,
        optionTotals,
      });

      if (!promo.minNights || base.nights >= promo.minNights) {
        discount =
          promo.type === "PERCENTAGE"
            ? base.subtotal.mul(promo.value).div(100)
            : Prisma.Decimal.min(promo.value, base.subtotal);
      }
    }
  }

  const nights = Math.ceil(
    (data.checkOut.getTime() - data.checkIn.getTime()) / 86400000,
  );

  const touristTax = property.tenant.settings?.touristTaxEnabled
    ? new Prisma.Decimal(property.tenant.settings.touristTaxPerNight).mul(
        nights * data.guests,
      )
    : new Prisma.Decimal(0);

  const calc = calculateStay({
    baseRate: property.baseNightlyRate,
    rules: property.pricingRules,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    cleaningFee: property.cleaningFee,
    optionTotals,
    discount,
    touristTax,
  });

  return {
    nights: calc.nights,
    subtotal: calc.subtotal.toString(),
    discount: calc.discount.toString(),
    cleaningFee: calc.cleaningFee.toString(),
    optionTotals: calc.optionTotals.toString(),
    touristTax: calc.touristTax.toString(),
    total: calc.total.toString(),
    available: !overlap && !blocked && data.guests <= property.maxGuests,
    options: property.tenant.options.map((option) => ({
      id: option.id,
      name: option.name,
      price: option.price.toString(),
      unit: option.unit,
    })),
    currency: property.tenant.settings?.currency ?? "EUR",
  };
}

export async function submitBooking(input: z.input<typeof schema>) {
  const data = schema.parse(input);
  const property = await findProperty(data.tenantSlug, data.propertySlug);

  if (!property) throw new Error("PROPERTY_NOT_FOUND");
  if (data.guests > property.maxGuests) throw new Error("TOO_MANY_GUESTS");

  const session = await auth();
  const clientId = session?.user?.role === "CLIENT" && session.user.tenantId === property.tenantId ? session.user.id : undefined;
  return createBooking({
    ...data,
    tenantId: property.tenantId,
    propertyId: property.id,
    clientId,
  });
}
