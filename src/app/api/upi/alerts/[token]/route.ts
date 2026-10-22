import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { recordBankAlert } from "@/server/upi";

// Bank SMS / notifications forwarded by a free SMS-forwarder app on the owner's phone. The token in the URL is the secret.
async function gymFor(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return db.gym.findUnique({ where: { upiAlertToken: token }, select: { id: true } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gym = await gymFor((await params).token);
  return gym ? NextResponse.json({ ok: true, hint: "POST JSON {from, text} here" }) : new NextResponse("Unknown token", { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gym = await gymFor((await params).token);
  if (!gym) return new NextResponse("Unknown token", { status: 404 });
  if (!(await rateLimit(`upi-alert:${gym.id}`, 300, 60 * 60_000))) return new NextResponse("Too many alerts", { status: 429 });
  const type = req.headers.get("content-type") ?? "";
  let body: unknown;
  try {
    if (type.includes("json")) body = await req.json();
    else if (type.includes("form")) body = Object.fromEntries((await req.formData()).entries());
    else body = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Unreadable body" }, { status: 400 });
  }
  const out = await recordBankAlert(gym.id, body, type);
  return NextResponse.json(out, { status: out.ok ? 200 : 400 });
}
