"use server";

import { db } from "@/lib/prisma";
import { requireHostTenant } from "@/lib/authz";
import { BookingStatus } from "@prisma/client";

export async function getTenantBookings(filters?: { status?: BookingStatus; from?: string; to?: string }) {
  const { tenant } = await requireHostTenant();
  return db.booking.findMany({
    where: {
      tenantId: tenant.id,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.from || filters?.to ? { checkIn: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } } : {}),
    },
    include: { property: { select: { id: true, name: true, slug: true } }, options: { include: { option: true } }, invoice: { select: { id: true, number: true, status: true, total: true } } },
    orderBy: { checkIn: "asc" },
  });
}

export async function updateBookingStatus(id: string, status: BookingStatus, cancellationReason?: string) {
  const { tenant } = await requireHostTenant();
  const booking = await db.booking.findFirst({ where: { id, tenantId: tenant.id } });
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  if (booking.status === "COMPLETED" && status !== "COMPLETED") throw new Error("BOOKING_ALREADY_COMPLETED");
  if (status === "CANCELLED" && !cancellationReason?.trim() && !booking.cancellationReason) throw new Error("CANCELLATION_REASON_REQUIRED");

  if (status === "CONFIRMED" && booking.status !== "CONFIRMED") {
    const conflict = await db.booking.findFirst({
      where: { id: { not: booking.id }, propertyId: booking.propertyId, status: "CONFIRMED", checkIn: { lt: booking.checkOut }, checkOut: { gt: booking.checkIn } },
      select: { id: true },
    });
    if (conflict) throw new Error("DATES_UNAVAILABLE");
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { status, cancellationReason: status === "CANCELLED" ? (cancellationReason?.trim() || booking.cancellationReason) : null },
  });
  return { ok: true };
}

export async function getBookingDetails(id: string) {
  const { tenant } = await requireHostTenant();
  const booking = await db.booking.findFirst({ where: { id, tenantId: tenant.id }, include: { property: true, options: { include: { option: true } }, invoice: true } });
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  return booking;
}