import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RESERVED = new Set(["localhost","www","admin","api"]);

export function proxy(request: NextRequest) {
  const host=request.headers.get("host")?.split(":")[0]??"";
  const root=(process.env.PLATFORM_DOMAIN??"localhost:3000").split(":")[0];
  if(!host || host===root || RESERVED.has(host.split(".")[0]??"")) return NextResponse.next();
  const suffix="."+root;
  if(!host.endsWith(suffix)) return NextResponse.next();
  const tenantSlug=host.slice(0,-suffix.length);
  if(!tenantSlug) return NextResponse.next();
  const url=request.nextUrl.clone();
  url.pathname="/site/"+tenantSlug+request.nextUrl.pathname;
  return NextResponse.rewrite(url);
}
export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico).*)"]};