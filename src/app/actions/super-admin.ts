"use server";
import { db } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Role, TenantStatus } from "@prisma/client";

export async function getSuperAdminOverview() {
  await requireRole(Role.SUPER_ADMIN);
  const [tenants, users, bookings, revenue] = await Promise.all([
    db.tenant.findMany({ include: { _count: { select: { properties: true, bookings: true, users: true } } }, orderBy: { createdAt: "desc" } }),
    db.user.count(),
    db.booking.count(),
    db.booking.aggregate({ _sum: { total: true }, where: { status: { not: "CANCELLED" } } }),
  ]);
  return { tenants, users, bookings, revenue: Number(revenue._sum.total ?? 0) };
}

export async function setTenantStatus(id: string, status: TenantStatus) {
  await requireRole(Role.SUPER_ADMIN);
  await db.tenant.update({ where: { id }, data: { status } });
  return { ok: true };
}

export async function setUserRole(id: string, role: Role) {
  await requireRole(Role.SUPER_ADMIN);
  await db.user.update({ where: { id }, data: { role, sessionVersion: { increment: 1 } } });
  return { ok: true };
}