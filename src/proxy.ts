import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/prisma";

const RESERVED = new Set(["localhost", "www", "admin", "api"]);

export default auth(async (request: NextRequest) => {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const root = (process.env.PLATFORM_DOMAIN ?? "localhost").split(":")[0].toLowerCase();

  if (!host || host === root || RESERVED.has(host.split(".")[0] ?? "")) {
    return NextResponse.next();
  }

  const suffix = "." + root;
  let tenantSlug: string | undefined;
  let propertySlug: string | undefined;

  if (host.endsWith(suffix)) {
    tenantSlug = host.slice(0, -suffix.length);
  } else {
    const domain = await db.propertyDomain.findUnique({
      where: { hostname: host },
      select: {
        property: { select: { slug: true, tenant: { select: { slug: true, status: true } } } },
        verifiedAt: true,
      },
    });

    if (domain?.verifiedAt && domain.property.tenant.status === "ACTIVE") {
      tenantSlug = domain.property.tenant.slug;
      propertySlug = domain.property.slug;
    }
  }

  if (!tenantSlug) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (propertySlug && request.nextUrl.pathname === "/") {
    url.pathname = `/site/${tenantSlug}/${propertySlug}`;
  } else {
    url.pathname = `/site/${tenantSlug}${request.nextUrl.pathname}`;
  }
  return NextResponse.rewrite(url);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
