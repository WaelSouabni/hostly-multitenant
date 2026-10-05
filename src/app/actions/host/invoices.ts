"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { requireHostTenant } from "@/lib/authz";

export async function createInvoiceForBooking(bookingId: string) {
  const { tenant } = await requireHostTenant();

  return db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${tenant.id + ":invoice"}))`,
    );

    const booking = await tx.booking.findFirst({
      where: { id: bookingId, tenantId: tenant.id },
      include: { options: { include: { option: true } } },
    });
    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    const existing = await tx.invoice.findUnique({ where: { bookingId: booking.id } });
    if (existing) return existing;

    const settings = await tx.tenantSetting.findUnique({
      where: { tenantId: tenant.id },
    });
    const sequence = (await tx.invoice.count({ where: { tenantId: tenant.id } })) + 1;
    const number = `${settings?.invoicePrefix ?? "INV"}-${String(sequence).padStart(6, "0")}`;

    // The booking total is already the authoritative amount calculated by the
    // booking engine (including discounts, options, cleaning and tourist tax).
    // We do not add VAT here because the booking engine does not currently
    // calculate VAT. This prevents invoices from charging a different amount
    // than the reservation. VAT can be introduced when the pricing model is
    // explicitly made VAT-aware.
    const items = [
      {
        description: "Séjour",
        quantity: new Prisma.Decimal(1),
        unitPrice: booking.subtotal,
        taxRate: new Prisma.Decimal(0),
        total: booking.subtotal,
      },
      ...(booking.cleaningFee.gt(0)
        ? [{
            description: "Frais de ménage",
            quantity: new Prisma.Decimal(1),
            unitPrice: booking.cleaningFee,
            taxRate: new Prisma.Decimal(0),
            total: booking.cleaningFee,
          }]
        : []),
      ...booking.options.map((item) => ({
        description: item.option.name,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: item.unitPrice,
        taxRate: new Prisma.Decimal(0),
        total: item.total,
      })),
      ...(booking.discount.gt(0)
        ? [{
            description: "Remise",
            quantity: new Prisma.Decimal(1),
            unitPrice: booking.discount.neg(),
            taxRate: new Prisma.Decimal(0),
            total: booking.discount.neg(),
          }]
        : []),
      ...(booking.touristTax.gt(0)
        ? [{
            description: "Taxe de séjour",
            quantity: new Prisma.Decimal(1),
            unitPrice: booking.touristTax,
            taxRate: new Prisma.Decimal(0),
            total: booking.touristTax,
          }]
        : []),
    ];

    return tx.invoice.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        number,
        status: "ISSUED",
        subtotal: booking.total,
        taxAmount: 0,
        total: booking.total,
        billingName: booking.clientName,
        billingEmail: booking.clientEmail,
        billingAddress: tenant.address
          ? [tenant.address, tenant.postalCode, tenant.city, tenant.country]
              .filter(Boolean)
              .join(", ")
          : null,
        items: { create: items },
      },
    });
  });
}

export async function listInvoices() {
  const { tenant } = await requireHostTenant();
  return db.invoice.findMany({
    where: { tenantId: tenant.id },
    include: { booking: { include: { property: true } }, items: true },
    orderBy: { issueDate: "desc" },
  });
}

export async function setInvoiceStatus(
  id: string,
  status: "ISSUED" | "PAID" | "CANCELLED",
) {
  const { tenant } = await requireHostTenant();
  const result = await db.invoice.updateMany({
    where: { id, tenantId: tenant.id },
    data: { status },
  });
  if (!result.count) throw new Error("INVOICE_NOT_FOUND");
  return { ok: true };
}
