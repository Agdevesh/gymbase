import { NextResponse } from "next/server";
import { expireMemberships } from "@/server/memberships";

// Vercel cron (see vercel.json) calls this daily; CRON_SECRET guards it. Runs for every gym.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const expired = await expireMemberships();
  return NextResponse.json({ expired });
}
