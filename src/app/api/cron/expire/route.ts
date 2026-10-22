import { NextResponse } from "next/server";
import { expireMemberships } from "@/server/memberships";
import { closeStaleCheckIns } from "@/server/checkin";
import { dispatchReminders, generateAllReminders } from "@/server/reminders";
import { expireUpiRequests } from "@/server/upi";
import { suspendDefaulters } from "@/server/dues";

// Vercel cron (see vercel.json) calls this daily; CRON_SECRET guards it. Runs for every gym.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const [expired, closedVisits, upiExpired] = await Promise.all([expireMemberships(), closeStaleCheckIns(), expireUpiRequests()]);
  const suspended = await suspendDefaulters();
  const remindersCreated = await generateAllReminders();
  const remindersSent = await dispatchReminders();
  return NextResponse.json({ expired, suspended, closedVisits, upiExpired, remindersCreated, remindersSent });
}
