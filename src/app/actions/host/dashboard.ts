"use server";
import { db } from "@/lib/prisma";import { requireHostTenant } from "@/lib/authz";
export async function getHostDashboard(){const {tenant}=await requireHostTenant();const now=new Date();const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));const end=new Date(start);end.setUTCDate(end.getUTCDate()+1);const [properties,bookings,revenue,arrivals]=await Promise.all([
 db.property.count({where:{tenantId:tenant.id,isActive:true}}),
 db.booking.count({where:{tenantId:tenant.id,status:{in:["PENDING","CONFIRMED"]}}}),
 db.booking.aggregate({where:{tenantId:tenant.id,status:{in:["CONFIRMED","COMPLETED"]}},_sum:{total:true}}),
 db.booking.findMany({where:{tenantId:tenant.id,status:{in:["PENDING","CONFIRMED"]},checkIn:{gte:start,lt:end}},include:{property:true},orderBy:{checkIn:"asc"}})
]);return {properties,bookings,revenue:revenue._sum.total??0,arrivals};}