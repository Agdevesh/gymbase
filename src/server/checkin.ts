"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DEFAULT_VISIT_MINUTES, GATE_MESSAGES, STALE_VISIT_HOURS, entryGate, inGymSince, searchInput, tokenFromScan } from "@/lib/checkin";
import { normalizePhone } from "@/lib/members";
import { expireMemberships } from "@/server/memberships";
import { requireTenant } from "@/server/tenant";

export type Candidate = {
  id: string; code: string; name: string; phone: string; photoUrl: string | null;
  plan: string | null; endDate: Date | null; status: string | null; allowed: boolean; blockedReason: string | null; inGym: boolean;
};

const memberSelect = {
  id: true, code: true, firstName: true, lastName: true, phone: true, photoUrl: true,
  memberships: { where: { status: { in: ["ACTIVE", "FROZEN", "SUSPENDED", "EXPIRED"] } }, orderBy: { endDate: "desc" }, take: 1, select: { status: true, endDate: true, plan: { select: { name: true } } } },
  checkIns: { where: { checkedOutAt: null }, orderBy: { checkedInAt: "desc" }, take: 1, select: { checkedInAt: true } },
} satisfies Prisma.MemberSelect;

function toCandidate(m: { id: string; code: string; firstName: string; lastName: string | null; phone: string; photoUrl: string | null; memberships: { status: string; endDate: Date; plan: { name: string } }[]; checkIns: { checkedInAt: Date }[] }, now: Date): Candidate {
  const ms = m.memberships[0];
  const gate = entryGate(ms, now);
  return {
    id: m.id, code: m.code, name: [m.firstName, m.lastName].filter(Boolean).join(" "), phone: m.phone, photoUrl: m.photoUrl,
    plan: ms?.plan.name ?? null, endDate: ms?.endDate ?? null, status: ms?.status ?? null,
    allowed: gate.allowed, blockedReason: gate.allowed ? null : GATE_MESSAGES[gate.reason],
    inGym: !!m.checkIns[0] && m.checkIns[0].checkedInAt >= inGymSince(now),
  };
}

export async function searchForCheckIn(raw: string): Promise<Candidate[]> {
  const { gymId } = await requireTenant("checkin:write");
  const q = searchInput.parse(raw);
  if (!q) return [];
  const now = new Date();
  const token = tokenFromScan(q);
  const phone = normalizePhone(q);
  const members = await db.member.findMany({
    where: token ? { gymId, qrToken: token } : {
      gymId,
      OR: [
        { firstName: { startsWith: q, mode: "insensitive" } },
        { lastName: { startsWith: q, mode: "insensitive" } },
        { code: { contains: q.toUpperCase() } },
        { phone: { contains: phone ?? (q.replace(/\D/g, "") || q) } },
      ],
    },
    orderBy: [{ firstName: "asc" }],
    take: 8,
    select: memberSelect,
  });
  return members.map((m) => toCandidate(m, now));
}

export type CheckInResult = { ok: true; name: string; already?: boolean } | { ok: false; name?: string; message: string };

export async function checkInMember(memberId: string): Promise<CheckInResult> {
  const { gymId, userId } = await requireTenant("checkin:write");
  await expireMemberships(gymId);
  const now = new Date();
  const m = await db.member.findFirst({ where: { id: memberId, gymId }, select: memberSelect });
  if (!m) return { ok: false, message: "Member not found" };
  const c = toCandidate(m, now);
  if (!c.allowed) return { ok: false, name: c.name, message: c.blockedReason! };
  if (c.inGym) return { ok: true, name: c.name, already: true };
  await db.checkIn.create({ data: { gymId, memberId, source: "RECEPTION", loggedById: userId } });
  revalidatePath("/checkin");
  return { ok: true, name: c.name };
}

export async function checkInByToken(token: string): Promise<CheckInResult> {
  const { gymId } = await requireTenant("checkin:write");
  const m = await db.member.findFirst({ where: { gymId, qrToken: token }, select: { id: true } });
  if (!m) return { ok: false, message: "QR code not recognised" };
  const r = await checkInMember(m.id);
  if (r.ok && !r.already) await db.checkIn.updateMany({ where: { gymId, memberId: m.id, checkedOutAt: null }, data: { source: "QR" } });
  return r;
}

export async function checkOut(checkInId: string) {
  const { gymId } = await requireTenant("checkin:write");
  await db.checkIn.updateMany({ where: { id: checkInId, gymId, checkedOutAt: null }, data: { checkedOutAt: new Date() } });
  revalidatePath("/checkin");
}

// Visits nobody checked out of are closed after STALE_VISIT_HOURS with a default duration (called from the daily cron).
export async function closeStaleCheckIns() {
  const stale = await db.checkIn.findMany({ where: { checkedOutAt: null, checkedInAt: { lt: new Date(Date.now() - STALE_VISIT_HOURS * 3600_000) } }, select: { id: true, checkedInAt: true } });
  for (const c of stale) await db.checkIn.update({ where: { id: c.id }, data: { checkedOutAt: new Date(c.checkedInAt.getTime() + DEFAULT_VISIT_MINUTES * 60_000) } });
  return stale.length;
}
