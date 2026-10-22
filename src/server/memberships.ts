"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assignInput, cancelInput, endDateFor, formatInvoiceNumber, gstOn, prorataCredit, renewalStart, unfreezeDates } from "@/lib/memberships";
import { requireTenant } from "@/server/tenant";
import { audit } from "@/server/audit";
import { suspendDefaulters } from "@/server/dues";
import type { FormState } from "@/server/members";

type Tx = Prisma.TransactionClient;

// Marks lapsed memberships EXPIRED. Cheap enough to run on every membership read, and also from /api/cron/expire.
export async function expireMemberships(gymId?: string) {
  const { count } = await db.membership.updateMany({
    where: { ...(gymId && { gymId }), status: "ACTIVE", endDate: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return count;
}

async function currentMembership(tx: Tx, gymId: string, memberId: string) {
  return tx.membership.findFirst({ where: { gymId, memberId, status: { in: ["ACTIVE", "FROZEN"] } }, orderBy: { endDate: "desc" } });
}

// Creates a membership plus its invoice in one transaction. Payments are collected later (module 6).
async function startMembership(
  tx: Tx,
  gymId: string,
  memberId: string,
  plan: { id: string; pricePaise: number; durationDays: number },
  opts: { startDate: Date; discountPaise: number; renewedFromId?: string },
) {
  const discount = Math.min(opts.discountPaise, plan.pricePaise);
  const gym = await tx.gym.update({ where: { id: gymId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true, gstPercent: true } });
  const subtotal = plan.pricePaise - discount;
  const gst = gstOn(subtotal, gym.gstPercent);
  const membership = await tx.membership.create({
    data: {
      gymId, memberId, planId: plan.id, startDate: opts.startDate, endDate: endDateFor(opts.startDate, plan.durationDays),
      pricePaise: plan.pricePaise, discountPaise: discount, renewedFromId: opts.renewedFromId,
    },
  });
  await tx.invoice.create({
    data: {
      gymId, memberId, membershipId: membership.id, number: formatInvoiceNumber(gym.invoiceSeq, new Date().getFullYear()),
      subtotalPaise: subtotal, gstPercent: gym.gstPercent, gstPaise: gst, totalPaise: subtotal + gst, dueDate: opts.startDate,
    },
  });
  return membership;
}

function parseAssign(formData: FormData) {
  const parsed = assignInput.safeParse({ planId: String(formData.get("planId") ?? ""), startDate: String(formData.get("startDate") ?? ""), discountPaise: String(formData.get("discountPaise") ?? "") });
  if (parsed.success) return { data: parsed.data };
  const errors: Record<string, string> = {};
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}

function done(memberId: string) {
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  return {} as FormState;
}

// mode: "new" starts a plan (used for first plan and renewals), "upgrade" replaces the current plan with a pro-rata credit.
export async function assignPlan(memberId: string, mode: "new" | "upgrade", _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("members:write");
  const r = parseAssign(formData);
  if (!r.data) return { errors: r.errors };
  const { planId, startDate, discountPaise } = r.data;

  const result = await db.$transaction(async (tx) => {
    await expireMemberships(gymId);
    const [member, plan, current] = await Promise.all([
      tx.member.findFirst({ where: { id: memberId, gymId }, select: { id: true } }),
      tx.plan.findFirst({ where: { id: planId, gymId, active: true } }),
      currentMembership(tx, gymId, memberId),
    ]);
    if (!member) return { message: "Member not found" };
    if (!plan) return { errors: { planId: "Choose an active plan" } };

    if (mode === "upgrade") {
      if (!current) return { message: "No current membership to upgrade" };
      const now = new Date();
      const credit = prorataCredit(current, now);
      await tx.membership.update({ where: { id: current.id }, data: { status: "CANCELLED", endDate: now, cancelledAt: now, cancelReason: `Upgraded to ${plan.name}` } });
      await startMembership(tx, gymId, memberId, plan, { startDate: now, discountPaise: discountPaise + credit, renewedFromId: current.id });
      return {};
    }

    if (current?.status === "FROZEN") return { message: "Unfreeze the current membership first" };
    const start = current ? renewalStart(current, startDate) : startDate;
    await startMembership(tx, gymId, memberId, plan, { startDate: start, discountPaise, renewedFromId: current?.id });
    return {};
  });
  if (result.message || result.errors) return result;
  await audit(gymId, userId, mode === "upgrade" ? "membership.upgrade" : "membership.start", "member", memberId, `${mode === "upgrade" ? "Upgraded to" : "Started"} plan ${(await db.plan.findUnique({ where: { id: planId }, select: { name: true } }))?.name ?? planId}${discountPaise ? ` with discount ${discountPaise / 100}` : ""}`);
  return done(memberId);
}

export async function freezeMembership(memberId: string, membershipId: string) {
  const { gymId, userId } = await requireTenant("members:write");
  await db.membership.updateMany({ where: { id: membershipId, memberId, gymId, status: "ACTIVE" }, data: { status: "FROZEN", frozenAt: new Date() } });
  await audit(gymId, userId, "membership.freeze", "member", memberId, "Froze membership");
  done(memberId);
}

export async function unfreezeMembership(memberId: string, membershipId: string) {
  const { gymId, userId } = await requireTenant("members:write");
  const m = await db.membership.findFirst({ where: { id: membershipId, memberId, gymId, status: "FROZEN" } });
  if (!m?.frozenAt) return;
  const next = unfreezeDates({ frozenAt: m.frozenAt, endDate: m.endDate, frozenDays: m.frozenDays }, new Date());
  await db.membership.update({ where: { id: m.id }, data: { ...next, status: "ACTIVE", frozenAt: null } });
  await audit(gymId, userId, "membership.unfreeze", "member", memberId, `Unfroze membership, new end ${next.endDate.toLocaleDateString("en-IN")}`);
  done(memberId);
}

export async function cancelMembership(memberId: string, membershipId: string, formData: FormData) {
  const { gymId, userId } = await requireTenant("members:write");
  const { reason } = cancelInput.parse({ reason: String(formData.get("reason") ?? "") });
  const now = new Date();
  await db.membership.updateMany({
    where: { id: membershipId, memberId, gymId, status: { in: ["ACTIVE", "FROZEN"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason, frozenAt: null, endDate: now },
  });
  await audit(gymId, userId, "membership.cancel", "member", memberId, `Cancelled membership${reason ? `: ${reason}` : ""}`);
  done(memberId);
}

// Owner/reception lifts a dues suspension by hand (e.g. the member paid in cash outside GYMBASE or was given time).
export async function restoreMembership(memberId: string, membershipId: string) {
  const { gymId, userId } = await requireTenant("members:write");
  const m = await db.membership.findFirst({ where: { id: membershipId, memberId, gymId, status: "SUSPENDED" } });
  if (!m) return;
  await db.membership.update({ where: { id: m.id }, data: { status: m.endDate < new Date() ? "EXPIRED" : "ACTIVE", suspendedAt: null, suspendReason: null } });
  await audit(gymId, userId, "membership.restore", "member", memberId, "Membership restored by staff.");
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/dashboard");
}

// Expiry plus dues suspension in one call for pages that show membership state.
export async function tidyMemberships(gymId: string) {
  await expireMemberships(gymId);
  await suspendDefaulters(gymId);
}
