"use server";

import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cancelSubscription as rzpCancel, createSubscription, razorpayConfigured, razorpayPlanId } from "@/lib/razorpay";
import { SAAS_PLANS, isPlanCode, signupInput, trialEnd } from "@/lib/saas";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// Public: a new gym signs up and gets a 14-day trial with Growth limits.
export async function signupGym(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupInput.safeParse({ gymName: str(formData, "gymName"), slug: str(formData, "slug"), ownerName: str(formData, "ownerName"), email: str(formData, "email"), phone: str(formData, "phone"), password: str(formData, "password") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { gymName, slug, ownerName, email, phone, password } = parsed.data;
  if (["signup", "login", "api", "admin", "demo"].includes(slug)) return { errors: { slug: "This gym code is reserved" } };
  try {
    await db.gym.create({
      data: {
        name: gymName, slug, email, phone,
        subscription: { create: { planCode: "growth", status: "TRIAL", memberLimit: SAAS_PLANS.growth.memberLimit, staffLimit: SAAS_PLANS.growth.staffLimit, trialEndsAt: trialEnd(new Date()) } },
        users: { create: { email, name: ownerName, role: "OWNER", passwordHash: await hash(password, 10), phone } },
        plans: { create: [{ name: "Monthly", type: "MONTHLY", durationDays: 30, pricePaise: 150000 }, { name: "Quarterly", type: "QUARTERLY", durationDays: 90, pricePaise: 400000 }, { name: "Yearly", type: "YEARLY", durationDays: 365, pricePaise: 1200000 }] },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { errors: { slug: "That gym code is taken, try another" } };
    throw e;
  }
  redirect(`/login?gym=${slug}&email=${encodeURIComponent(email)}&joined=1&next=/setup`);
}

// Owner picks a plan: create a Razorpay subscription and send them to the hosted checkout.
export async function startCheckout(planCode: string): Promise<FormState> {
  const { gymId, userId } = await requireTenant("gym:manage");
  if (!isPlanCode(planCode)) return { message: "Unknown plan" };
  if (!razorpayConfigured()) return { message: `Online payment is not set up yet. Email ${process.env.SUPPORT_EMAIL ?? "support"} to activate the ${SAAS_PLANS[planCode].name} plan.` };
  const rzpPlan = razorpayPlanId(planCode);
  if (!rzpPlan) return { message: `The ${SAAS_PLANS[planCode].name} plan is not configured for online payment yet.` };
  const owner = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, phone: true } });
  let url: string;
  try {
    const sub = await createSubscription(rzpPlan, { gymId, planCode }, owner.email, owner.phone);
    await db.subscription.update({ where: { gymId }, data: { providerRef: sub.id } });
    url = sub.short_url;
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Could not start checkout" };
  }
  redirect(url);
}

export async function cancelPlan() {
  const { gymId } = await requireTenant("gym:manage");
  const sub = await db.subscription.findUnique({ where: { gymId } });
  if (!sub || sub.status !== "ACTIVE") return;
  if (sub.providerRef && razorpayConfigured()) {
    try { await rzpCancel(sub.providerRef, true); } catch { /* webhook will reconcile; still mark locally */ }
  }
  await db.subscription.update({ where: { gymId }, data: { cancelAtPeriodEnd: true } });
  revalidatePath("/billing");
}

// Webhook handler body (route verifies the signature first). Idempotent: every event just rewrites state.
export async function applyRazorpayEvent(event: string, sub: { id: string; status: string; current_end: number | null; charge_at: number | null; notes?: Record<string, string> }) {
  const gymId = sub.notes?.gymId;
  const planCode = sub.notes?.planCode;
  const row = gymId ? await db.subscription.findUnique({ where: { gymId } }) : await db.subscription.findFirst({ where: { providerRef: sub.id } });
  if (!row) return false;
  const renewsAt = sub.current_end ? new Date(sub.current_end * 1000) : sub.charge_at ? new Date(sub.charge_at * 1000) : row.renewsAt;
  const plan = planCode && isPlanCode(planCode) ? SAAS_PLANS[planCode] : null;
  const limits = plan ? { planCode, memberLimit: plan.memberLimit, staffLimit: plan.staffLimit } : {};
  const data: Prisma.SubscriptionUpdateInput = { providerRef: sub.id, lastEventAt: new Date(), renewsAt };
  if (event === "subscription.activated" || event === "subscription.charged" || event === "subscription.resumed") Object.assign(data, { status: "ACTIVE", cancelAtPeriodEnd: false, ...limits });
  else if (event === "subscription.pending" || event === "subscription.halted") Object.assign(data, { status: "PAST_DUE" });
  else if (event === "subscription.cancelled" || event === "subscription.completed") Object.assign(data, { status: "CANCELLED", cancelAtPeriodEnd: false });
  else if (event === "subscription.authenticated") Object.assign(data, limits);
  else return true; // unknown event: acknowledged, nothing to change
  await db.subscription.update({ where: { id: row.id }, data });
  return true;
}
