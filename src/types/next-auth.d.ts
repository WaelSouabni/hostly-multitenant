import "next-auth";
import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface User { role: "SUPER_ADMIN" | "HOST" | "CLIENT"; tenantId: string | null; tenantStatus?: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | null; sessionVersion?: number; }
  interface Session { user: { id: string; role: "SUPER_ADMIN" | "HOST" | "CLIENT"; tenantId: string | null; tenantStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | null; sessionVersion?: number; } & DefaultSession["user"]; }
}

declare module "next-auth/jwt" {
  interface JWT { role?: "SUPER_ADMIN" | "HOST" | "CLIENT"; tenantId?: string | null; tenantStatus?: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | null; sessionVersion?: number; }
}
