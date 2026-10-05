import "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "SUPER_ADMIN" | "HOST" | "CLIENT";
    tenantId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "HOST" | "CLIENT";
      tenantId: string | null;
    } & DefaultSession["user"];
  }
}