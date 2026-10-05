"use server";
import { db } from "@/lib/prisma";
import { requireHostTenant } from "@/lib/authz";
import { sendTransactionalEmail } from "@/lib/email";

export async function sendInvoiceEmail(id: string) {
  const { tenant } = await requireHostTenant();
  const invoice = await db.invoice.findFirst({ where: { id, tenantId: tenant.id }, include: { booking: { include: { property: true } } } });
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  await sendTransactionalEmail({
    to: invoice.billingEmail,
    subject: `Votre facture ${invoice.number} — ${tenant.name}`,
    html: `<p>Bonjour ${invoice.billingName},</p><p>Votre facture <strong>${invoice.number}</strong> pour <strong>${invoice.booking.property.name}</strong> est disponible.</p><p><a href="${base}/api/invoices/${invoice.id}/pdf">Ouvrir la facture PDF</a></p><p>Merci,<br/>${tenant.name}</p>`,
  });
  return { ok: true };
}