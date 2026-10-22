import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Polled by the QR screens; the token is the request's own public token so it leaks nothing beyond its status.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await db.upiRequest.findUnique({ where: { token }, select: { status: true, expiresAt: true, utr: true, paidAt: true } });
  if (!r) return new NextResponse("Not found", { status: 404 });
  const status = r.status === "PENDING" && r.expiresAt <= new Date() ? "EXPIRED" : r.status;
  return NextResponse.json({ status, utr: r.utr, paidAt: r.paidAt }, { headers: { "cache-control": "no-store" } });
}
