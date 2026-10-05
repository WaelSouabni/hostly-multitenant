import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db } from "@/lib/prisma";
import { consumeRateLimit, recordSecurityEvent } from "@/lib/security";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Mot de passe", type: "password" } },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;
      const rate = await consumeRateLimit(`login:${email}`, 8, 15 * 60 * 1000);
      if (!rate.allowed) throw new Error("TOO_MANY_LOGIN_ATTEMPTS");

      const user = await db.user.findUnique({ where: { email }, include: { tenant: true } });
      if (!user) return null;
      if (user.lockedUntil && user.lockedUntil > new Date()) throw new Error("ACCOUNT_TEMPORARILY_LOCKED");

      const valid = Boolean(user.passwordHash) && await compare(password, user.passwordHash!);
      if (!valid) {
        const failures = user.loginFailures + 1;
        await db.user.update({ where: { id: user.id }, data: { loginFailures: failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null } });
        await recordSecurityEvent({ type: "LOGIN_FAILED", userId: user.id, tenantId: user.tenantId, metadata: { email } });
        return null;
      }

      await db.user.update({ where: { id: user.id }, data: { loginFailures: 0, lockedUntil: null } });
      await recordSecurityEvent({ type: "LOGIN_SUCCESS", userId: user.id, tenantId: user.tenantId });
      if (user.role === "HOST" && user.tenant?.status !== "ACTIVE") return null;
      return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, tenantStatus: user.tenant?.status ?? null, sessionVersion: user.sessionVersion };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantStatus = user.tenantStatus ?? null;
        token.sessionVersion = user.sessionVersion ?? 0;
      } else if (token.sub) {
        const current = await db.user.findUnique({ where: { id: token.sub }, select: { id: true, role: true, tenantId: true, sessionVersion: true, tenant: { select: { status: true } } } });
        if (!current || current.sessionVersion !== (token.sessionVersion ?? 0)) return {};
        token.role = current.role;
        token.tenantId = current.tenantId;
        token.tenantStatus = current.tenant?.status ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as "SUPER_ADMIN" | "HOST" | "CLIENT";
        session.user.tenantId = (token.tenantId as string | null | undefined) ?? null;
        session.user.tenantStatus = (token.tenantStatus as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | null | undefined) ?? null;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (!path.startsWith("/host") && !path.startsWith("/super-admin")) return true;
      if (!auth?.user) return false;
      if (path.startsWith("/super-admin")) return auth.user.role === "SUPER_ADMIN";
      return auth.user.role === "HOST" && auth.user.tenantStatus === "ACTIVE";
    },
  },
});