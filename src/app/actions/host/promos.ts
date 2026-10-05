"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireHostTenant } from "@/lib/authz";

const schema = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce.number().positive(),
  propertyId: z.string().optional(),
  minNights: z.coerce.number().int().positive().optional(),
  maxUses: z.coerce.number().int().positive().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

function normalizeDateRange(from?: Date, until?: Date) {
  return {
    validFrom: from
      ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0))
      : undefined,
    validUntil: until
      ? new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate(), 23, 59, 59, 999))
      : undefined,
  };
}

export async function createPromo(input: z.input<typeof schema>) {
  const { tenant } = await requireHostTenant();
  const data = schema.parse(input);
  if (data.type === "PERCENTAGE" && data.value > 100) throw new Error("INVALID_PERCENTAGE");
  if (data.validFrom && data.validUntil && data.validUntil < data.validFrom) throw new Error("INVALID_DATES");

  if (
    data.propertyId &&
    !(await db.property.findFirst({
      where: { id: data.propertyId, tenantId: tenant.id },
    }))
  ) {
    throw new Error("PROPERTY_NOT_FOUND");
  }

  const dates = normalizeDateRange(data.validFrom, data.validUntil);

  return db.promoCode.create({
    data: {
      ...data,
      ...dates,
      tenantId: tenant.id,
      value: data.value,
      propertyId: data.propertyId || null,
    },
  });
}

export async function listPromos() {
  const { tenant } = await requireHostTenant();
  return db.promoCode.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function togglePromo(id: string, isActive: boolean) {
  const { tenant } = await requireHostTenant();
  const result = await db.promoCode.updateMany({
    where: { id, tenantId: tenant.id },
    data: { isActive },
  });
  if (!result.count) throw new Error("PROMO_NOT_FOUND");
  return { ok: true };
}

export async function deletePromo(id: string) {
  const { tenant } = await requireHostTenant();
  if (await db.booking.count({ where: { tenantId: tenant.id, promoCodeId: id } })) {
    throw new Error("PROMO_IN_USE");
  }
  const result = await db.promoCode.deleteMany({
    where: { id, tenantId: tenant.id },
  });
  if (!result.count) throw new Error("PROMO_NOT_FOUND");
  return { ok: true };
}
