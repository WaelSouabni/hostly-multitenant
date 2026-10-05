import { Prisma, BookingStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { calculateStay } from "@/lib/pricing";

export async function createBooking(input: {
  tenantId: string;
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientMessage?: string;
  optionIds?: string[];
  promoCode?: string;
}) {
  if (input.guests < 1 || input.checkOut <= input.checkIn) {
    throw new Error("INVALID_BOOKING");
  }

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.propertyId}))`,
      );

      const property = await tx.property.findFirst({
        where: {
          id: input.propertyId,
          tenantId: input.tenantId,
          isActive: true,
          isPublished: true,
        },
        include: {
          pricingRules: { where: { isActive: true } },
          tenant: { include: { settings: true, options: true } },
          blockedDates: true,
        },
      });

      if (!property) throw new Error("PROPERTY_NOT_FOUND");

      const overlap = await tx.booking.findFirst({
        where: {
          propertyId: input.propertyId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          checkIn: { lt: input.checkOut },
          checkOut: { gt: input.checkIn },
        },
      });

      if (overlap) throw new Error("DATES_UNAVAILABLE");

      if (
        property.blockedDates.some(
          (b) => b.startDate < input.checkOut && b.endDate > input.checkIn,
        )
      ) {
        throw new Error("DATES_BLOCKED");
      }

      const selected = property.tenant.options.filter((o) =>
        input.optionIds?.includes(o.id),
      );
      const optionTotals = selected.reduce(
        (sum, o) => sum.add(o.price),
        new Prisma.Decimal(0),
      );

      let discount = new Prisma.Decimal(0);
      let promo = null;

      if (input.promoCode) {
        promo = await tx.promoCode.findFirst({
          where: {
            tenantId: input.tenantId,
            code: input.promoCode.toUpperCase(),
            isActive: true,
            OR: [{ propertyId: null }, { propertyId: input.propertyId }],
          },
        });

        if (
          promo &&
          (!promo.maxUses || promo.usedCount < promo.maxUses) &&
          (!promo.validFrom || promo.validFrom <= input.checkIn) &&
          (!promo.validUntil || promo.validUntil >= input.checkOut)
        ) {
          const base = calculateStay({
            baseRate: property.baseNightlyRate,
            rules: property.pricingRules,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            cleaningFee: property.cleaningFee,
            optionTotals,
          });

          discount =
            promo.type === "PERCENTAGE"
              ? base.subtotal.mul(promo.value).div(100)
              : promo.value;
        } else {
          promo = null;
        }
      }

      const nights = Math.ceil(
        (input.checkOut.getTime() - input.checkIn.getTime()) / 86400000,
      );

      const touristTax = property.tenant.settings?.touristTaxEnabled
        ? new Prisma.Decimal(property.tenant.settings.touristTaxPerNight).mul(
            nights * input.guests,
          )
        : new Prisma.Decimal(0);

      const calc = calculateStay({
        baseRate: property.baseNightlyRate,
        rules: property.pricingRules,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        cleaningFee: property.cleaningFee,
        optionTotals,
        discount,
        touristTax,
      });

      const booking = await tx.booking.create({
        data: {
          tenantId: input.tenantId,
          propertyId: input.propertyId,
          status: "PENDING",
          paymentStatus: "UNPAID",
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
          nights: calc.nights,
          subtotal: calc.subtotal,
          discount: calc.discount,
          cleaningFee: calc.cleaningFee,
          touristTax: calc.touristTax,
          total: calc.total,
          promoCodeId: promo?.id,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          clientMessage: input.clientMessage,
          options: {
            create: selected.map((o) => ({
              tenantId: input.tenantId,
              optionId: o.id,
              quantity: 1,
              unitPrice: o.price,
              total: o.price,
            })),
          },
        },
      });

      if (promo) {
        await tx.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      return booking;
    },
    { isolationLevel: "Serializable" },
  );
}
