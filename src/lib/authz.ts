import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { Role } from "@prisma/client";
export async function requireRole(role:Role){const session=await auth();if(!session?.user?.id||session.user.role!==role)throw new Error("FORBIDDEN");return session.user;}
export async function requireHostTenant(){const user=await requireRole(Role.HOST);if(!user.tenantId)throw new Error("TENANT_ACCESS_DENIED");const tenant=await db.tenant.findUnique({where:{id:user.tenantId}});if(!tenant||tenant.status!=="ACTIVE")throw new Error("TENANT_INACTIVE");return {user,tenant};}
export async function requireSuperAdmin() { return requireRole(Role.SUPER_ADMIN); }
