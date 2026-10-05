"use server";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
export async function getClientDashboard(){
 const session=await auth(); if(!session?.user?.id || session.user.role!=="CLIENT") throw new Error("FORBIDDEN");
 return db.booking.findMany({where:{clientId:session.user.id},include:{property:true,invoice:true,options:{include:{option:true}}},orderBy:{checkIn:"desc"}});
}