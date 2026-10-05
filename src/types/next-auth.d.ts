import "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: string; role: "SUPER_ADMIN"|"HOST"|"CLIENT"; tenantId: string|null } & Session["user"];
  }
}