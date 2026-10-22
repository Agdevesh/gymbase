import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/razorpay";
import { applyRazorpayEvent } from "@/server/saas";

// Razorpay posts subscription lifecycle events here; the signature header proves they came from Razorpay.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-razorpay-signature"))) return new NextResponse("Bad signature", { status: 400 });
  const body = JSON.parse(raw) as { event: string; payload?: { subscription?: { entity: Parameters<typeof applyRazorpayEvent>[1] } } };
  const sub = body.payload?.subscription?.entity;
  if (!sub) return NextResponse.json({ ignored: true });
  const ok = await applyRazorpayEvent(body.event, sub);
  return NextResponse.json({ ok });
}
