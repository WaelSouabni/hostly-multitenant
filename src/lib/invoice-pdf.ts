import PDFDocument from "pdfkit";

export async function buildInvoicePdf(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(22).text(invoice.tenant.name);
    doc.fontSize(10).fillColor("#666").text(invoice.tenant.address ?? "");
    doc.fillColor("#111").moveDown();
    doc.fontSize(18).text("FACTURE", { align: "right" });
    doc.fontSize(11).text(invoice.number, { align: "right" });
    doc.moveDown();
    doc.fontSize(11).text(`Client : ${invoice.billingName}`);
    doc.text(`Email : ${invoice.billingEmail}`);
    if (invoice.billingAddress) doc.text(invoice.billingAddress);
    doc.moveDown();
    doc.fontSize(10).text(`Séjour : ${new Date(invoice.booking.checkIn).toLocaleDateString("fr-FR")} → ${new Date(invoice.booking.checkOut).toLocaleDateString("fr-FR")}`);
    doc.text(`Propriété : ${invoice.booking.property.name}`);
    doc.moveDown();
    doc.fontSize(11).text("DÉTAIL", { underline: true });
    for (const item of invoice.items) doc.fontSize(10).text(`${item.description} × ${item.quantity}   ${Number(item.total).toFixed(2)} €`);
    doc.moveDown();
    doc.fontSize(12).text(`Sous-total : ${Number(invoice.subtotal).toFixed(2)} €`, { align: "right" });
    doc.text(`Taxe : ${Number(invoice.taxAmount).toFixed(2)} €`, { align: "right" });
    doc.fontSize(14).text(`TOTAL : ${Number(invoice.total).toFixed(2)} €`, { align: "right" });
    if (invoice.tenant.settings?.invoiceFooter) doc.moveDown(2).fontSize(9).fillColor("#666").text(invoice.tenant.settings.invoiceFooter);
    doc.end();
  });
}