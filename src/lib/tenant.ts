"use server";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function requireTenantContext() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  const user = await db.user.findUnique({ where:{id:session.user.id}, select:{id:true,role:true,tenantId:true} });
  if (!user || user.role !== Role.HOST || !user.tenantId) throw new Error("TENANT_ACCESS_DENIED");
  return { userId:user.id, tenantId:user.tenantId };
}