import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { calculateStay } from "@/lib/pricing";

const PENDING_HOLD_MINUTES = 15;

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

      const now = new Date();
      const property = await tx.property.findFirst({
        where: {
          id: input.propertyId,
          tenantId: input.tenantId,
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

      if (!property) throw new Error("PROPERTY_NOT_FOUND");

      const overlap = await tx.booking.findFirst({
        where: {
          propertyId: input.propertyId,
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: now } },
          ],
          checkIn: { lt: input.checkOut },
          checkOut: { gt: input.checkIn },
        },
      });

      if (overlap) throw new Error("DATES_UNAVAILABLE");

      if (
        property.blockedDates.some(
          (block) =>
            block.startDate < input.checkOut && block.endDate > input.checkIn,
        )
      ) {
        throw new Error("DATES_BLOCKED");
      }

      const selected = property.tenant.options.filter((option) =>
        input.optionIds?.includes(option.id),
      );
      const optionTotals = selected.reduce(
        (sum, option) => sum.add(option.price),
        new Prisma.Decimal(0),
      );

      let discount = new Prisma.Decimal(0);
      let promo: { id: string; maxUses: number | null } | null = null;

      if (input.promoCode) {
        const candidate = await tx.promoCode.findFirst({
          where: {
            tenantId: input.tenantId,
            code: input.promoCode.trim().toUpperCase(),
            isActive: true,
            OR: [
              { propertyId: null },
              { propertyId: input.propertyId },
            ],
          },
        });

        if (
          candidate &&
          (!candidate.maxUses || candidate.usedCount < candidate.maxUses) &&
          (!candidate.validFrom || candidate.validFrom <= input.checkIn) &&
          (!candidate.validUntil || candidate.validUntil >= input.checkOut)
        ) {
          const base = calculateStay({
            baseRate: property.baseNightlyRate,
            rules: property.pricingRules,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            cleaningFee: property.cleaningFee,
            optionTotals,
          });

          if (!candidate.minNights || base.nights >= candidate.minNights) {
            discount =
              candidate.type === "PERCENTAGE"
                ? base.subtotal.mul(candidate.value).div(100)
                : Prisma.Decimal.min(candidate.value, base.subtotal);
            promo = { id: candidate.id, maxUses: candidate.maxUses };
          }
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
          clientName: input.clientName.trim(),
          clientEmail: input.clientEmail.trim().toLowerCase(),
          clientPhone: input.clientPhone?.trim() || undefined,
          clientMessage: input.clientMessage?.trim() || undefined,
          expiresAt: new Date(
            now.getTime() + PENDING_HOLD_MINUTES * 60_000,
          ),
          options: {
            create: selected.map((option) => ({
              tenantId: input.tenantId,
              optionId: option.id,
              quantity: 1,
              unitPrice: option.price,
              total: option.price,
            })),
          },
        },
      });

      if (promo) {
        const updated = await tx.promoCode.updateMany({
          where: {
            id: promo.id,
            ...(promo.maxUses === null
              ? {}
              : { usedCount: { lt: promo.maxUses } }),
          },
          data: { usedCount: { increment: 1 } },
        });

        if (!updated.count) throw new Error("PROMO_LIMIT_REACHED");
      }

      return booking;
    },
    { isolationLevel: "Serializable" },
  );
}
