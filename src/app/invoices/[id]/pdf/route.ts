import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildInvoicePdf } from "@/server/invoice-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { gymId, role, id: userId } = session.user;
  const { id } = await params;
  const r = await buildInvoicePdf(gymId, { id, ...(role === "MEMBER" && { member: { userId } }) });
  if (!r) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(r.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.number}.pdf"` } });
}
