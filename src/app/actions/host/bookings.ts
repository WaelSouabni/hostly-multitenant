"use server";
import { db } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

export async function getTenantBookings() {
  const { tenantId } = await requireTenantContext();
  return db.booking.findMany({
    where: { tenantId },
    include: {
      property: { select:{id:true,name:true,slug:true} },
      options: { include:{option:true} },
      invoice: { select:{id:true,number:true,status:true,total:true} }
    },
    orderBy:{checkIn:"asc"}
  });
}