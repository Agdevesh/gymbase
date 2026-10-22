// Razorpay Subscriptions over plain fetch. Keys: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
// and one Razorpay plan id per GYMBASE plan: RAZORPAY_PLAN_STARTER / _GROWTH / _PRO.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanCode } from "@/lib/saas";

const auth = () => `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const razorpayPlanId = (code: PlanCode) => process.env[`RAZORPAY_PLAN_${code.toUpperCase()}`] ?? null;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, { ...init, headers: { Authorization: auth(), "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(json.error?.description ?? `Razorpay ${res.status}`);
  return json;
}

export type RzpSubscription = { id: string; status: string; short_url: string; current_end: number | null; charge_at: number | null; notes?: Record<string, string> };

export function createSubscription(planId: string, notes: Record<string, string>, email: string, phone: string | null) {
  return call<RzpSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ plan_id: planId, total_count: 120, quantity: 1, customer_notify: 1, notes, notify_info: { notify_email: email, ...(phone && { notify_phone: phone }) } }),
  });
}

export const cancelSubscription = (id: string, atCycleEnd: boolean) =>
  call<RzpSubscription>(`/subscriptions/${id}/cancel`, { method: "POST", body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }) });

export function verifyWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
