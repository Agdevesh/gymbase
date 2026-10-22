"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activityInput, leadFields, leadInput, splitName } from "@/lib/leads";
import { formatMemberCode } from "@/lib/members";
import { memberLimitError, requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}

const readLead = (fd: FormData) => leadInput.safeParse(Object.fromEntries(leadFields.map((f) => [f, String(fd.get(f) ?? "")])));

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("leads:write");
  const parsed = readLead(formData);
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const existing = await db.member.findFirst({ where: { gymId, phone: parsed.data.phone }, select: { id: true, firstName: true } });
  if (existing) return { errors: { phone: `${existing.firstName} is already a member with this phone` } };
  const lead = await db.lead.create({ data: { ...parsed.data, gymId, ownerId: userId }, select: { id: true } });
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLead(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("leads:write");
  const parsed = readLead(formData);
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { count } = await db.lead.updateMany({ where: { id: leadId, gymId }, data: parsed.data });
  if (count === 0) return { message: "Lead not found" };
  revalidatePath("/leads");
  redirect(`/leads/${leadId}`);
}

// Follow-up form: note + optional stage change + next follow-up date, written as one activity row.
export async function logActivity(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("leads:write");
  const parsed = activityInput.safeParse({
    note: String(formData.get("note") ?? ""), status: String(formData.get("status") ?? ""),
    followUpAt: String(formData.get("followUpAt") ?? ""), lostReason: String(formData.get("lostReason") ?? ""),
  });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { note, status, followUpAt, lostReason } = parsed.data;
  const lead = await db.lead.findFirst({ where: { id: leadId, gymId }, select: { status: true, followUpAt: true } });
  if (!lead) return { message: "Lead not found" };
  if (status === "CONVERTED") return { errors: { status: "Use Convert to member instead" } };
  const parts = [note];
  if (status && status !== lead.status) parts.push(`Stage → ${status.toLowerCase()}${status === "LOST" && lostReason ? ` (${lostReason})` : ""}`);
  if (followUpAt) parts.push(`Next follow-up ${followUpAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`);
  await db.$transaction([
    db.lead.update({
      where: { id: leadId },
      data: {
        ...(status && { status }),
        ...(status === "LOST" && { lostReason, followUpAt: null }),
        ...(followUpAt && status !== "LOST" && { followUpAt }),
        // A note without a new date clears a follow-up that was due, so it stops showing as overdue.
        ...(!followUpAt && status !== "LOST" && lead.followUpAt && lead.followUpAt <= new Date() && { followUpAt: null }),
      },
    }),
    db.leadActivity.create({ data: { leadId, authorId: userId, note: parts.filter(Boolean).join(" · ") } }),
  ]);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

// One click: the lead becomes a member (or is linked to an existing member with the same phone), then reception starts a plan.
export async function convertLead(leadId: string) {
  const { gymId } = await requireTenant("members:write");
  const lead = await db.lead.findFirst({ where: { id: leadId, gymId }, include: { member: { select: { id: true } } } });
  if (!lead) return;
  if (lead.member) redirect(`/members/${lead.member.id}`);
  const existingByPhone = await db.member.findFirst({ where: { gymId, phone: lead.phone }, select: { id: true } });
  if (!existingByPhone && (await memberLimitError(gymId))) redirect(`/billing?locked=1`);
  const memberId = await db.$transaction(async (tx) => {
    const existing = await tx.member.findFirst({ where: { gymId, phone: lead.phone }, select: { id: true, leadId: true } });
    let id: string;
    if (existing) {
      id = existing.id;
      if (!existing.leadId) await tx.member.update({ where: { id }, data: { leadId: lead.id } });
    } else {
      const gym = await tx.gym.update({ where: { id: gymId }, data: { memberSeq: { increment: 1 } }, select: { memberSeq: true } });
      const m = await tx.member.create({
        data: { gymId, ...splitName(lead.name), phone: lead.phone, email: lead.email, notes: lead.notes, leadId: lead.id, code: formatMemberCode(gym.memberSeq), qrToken: randomBytes(16).toString("hex") },
        select: { id: true },
      });
      id = m.id;
    }
    await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED", followUpAt: null } });
    await tx.leadActivity.create({ data: { leadId: lead.id, note: existing ? "Linked to existing member" : "Converted to member" } });
    return id;
  }).catch((e) => { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null; throw e; });
  revalidatePath("/leads");
  revalidatePath("/members");
  if (memberId) redirect(`/members/${memberId}?from=lead`);
}
