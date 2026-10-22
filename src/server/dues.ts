import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { suspendCutoff, suspendReason } from "@/lib/dues";
import { audit } from "@/server/audit";

type Tx = Prisma.TransactionClient;

// Suspends ACTIVE memberships of members whose dues have stayed unpaid longer than the gym allows.
// Runs daily from the cron for every gym, and on dashboard loads for one gym. Idempotent.
export async function suspendDefaulters(gymId?: string) {
  const gyms = await db.gym.findMany({ where: { ...(gymId && { id: gymId }), autoSuspendEnabled: true }, select: { id: true, autoSuspendDays: true } });
  const now = new Date();
  let total = 0;
  for (const gym of gyms) {
    const cutoff = suspendCutoff(now, gym.autoSuspendDays);
    const overdue = await db.invoice.findMany({
      where: { gymId: gym.id, paidPaise: { lt: db.invoice.fields.totalPaise }, OR: [{ dueDate: { lt: cutoff } }, { dueDate: null, issuedAt: { lt: cutoff } }] },
      select: { memberId: true },
      distinct: ["memberId"],
    });
    if (overdue.length === 0) continue;
    const memberIds = overdue.map((i) => i.memberId);
    const targets = await db.membership.findMany({ where: { gymId: gym.id, memberId: { in: memberIds }, status: "ACTIVE" }, select: { id: true, memberId: true, member: { select: { firstName: true, lastName: true } } } });
    if (targets.length === 0) continue;
    const reason = suspendReason(gym.autoSuspendDays);
    await db.membership.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { status: "SUSPENDED", suspendedAt: now, suspendReason: reason } });
    for (const t of targets) await audit(gym.id, null, "membership.auto_suspend", "member", t.memberId, `${[t.member.firstName, t.member.lastName].filter(Boolean).join(" ")}: membership suspended. ${reason}.`);
    total += targets.length;
  }
  return total;
}

// After a payment: if the member owes nothing more, any suspended membership comes back (ACTIVE, or EXPIRED if its end date has passed).
export async function restoreIfSettled(tx: Tx, gymId: string, memberId: string, userId: string | null) {
  const owed = await tx.invoice.count({ where: { gymId, memberId, paidPaise: { lt: tx.invoice.fields.totalPaise } } });
  if (owed > 0) return 0;
  const suspended = await tx.membership.findMany({ where: { gymId, memberId, status: "SUSPENDED" }, select: { id: true, endDate: true } });
  const now = new Date();
  for (const m of suspended) {
    await tx.membership.update({ where: { id: m.id }, data: { status: m.endDate < now ? "EXPIRED" : "ACTIVE", suspendedAt: null, suspendReason: null } });
  }
  if (suspended.length) await audit(gymId, userId, "membership.restore", "member", memberId, "Dues cleared, membership restored automatically.");
  return suspended.length;
}
