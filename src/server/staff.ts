"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendMessage } from "@/lib/messaging";
import { acceptInput, commissionFor, commissionInput, inviteInput, percentInput, periodOf, ptAssignInput, localDay } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { audit } from "@/server/audit";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// ---------- Invites ----------

export type InviteState = (FormState & { link?: string }) | undefined;

export async function inviteStaff(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { gymId, userId } = await requireTenant("staff:manage");
  const parsed = inviteInput.safeParse({ email: str(formData, "email"), role: str(formData, "role") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { email, role } = parsed.data;
  const [sub, staffCount, existing] = await Promise.all([
    db.subscription.findUnique({ where: { gymId } }),
    db.user.count({ where: { gymId, role: { in: ["RECEPTION", "TRAINER"] }, active: true } }),
    db.user.findUnique({ where: { gymId_email: { gymId, email } }, select: { id: true } }),
  ]);
  if (existing) return { errors: { email: "This email already has a login here" } };
  if (sub && staffCount >= sub.staffLimit) return { message: `Your GYMBASE plan allows ${sub.staffLimit} staff logins. Upgrade to add more.` };
  const invite = await db.invite.create({
    data: { gymId, email, role, token: randomBytes(24).toString("hex"), invitedBy: userId, expiresAt: new Date(Date.now() + 7 * 86400_000) },
  });
  const base = process.env.AUTH_URL ?? "";
  const link = `${base}/invite/${invite.token}`;
  const gym = await db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { name: true } });
  // Email goes out when a provider is configured; the link is always shown so the owner can WhatsApp it.
  await sendMessage("EMAIL", email, `You have been invited to join ${gym.name} on GYMBASE as ${role.toLowerCase()}. Set up your login here: ${link}`, `Join ${gym.name} on GYMBASE`);
  revalidatePath("/staff");
  return { link };
}

export async function revokeInvite(inviteId: string) {
  const { gymId } = await requireTenant("staff:manage");
  await db.invite.deleteMany({ where: { id: inviteId, gymId, acceptedAt: null } });
  revalidatePath("/staff");
}

// Public: the invitee has no session yet, so the token is the only credential.
export async function acceptInvite(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptInput.safeParse({ name: str(formData, "name"), phone: str(formData, "phone"), password: str(formData, "password") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const invite = await db.invite.findUnique({ where: { token }, include: { gym: { select: { slug: true } } } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return { message: "This invite link is invalid or has expired. Ask the owner for a new one." };
  try {
    await db.$transaction(async (tx) => {
      await tx.user.create({ data: { gymId: invite.gymId, email: invite.email, name: parsed.data.name, phone: parsed.data.phone, role: invite.role, passwordHash: await hash(parsed.data.password, 10) } });
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { message: "A login with this email already exists. Sign in instead." };
    throw e;
  }
  redirect(`/login?gym=${invite.gym.slug}&email=${encodeURIComponent(invite.email)}&joined=1`);
}

// ---------- Staff accounts ----------

export async function setStaffActive(staffId: string, active: boolean) {
  const { gymId, userId } = await requireTenant("staff:manage");
  if (staffId === userId) return;
  await db.user.updateMany({ where: { id: staffId, gymId, role: { not: "MEMBER" } }, data: { active } });
  await audit(gymId, userId, active ? "staff.reactivate" : "staff.deactivate", "user", staffId, `${active ? "Reactivated" : "Deactivated"} a staff login`);
  revalidatePath("/staff");
}

export async function setCommissionPercent(staffId: string, formData: FormData) {
  const { gymId } = await requireTenant("staff:manage");
  const pct = percentInput.safeParse(str(formData, "percent"));
  if (!pct.success) return;
  await db.user.updateMany({ where: { id: staffId, gymId }, data: { commissionPercent: pct.data } });
  revalidatePath("/staff");
}

// ---------- Staff attendance ----------

export async function staffMarkIn(staffId?: string) {
  const { gymId, userId, role } = await requireTenant();
  const target = staffId && staffId !== userId ? (role === "OWNER" ? staffId : null) : userId;
  if (!target) return;
  const now = new Date();
  await db.staffAttendance.upsert({
    where: { gymId_userId_date: { gymId, userId: target, date: localDay(now) } },
    create: { gymId, userId: target, date: localDay(now), inAt: now },
    update: {},
  });
  revalidatePath("/staff");
}

export async function staffMarkOut(staffId?: string) {
  const { gymId, userId, role } = await requireTenant();
  const target = staffId && staffId !== userId ? (role === "OWNER" ? staffId : null) : userId;
  if (!target) return;
  await db.staffAttendance.updateMany({ where: { gymId, userId: target, date: localDay(new Date()), outAt: null }, data: { outAt: new Date() } });
  revalidatePath("/staff");
}

// ---------- Personal training ----------

export async function assignPt(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("members:write");
  const parsed = ptAssignInput.safeParse({ trainerId: str(formData, "trainerId"), sessionsTotal: str(formData, "sessionsTotal"), feePaise: str(formData, "feePaise"), membershipId: str(formData, "membershipId"), startDate: str(formData, "startDate") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const { trainerId, sessionsTotal, feePaise, membershipId, startDate } = parsed.data;
  const [member, trainer, membership] = await Promise.all([
    db.member.findFirst({ where: { id: memberId, gymId }, select: { firstName: true, lastName: true } }),
    db.user.findFirst({ where: { id: trainerId, gymId, role: { in: ["TRAINER", "OWNER"] }, active: true }, select: { id: true, commissionPercent: true } }),
    membershipId ? db.membership.findFirst({ where: { id: membershipId, gymId, memberId }, select: { id: true } }) : null,
  ]);
  if (!member) return { message: "Member not found" };
  if (!trainer) return { errors: { trainerId: "Choose an active trainer" } };
  if (membershipId && !membership) return { errors: { membershipId: "Membership not found" } };
  await db.$transaction(async (tx) => {
    const a = await tx.ptAssignment.create({ data: { gymId, memberId, trainerId, sessionsTotal, feePaise, membershipId, startDate } });
    const commission = commissionFor(feePaise, trainer.commissionPercent);
    if (commission > 0) {
      await tx.commission.create({ data: { gymId, userId: trainerId, amountPaise: commission, reason: `PT ${[member.firstName, member.lastName].filter(Boolean).join(" ")} (${sessionsTotal} sessions)`, period: periodOf(new Date()), ptAssignmentId: a.id } });
    }
  });
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/staff/pt");
  revalidatePath("/staff/commissions");
  return {};
}

export async function logPtSession(assignmentId: string, formData: FormData) {
  const { gymId, userId, role } = await requireTenant("checkin:write");
  const a = await db.ptAssignment.findFirst({ where: { id: assignmentId, gymId }, select: { trainerId: true, memberId: true, sessionsTotal: true, sessionsUsed: true } });
  if (!a || a.sessionsUsed >= a.sessionsTotal) return;
  if (role === "TRAINER" && a.trainerId !== userId) return; // trainers log only their own clients
  const notes = str(formData, "notes").trim() || null;
  await db.$transaction([
    db.ptSession.create({ data: { assignmentId, trainerId: role === "TRAINER" ? userId : a.trainerId, notes } }),
    db.ptAssignment.update({ where: { id: assignmentId }, data: { sessionsUsed: { increment: 1 }, ...(a.sessionsUsed + 1 >= a.sessionsTotal && { endDate: new Date() }) } }),
  ]);
  revalidatePath(`/members/${a.memberId}`);
  revalidatePath("/staff/pt");
}

export async function endPt(assignmentId: string) {
  const { gymId } = await requireTenant("members:write");
  const a = await db.ptAssignment.findFirst({ where: { id: assignmentId, gymId }, select: { memberId: true } });
  if (!a) return;
  await db.ptAssignment.update({ where: { id: assignmentId }, data: { endDate: new Date() } });
  revalidatePath(`/members/${a.memberId}`);
  revalidatePath("/staff/pt");
}

// ---------- Commissions ----------

export async function addCommission(_prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId } = await requireTenant("staff:manage");
  const parsed = commissionInput.safeParse({ userId: str(formData, "userId"), amountPaise: str(formData, "amountPaise"), reason: str(formData, "reason"), period: str(formData, "period") });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const staff = await db.user.findFirst({ where: { id: parsed.data.userId, gymId }, select: { id: true } });
  if (!staff) return { errors: { userId: "Staff not found" } };
  await db.commission.create({ data: { gymId, ...parsed.data } });
  revalidatePath("/staff/commissions");
  return {};
}

export async function markCommissionsPaid(userId: string, period: string) {
  const { gymId } = await requireTenant("staff:manage");
  await db.commission.updateMany({ where: { gymId, userId, period, paidAt: null }, data: { paidAt: new Date() } });
  revalidatePath("/staff/commissions");
}

export async function deleteCommission(id: string) {
  const { gymId } = await requireTenant("staff:manage");
  await db.commission.deleteMany({ where: { id, gymId, paidAt: null } });
  revalidatePath("/staff/commissions");
}
