import { NextResponse } from "next/server";
import { expireMemberships } from "@/server/memberships";
import { closeStaleCheckIns } from "@/server/checkin";

// Vercel cron (see vercel.json) calls this daily; CRON_SECRET guards it. Runs for every gym.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const [expired, closedVisits] = await Promise.all([expireMemberships(), closeStaleCheckIns()]);
  return NextResponse.json({ expired, closedVisits });
}
