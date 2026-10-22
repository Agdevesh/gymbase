"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { addMonths, lockerAssignInput, lockerRangeInput, measurementInput, planInput } from "@/lib/fitness";
import { audit } from "@/server/audit";
import { raiseCharge } from "@/server/invoices";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const fields = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, str(fd, k)]));

export async function addMeasurement(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("fitness:write");
  const parsed = measurementInput.safeParse(fields(formData, ["at", "weightKg", "heightCm", "bodyFatPct", "chestCm", "waistCm", "hipsCm", "armCm", "thighCm", "notes"]));
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const member = await db.member.findFirst({ where: { id: memberId, gymId }, select: { id: true } });
  if (!member) return { message: "Member not found" };
  await db.measurement.create({ data: { ...parsed.data, gymId, memberId, recordedById: userId } });
  revalidatePath(`/members/${memberId}`);
  revalidatePath(`/members/${memberId}/progress`);
  return {};
}

export async function deleteMeasurement(memberId: string, id: string) {
  const { gymId } = await requireTenant("fitness:write");
  await db.measurement.deleteMany({ where: { id, gymId, memberId } });
  revalidatePath(`/members/${memberId}`);
  revalidatePath(`/members/${memberId}/progress`);
}

export async function savePlan(memberId: string, planId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("fitness:write");
  const parsed = planInput.safeParse(fields(formData, ["type", "title", "body"]));
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const member = await db.member.findFirst({ where: { id: memberId, gymId }, select: { id: true, firstName: true } });
  if (!member) return { message: "Member not found" };
  if (planId) await db.fitnessPlan.updateMany({ where: { id: planId, gymId, memberId }, data: parsed.data });
  else {
    // One active plan per type keeps the member's portal unambiguous; older ones stay as history.
    await db.fitnessPlan.updateMany({ where: { gymId, memberId, type: parsed.data.type, active: true }, data: { active: false } });
    await db.fitnessPlan.create({ data: { ...parsed.data, gymId, memberId, authorId: userId } });
  }
  await audit(gymId, userId, planId ? "plan.update" : "plan.create", "member", memberId, `${planId ? "Updated" : "Gave"} ${parsed.data.type.toLowerCase()} plan "${parsed.data.title}" for ${member.firstName}`);
  revalidatePath(`/members/${memberId}`);
  return {};
}

export async function setPlanActive(memberId: string, planId: string, active: boolean) {
  const { gymId } = await requireTenant("fitness:write");
  await db.fitnessPlan.updateMany({ where: { id: planId, gymId, memberId }, data: { active } });
  revalidatePath(`/members/${memberId}`);
}

// ---------- Lockers ----------

export async function addLockers(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("gym:manage");
  const parsed = lockerRangeInput.safeParse(fields(formData, ["from", "to", "feePaise"]));
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { from, to, feePaise } = parsed.data;
  const r = await db.locker.createMany({ data: Array.from({ length: to - from + 1 }, (_, i) => ({ gymId, number: String(from + i), feePaise })), skipDuplicates: true });
  await audit(gymId, userId, "locker.add", "locker", null, `Added ${r.count} lockers (${from}–${to})`);
  revalidatePath("/lockers");
  return { message: `Added ${r.count} locker${r.count === 1 ? "" : "s"}.` };
}

export async function deleteLocker(lockerId: string) {
  const { gymId } = await requireTenant("gym:manage");
  await db.locker.deleteMany({ where: { id: lockerId, gymId, memberId: null } });
  revalidatePath("/lockers");
}

// Assigns a locker; a fee raises an invoice so it shows under the member's dues like any other charge.
export async function assignLocker(lockerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("members:write");
  const parsed = lockerAssignInput.safeParse(fields(formData, ["memberId", "months", "feePaise"]));
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { memberId, months, feePaise } = parsed.data;
  const result = await db.$transaction(async (tx) => {
    const [locker, member] = await Promise.all([
      tx.locker.findFirst({ where: { id: lockerId, gymId } }),
      tx.member.findFirst({ where: { id: memberId, gymId }, select: { id: true, firstName: true, locker: { select: { number: true } } } }),
    ]);
    if (!locker) return { message: "Locker not found" };
    if (locker.memberId) return { message: `Locker ${locker.number} is already taken` };
    if (!member) return { errors: { memberId: "Member not found" } };
    if (member.locker) return { errors: { memberId: `${member.firstName} already has locker ${member.locker.number}` } };
    const now = new Date();
    await tx.locker.update({ where: { id: locker.id }, data: { memberId, assignedAt: now, until: addMonths(now, months), feePaise } });
    const invoiceId = feePaise > 0 ? await raiseCharge(tx, gymId, memberId, `Locker ${locker.number} rent, ${months} month${months === 1 ? "" : "s"}`, feePaise, false) : null;
    return { ok: true, number: locker.number, name: member.firstName, invoiceId };
  });
  if (!("ok" in result)) return result;
  await audit(gymId, userId, "locker.assign", "member", memberId, `Assigned locker ${result.number} to ${result.name} for ${months} month(s)${feePaise ? `, billed Rs ${feePaise / 100}` : ""}`);
  revalidatePath("/lockers");
  revalidatePath(`/members/${memberId}`);
  if (result.invoiceId) revalidatePath(`/invoices/${result.invoiceId}`);
  return {};
}

export async function releaseLocker(lockerId: string) {
  const { gymId, userId } = await requireTenant("members:write");
  const l = await db.locker.findFirst({ where: { id: lockerId, gymId }, select: { number: true, memberId: true } });
  if (!l?.memberId) return;
  await db.locker.update({ where: { id: lockerId }, data: { memberId: null, assignedAt: null, until: null } });
  await audit(gymId, userId, "locker.release", "member", l.memberId, `Released locker ${l.number}`);
  revalidatePath("/lockers");
  revalidatePath(`/members/${l.memberId}`);
}
