"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { expandSlots, fmtSlot, overlaps, slotInput } from "@/lib/pt";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { errors };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
function refresh(memberId: string) { revalidatePath(`/members/${memberId}`); revalidatePath("/staff/pt"); revalidatePath("/staff/pt/schedule"); revalidatePath("/me"); }

// Books one or a weekly series of PT slots; refuses trainer clashes and more slots than sessions left.
export async function scheduleSlots(assignmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { gymId, userId, role } = await requireTenant("checkin:write");
  const parsed = slotInput.safeParse({ date: str(formData, "date"), time: str(formData, "time"), durationMin: str(formData, "durationMin"), repeatWeeks: str(formData, "repeatWeeks"), weekdays: formData.getAll("weekdays").map(String) });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  const a = await db.ptAssignment.findFirst({ where: { id: assignmentId, gymId, endDate: null }, include: { member: { select: { firstName: true } }, _count: { select: { slots: { where: { status: "SCHEDULED" } } } } } });
  if (!a) return { message: "PT assignment not found or finished" };
  if (role === "TRAINER" && a.trainerId !== userId) return { message: "Not your client" };
  const times = expandSlots(parsed.data);
  const left = a.sessionsTotal - a.sessionsUsed - a._count.slots;
  if (times.length > left) return { errors: { repeatWeeks: `Only ${Math.max(0, left)} unscheduled session${left === 1 ? "" : "s"} left on this plan` } };
  const from = times[0], to = new Date(times[times.length - 1].getTime() + parsed.data.durationMin * 60_000);
  const busy = await db.ptSlot.findMany({ where: { trainerId: a.trainerId, status: "SCHEDULED", at: { gte: new Date(from.getTime() - 3 * 3600_000), lte: to } }, select: { at: true, durationMin: true } });
  const clash = times.find((t) => busy.some((b) => overlaps(t, parsed.data.durationMin, b.at, b.durationMin)));
  if (clash) return { errors: { time: `Trainer already has a slot at ${fmtSlot(clash)}` } };
  await db.ptSlot.createMany({ data: times.map((at) => ({ gymId, assignmentId, trainerId: a.trainerId, memberId: a.memberId, at, durationMin: parsed.data.durationMin })) });
  await audit(gymId, userId, "pt.schedule", "member", a.memberId, `Scheduled ${times.length} PT slot${times.length === 1 ? "" : "s"} for ${a.member.firstName} from ${fmtSlot(from)}`);
  refresh(a.memberId);
  return {};
}

async function loadSlot(slotId: string, gymId: string, userId: string, role: string) {
  const s = await db.ptSlot.findFirst({ where: { id: slotId, gymId }, include: { assignment: { select: { sessionsTotal: true, sessionsUsed: true } } } });
  if (!s || s.status !== "SCHEDULED") return null;
  if (role === "TRAINER" && s.trainerId !== userId) return null;
  return s;
}

// Done = the session happened: log it against the plan exactly like the manual "Log session" button.
export async function completeSlot(slotId: string, formData: FormData) {
  const { gymId, userId, role } = await requireTenant("checkin:write");
  const s = await loadSlot(slotId, gymId, userId, role);
  if (!s) return;
  const notes = str(formData, "notes").trim() || null;
  await db.$transaction(async (tx) => {
    const session = await tx.ptSession.create({ data: { assignmentId: s.assignmentId, trainerId: s.trainerId, at: s.at, notes } });
    await tx.ptSlot.update({ where: { id: s.id }, data: { status: "DONE", sessionId: session.id, notes } });
    const used = s.assignment.sessionsUsed + 1;
    await tx.ptAssignment.update({ where: { id: s.assignmentId }, data: { sessionsUsed: used, ...(used >= s.assignment.sessionsTotal && { endDate: new Date() }) } });
  });
  refresh(s.memberId);
}

export async function markSlot(slotId: string, status: "NO_SHOW" | "CANCELLED") {
  const { gymId, userId, role } = await requireTenant("checkin:write");
  const s = await loadSlot(slotId, gymId, userId, role);
  if (!s) return;
  await db.ptSlot.update({ where: { id: s.id }, data: { status } });
  await audit(gymId, userId, status === "NO_SHOW" ? "pt.no_show" : "pt.cancel", "member", s.memberId, `${status === "NO_SHOW" ? "No-show" : "Cancelled"} PT slot ${fmtSlot(s.at)}`);
  refresh(s.memberId);
}
