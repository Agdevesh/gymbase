import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildInvoicePdf } from "@/server/invoice-pdf";

// Public receipt PDF; the 32-hex token is the only credential, so links are safe to WhatsApp.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = /^[a-f0-9]{32}$/.test(token) ? await db.invoice.findUnique({ where: { publicToken: token }, select: { gymId: true } }) : null;
  const r = inv ? await buildInvoicePdf(inv.gymId, { publicToken: token }) : null;
  if (!r) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(r.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.number}.pdf"`, "Cache-Control": "private, no-store" } });
}
