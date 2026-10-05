"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireHostTenant } from "@/lib/authz";

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) =>
    value.replace(/^https?:\/\//, "").split("/")[0].split(":")[0],
  )
  .refine(
    (value) =>
      /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value),
    "INVALID_HOSTNAME",
  );

export async function listDomains() {
  const { tenant } = await requireHostTenant();
  return db.propertyDomain.findMany({
    where: { tenantId: tenant.id },
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function addDomain(input: { propertyId: string; hostname: string }) {
  const { tenant } = await requireHostTenant();
  const hostname = hostnameSchema.parse(input.hostname);

  const property = await db.property.findFirst({
    where: { id: input.propertyId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!property) throw new Error("PROPERTY_NOT_FOUND");

  const existing = await db.propertyDomain.findUnique({ where: { hostname } });
  if (existing) throw new Error("DOMAIN_ALREADY_EXISTS");

  return db.propertyDomain.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      hostname,
    },
  });
}

export async function removeDomain(id: string) {
  const { tenant } = await requireHostTenant();
  const result = await db.propertyDomain.deleteMany({
    where: { id, tenantId: tenant.id },
  });
  if (!result.count) throw new Error("DOMAIN_NOT_FOUND");
  return { ok: true };
}

export async function setPrimaryDomain(id: string) {
  const { tenant } = await requireHostTenant();
  return db.$transaction(async (tx) => {
    const domain = await tx.propertyDomain.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!domain) throw new Error("DOMAIN_NOT_FOUND");

    await tx.propertyDomain.updateMany({
      where: { tenantId: tenant.id },
      data: { isPrimary: false },
    });

    return tx.propertyDomain.update({
      where: { id: domain.id },
      data: { isPrimary: true },
    });
  });
}
