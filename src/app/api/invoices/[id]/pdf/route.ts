import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, OR: [{ tenantId: session.user.tenantId ?? "" }, { booking: { clientId: session.user.id } }] },
    include: { items: true, booking: { include: { property: true } }, tenant: { include: { settings: true } } },
  });
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  const pdf = await buildInvoicePdf(invoice);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${invoice.number}.pdf"` } });
}