import { z } from "zod";

export const UNLIMITED = 1_000_000;
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;

export type PlanCode = "starter" | "growth" | "pro";
export const SAAS_PLANS: Record<PlanCode, { name: string; pricePaise: number; memberLimit: number; staffLimit: number; blurb: string }> = {
  starter: { name: "Starter", pricePaise: 99900, memberLimit: 100, staffLimit: 2, blurb: "Single gym getting started" },
  growth: { name: "Growth", pricePaise: 249900, memberLimit: 500, staffLimit: 10, blurb: "Busy gym with a reception team" },
  pro: { name: "Pro", pricePaise: 499900, memberLimit: UNLIMITED, staffLimit: UNLIMITED, blurb: "Large or multi-trainer gym" },
};
export const PLAN_CODES = Object.keys(SAAS_PLANS) as PlanCode[];
export const isPlanCode = (s: string): s is PlanCode => s in SAAS_PLANS;
export const limitLabel = (n: number) => (n >= UNLIMITED ? "Unlimited" : n.toLocaleString("en-IN"));
export const trialEnd = (from: Date) => new Date(from.getTime() + TRIAL_DAYS * 86400_000);

export type SubState = { locked: boolean; reason: string | null; daysLeft: number | null; label: string };

// One place decides whether a gym can still write data. Reads are never blocked, so owners can export.
export function subscriptionState(sub: { status: string; trialEndsAt: Date; renewsAt: Date | null; cancelAtPeriodEnd: boolean } | null, now: Date): SubState {
  if (!sub) return { locked: true, reason: "No subscription found for this gym.", daysLeft: null, label: "none" };
  const days = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / 86400_000);
  if (sub.status === "TRIAL") {
    const left = days(sub.trialEndsAt);
    return left > 0 ? { locked: false, reason: null, daysLeft: left, label: "trial" } : { locked: true, reason: "Your free trial has ended. Choose a plan to continue.", daysLeft: 0, label: "trial ended" };
  }
  if (sub.status === "ACTIVE") {
    if (sub.cancelAtPeriodEnd && sub.renewsAt) {
      const left = days(sub.renewsAt);
      return left > 0 ? { locked: false, reason: null, daysLeft: left, label: "cancelling" } : { locked: true, reason: "Your subscription has ended.", daysLeft: 0, label: "ended" };
    }
    return { locked: false, reason: null, daysLeft: sub.renewsAt ? days(sub.renewsAt) : null, label: "active" };
  }
  if (sub.status === "PAST_DUE") {
    const graceLeft = sub.renewsAt ? days(new Date(sub.renewsAt.getTime() + GRACE_DAYS * 86400_000)) : 0;
    return graceLeft > 0 ? { locked: false, reason: null, daysLeft: graceLeft, label: "payment failed" } : { locked: true, reason: "Payment failed and the grace period is over. Update your payment method.", daysLeft: 0, label: "payment failed" };
  }
  return { locked: true, reason: "Your subscription was cancelled. Choose a plan to continue.", daysLeft: null, label: "cancelled" };
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

export const signupInput = z.object({
  gymName: z.string().trim().min(2, "Gym name is required").max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,29}$/, "2–30 letters, numbers or hyphens"),
  ownerName: z.string().trim().min(1, "Your name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(20).transform((v) => v || null),
  password: z.string().min(8, "At least 8 characters").max(100),
});

export const WRITE_PERMISSIONS = new Set(["gym:manage", "staff:manage", "members:write", "checkin:write", "leads:write", "payments:write", "payments:refund", "fitness:write"]);
