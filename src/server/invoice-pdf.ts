import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { fileIdFromUrl } from "@/lib/members";
import { METHOD_LABELS } from "@/lib/payments";
import { upiLink } from "@/lib/settings";

// pdfkit's built-in Helvetica has no rupee glyph, so amounts are printed as "Rs."
const rs = (p: number) => `Rs. ${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Renders an invoice/receipt PDF. `where` lets callers scope by gym, member login or public token.
export async function buildInvoicePdf(gymId: string, where: { id?: string; publicToken?: string; member?: { userId: string } }) {
  const [inv, gym] = await Promise.all([
    db.invoice.findFirst({
      where: { gymId, ...where },
      include: { member: true, membership: { include: { plan: true } }, payments: { orderBy: { paidAt: "asc" } } },
    }),
    db.gym.findUniqueOrThrow({ where: { id: gymId } }),
  ]);
  if (!inv) return null;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const due = inv.totalPaise - inv.paidPaise;
  const name = [inv.member.firstName, inv.member.lastName].filter(Boolean).join(" ");
  const logoId = fileIdFromUrl(gym.logoUrl);
  const logo = logoId ? await db.storedFile.findFirst({ where: { id: logoId, gymId }, select: { data: true, mime: true } }) : null;
  if (logo && /png|jpe?g/.test(logo.mime)) { try { doc.image(Buffer.from(logo.data), 50, 40, { fit: [60, 60] }); doc.x = 120; doc.y = 50; } catch { /* unsupported image, skip */ } }
  doc.fontSize(18).text(gym.name, { continued: true }).fontSize(18).text(due > 0 ? "INVOICE" : "RECEIPT", { align: "right" });
  doc.fontSize(9).fillColor("#555").text([gym.address, gym.phone, gym.gstin && `GSTIN ${gym.gstin}`].filter(Boolean).join("\n"));
  doc.moveDown().fillColor("#000").fontSize(11);
  doc.text(`Invoice no: ${inv.number}`).text(`Date: ${date(inv.issuedAt)}`).moveDown(0.5);
  doc.text(`Billed to: ${name} (${inv.member.code})`).text(`Phone: ${inv.member.phone}`).moveDown();

  const left = 50, right = 545;
  const line = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(label, left, doc.y, { continued: true, width: right - left }).text(value, { align: "right" });
  };
  doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.3);
  const desc = inv.membership ? `${inv.membership.plan.name} membership, ${date(inv.membership.startDate)} to ${date(inv.membership.endDate)}` : inv.notes ?? "Charge";
  line(desc, rs(inv.subtotalPaise + (inv.membership?.discountPaise ?? 0)));
  if (inv.membership && inv.membership.discountPaise > 0) line("Discount", `- ${rs(inv.membership.discountPaise)}`);
  if (inv.gstPercent > 0) line(`GST @ ${inv.gstPercent}%`, rs(inv.gstPaise));
  doc.moveDown(0.3).moveTo(left, doc.y).lineTo(right, doc.y).stroke().moveDown(0.3);
  line("Total", rs(inv.totalPaise), true);
  line("Paid", rs(inv.paidPaise));
  line(due > 0 ? "Balance due" : "Balance", rs(Math.max(0, due)), due > 0);

  if (inv.payments.length) {
    doc.moveDown().font("Helvetica-Bold").text("Payments").font("Helvetica");
    for (const p of inv.payments) line(`${date(p.paidAt)}  ${p.kind === "REFUND" ? "Refund" : METHOD_LABELS[p.method]}${p.reference ? ` (${p.reference})` : ""}`, `${p.kind === "REFUND" ? "- " : ""}${rs(p.amountPaise)}`);
  }
  if (due > 0 && gym.upiId) {
    doc.moveDown().font("Helvetica-Bold").fontSize(11).fillColor("#000").text("Pay by UPI").font("Helvetica").text(`UPI ID: ${gym.upiId}  (${rs(due)})`);
    const png = await QRCode.toBuffer(upiLink(gym.upiId, gym.name, due, inv.number), { margin: 1, width: 120 });
    doc.image(png, left, doc.y + 4, { width: 100 });
    doc.y += 110;
  }
  doc.moveDown(2).fontSize(9).fillColor("#555").text(gym.receiptNote ?? "Thank you for training with us. This is a computer-generated document.", { align: "center" });
  doc.end();

  const pdf = await done;
  return { pdf, number: inv.number };
}
