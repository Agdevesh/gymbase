"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendMessage } from "@/lib/messaging";
import { RULE_DEFAULTS, REMINDER_TYPES, customInput, dedupeKey, fmtDate, fmtPaise, isBirthdayToday, renderTemplate, ruleInput, sendTimeFor, type ReminderTypeKey } from "@/lib/reminders";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}

// Rules a gym has not customised fall back to RULE_DEFAULTS, so reminders work from day one.
export async function rulesFor(gymId: string) {
  const saved = await db.reminderRule.findMany({ where: { gymId } });
  return REMINDER_TYPES.map((type) => {
    const s = saved.find((r) => r.type === type);
    return s ? { ...s, type } : { id: null, gymId, type, enabled: true, ...RULE_DEFAULTS[type] };
  });
}

export async function saveRule(type: ReminderTypeKey, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("gym:manage");
  const parsed = ruleInput.safeParse({ channel: formData.get("channel"), enabled: formData.get("enabled") ?? undefined, daysBefore: formData.get("daysBefore"), template: formData.get("template") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  await db.reminderRule.upsert({ where: { gymId_type: { gymId, type } }, create: { gymId, type, ...parsed.data }, update: parsed.data });
  revalidatePath("/reminders/settings");
  return {};
}

type Target = { memberId?: string; leadId?: string; to: string; vars: Record<string, string | number>; day: Date; targetKey: string };

// Builds today's reminders for one gym from its rules. Idempotent thanks to dedupeKey.
export async function generateReminders(gymId: string, now = new Date()) {
  const [gym, rules] = await Promise.all([db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { name: true } }), rulesFor(gymId)]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
  let created = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const targets: Target[] = [];
    const contact = (m: { phone: string; email: string | null }) => (rule.channel === "EMAIL" ? m.email : m.phone);

    if (rule.type === "RENEWAL") {
      const day = addDays(today, rule.daysBefore);
      const ms = await db.membership.findMany({
        where: { gymId, status: "ACTIVE", endDate: { gte: day, lt: addDays(day, 1) }, renewedTo: null },
        include: { member: true, plan: { select: { name: true } } },
      });
      for (const m of ms) { const to = contact(m.member); if (to) targets.push({ memberId: m.memberId, to, day: today, targetKey: m.id, vars: { name: m.member.firstName, plan: m.plan.name, endDate: fmtDate(m.endDate), days: rule.daysBefore } }); }
    }

    if (rule.type === "DUES") {
      const invoices = await db.invoice.findMany({ where: { gymId, paidPaise: { lt: db.invoice.fields.totalPaise } }, include: { member: true } });
      const byMember = new Map<string, { member: (typeof invoices)[number]["member"]; due: number; since: Date }>();
      for (const i of invoices) {
        const since = i.dueDate ?? i.issuedAt;
        const cur = byMember.get(i.memberId);
        byMember.set(i.memberId, { member: i.member, due: (cur?.due ?? 0) + i.totalPaise - i.paidPaise, since: cur && cur.since < since ? cur.since : since });
      }
      const every = Math.max(1, rule.daysBefore);
      for (const { member, due, since } of byMember.values()) {
        const days = Math.floor((today.getTime() - new Date(since.getFullYear(), since.getMonth(), since.getDate()).getTime()) / 86400_000);
        if (days < every || days % every !== 0) continue; // first nudge after N days, then every N days
        const to = contact(member);
        if (to) targets.push({ memberId: member.id, to, day: today, targetKey: member.id, vars: { name: member.firstName, amount: fmtPaise(due), days } });
      }
    }

    if (rule.type === "BIRTHDAY") {
      const members = await db.member.findMany({ where: { gymId, dob: { not: null } }, select: { id: true, firstName: true, phone: true, email: true, dob: true } });
      for (const m of members) if (isBirthdayToday(m.dob, today)) { const to = contact(m); if (to) targets.push({ memberId: m.id, to, day: today, targetKey: m.id, vars: { name: m.firstName } }); }
    }

    if (rule.type === "LEAD_FOLLOWUP") {
      const leads = await db.lead.findMany({ where: { gymId, status: { in: ["NEW", "CONTACTED", "TRIAL", "NEGOTIATING"] }, followUpAt: { gte: today, lt: addDays(today, 1) } } });
      for (const l of leads) { const to = contact(l); if (to) targets.push({ leadId: l.id, to, day: today, targetKey: l.id, vars: { name: l.name.split(" ")[0], plan: l.interestedIn ?? "membership" } }); }
    }

    for (const t of targets) {
      const r = await db.reminder.createMany({
        data: [{ gymId, type: rule.type, channel: rule.channel, memberId: t.memberId, leadId: t.leadId, to: t.to, body: renderTemplate(rule.template, { ...t.vars, gym: gym.name }), scheduledAt: sendTimeFor(t.day), dedupeKey: dedupeKey(rule.type, t.targetKey, t.day) }],
        skipDuplicates: true,
      });
      created += r.count;
    }
  }
  return created;
}

export async function generateAllReminders() {
  const gyms = await db.gym.findMany({ select: { id: true } });
  let n = 0;
  for (const g of gyms) n += await generateReminders(g.id);
  return n;
}

async function deliver(id: string) {
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r || r.status !== "PENDING") return;
  const res = await sendMessage(r.channel, r.to, r.body);
  await db.reminder.update({ where: { id }, data: res.ok ? { status: "SENT", sentAt: new Date(), providerRef: res.providerRef, error: null } : { status: "FAILED", error: res.error } });
}

// Cron: push every due reminder through its provider.
export async function dispatchReminders(now = new Date()) {
  const due = await db.reminder.findMany({ where: { status: "PENDING", scheduledAt: { lte: now } }, select: { id: true }, take: 500 });
  for (const d of due) await deliver(d.id);
  return due.length;
}

export async function sendNow(id: string) {
  const { gymId } = await requireTenant("members:write");
  const r = await db.reminder.findFirst({ where: { id, gymId }, select: { id: true } });
  if (r) await deliver(r.id);
  revalidatePath("/reminders");
}

// Reception sent it by hand (wa.me link, phone call); record that honestly.
export async function markSent(id: string) {
  const { gymId } = await requireTenant("members:write");
  await db.reminder.updateMany({ where: { id, gymId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SENT", sentAt: new Date(), error: null, providerRef: "manual" } });
  revalidatePath("/reminders");
}

export async function cancelReminder(id: string) {
  const { gymId } = await requireTenant("members:write");
  await db.reminder.updateMany({ where: { id, gymId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED" } });
  revalidatePath("/reminders");
}

export async function retryReminder(id: string) {
  const { gymId } = await requireTenant("members:write");
  await db.reminder.updateMany({ where: { id, gymId, status: "FAILED" }, data: { status: "PENDING", error: null } });
  await sendNow(id);
}

export async function generateNow() {
  const { gymId } = await requireTenant("members:write");
  await generateReminders(gymId);
  revalidatePath("/reminders");
}

// Ad hoc message to one member from the profile, sent immediately.
export async function sendCustom(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("members:write");
  const parsed = customInput.safeParse({ channel: formData.get("channel"), body: formData.get("body") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const m = await db.member.findFirst({ where: { id: memberId, gymId }, select: { phone: true, email: true } });
  if (!m) return { message: "Member not found" };
  const to = parsed.data.channel === "EMAIL" ? m.email : m.phone;
  if (!to) return { errors: { channel: "Member has no email" } };
  const r = await db.reminder.create({ data: { gymId, memberId, type: "CUSTOM", channel: parsed.data.channel, to, body: parsed.data.body, scheduledAt: new Date() } });
  await deliver(r.id);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/reminders");
  return {};
}
