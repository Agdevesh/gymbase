"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { BOOK_AHEAD_DAYS, classInput, dateKey, dbDate, runsOn, startsAt } from "@/lib/classes";
import { audit } from "@/server/audit";
import { requireMember } from "@/server/portal";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";
import type { BookingStatus } from "@prisma/client";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function readClass(fd: FormData) {
  return classInput.safeParse({ name: str(fd, "name"), trainerId: str(fd, "trainerId"), weekdays: fd.getAll("weekdays").map(String), startTime: str(fd, "startTime"), durationMin: str(fd, "durationMin"), capacity: str(fd, "capacity"), notes: str(fd, "notes"), active: fd.getAll("active").includes("on") ? "on" : "off" });
}

export async function saveClass(classId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("gym:manage");
  const parsed = readClass(formData);
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const data = parsed.data;
  if (data.trainerId && !(await db.user.findFirst({ where: { id: data.trainerId, gymId, active: true }, select: { id: true } }))) return { errors: { trainerId: "Trainer not found" } };
  if (classId) await db.gymClass.updateMany({ where: { id: classId, gymId }, data });
  else await db.gymClass.create({ data: { ...data, gymId } });
  await audit(gymId, userId, classId ? "class.update" : "class.create", "class", classId, `${classId ? "Updated" : "Added"} class ${data.name} at ${data.startTime}`);
  revalidatePath("/classes");
  return {};
}

// Reception books a member into a dated session; capacity and schedule are checked inside the transaction.
export async function bookMember(classId: string, dayKey: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId } = await requireTenant("members:write");
  const memberId = str(formData, "memberId");
  if (!memberId) return { errors: { memberId: "Pick a member" } };
  const r = await book(gymId, classId, dayKey, memberId);
  if (r.error) return { errors: { memberId: r.error } };
  await audit(gymId, userId, "class.book", "member", memberId, `Booked into ${r.name} on ${dayKey}`);
  revalidatePath(`/classes/${classId}`);
  return {};
}

async function book(gymId: string, classId: string, dayKey: string, memberId: string): Promise<{ error?: string; name?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return { error: "Bad date" };
  return db.$transaction(async (tx) => {
    const cls = await tx.gymClass.findFirst({ where: { id: classId, gymId, active: true }, include: { _count: { select: { bookings: { where: { date: dbDate(dayKey), status: { in: ["BOOKED", "ATTENDED"] } } } } } } });
    if (!cls) return { error: "Class not found" };
    if (!runsOn(cls, dayKey)) return { error: "No session that day" };
    if (startsAt(dayKey, cls.startTime).getTime() + cls.durationMin * 60_000 < Date.now()) return { error: "That session is over" };
    const member = await tx.member.findFirst({ where: { id: memberId, gymId }, select: { id: true, memberships: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } } });
    if (!member) return { error: "Member not found" };
    if (!member.memberships.length) return { error: "Member has no active plan" };
    const existing = await tx.classBooking.findUnique({ where: { classId_memberId_date: { classId, memberId, date: dbDate(dayKey) } } });
    if (existing && existing.status !== "CANCELLED") return { error: "Already booked" };
    if (cls._count.bookings >= cls.capacity) return { error: "Class is full" };
    if (existing) await tx.classBooking.update({ where: { id: existing.id }, data: { status: "BOOKED" } });
    else await tx.classBooking.create({ data: { gymId, classId, memberId, date: dbDate(dayKey) } });
    return { name: cls.name };
  });
}

export async function setBookingStatus(bookingId: string, status: BookingStatus) {
  const { gymId } = await requireTenant("attendance:write");
  const b = await db.classBooking.findFirst({ where: { id: bookingId, gymId }, select: { classId: true } });
  if (!b) return;
  await db.classBooking.update({ where: { id: bookingId }, data: { status } });
  revalidatePath(`/classes/${b.classId}`);
}

// ---------- Member portal ----------

export async function memberBook(classId: string, dayKey: string) {
  const { member, gym } = await requireMember();
  const today = new Date(), limit = new Date(today.getTime() + BOOK_AHEAD_DAYS * 86400_000);
  if (dayKey < dateKey(today) || dayKey > dateKey(limit)) return;
  await book(gym.id, classId, dayKey, member.id);
  revalidatePath("/me/classes");
}

export async function memberCancel(bookingId: string) {
  const { member } = await requireMember();
  const b = await db.classBooking.findFirst({ where: { id: bookingId, memberId: member.id, status: "BOOKED" }, include: { class: { select: { startTime: true } } } });
  if (!b) return;
  // Cancelling less than an hour before the start keeps the seat as a no-show so repeat offenders are visible.
  const starts = startsAt(dateKey(new Date(b.date.getTime() + 12 * 3600_000)), b.class.startTime);
  await db.classBooking.update({ where: { id: b.id }, data: { status: starts.getTime() - Date.now() < 3600_000 ? "NO_SHOW" : "CANCELLED" } });
  revalidatePath("/me/classes");
}
