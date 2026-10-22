import Link from "next/link";
import { db } from "@/lib/db";
import { daysSince, paise } from "@/lib/payments";
import { requireTenant } from "@/server/tenant";
import { expireMemberships } from "@/server/memberships";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";

// The owner's main "who owes us" screen: unpaid invoices, and expired members who have not renewed.
export default async function DefaultersPage() {
  const { gymId } = await requireTenant("payments:write");
  await expireMemberships(gymId);
  const now = new Date();
  const members = await db.member.findMany({
    where: { gymId, OR: [{ invoices: { some: { paidPaise: { lt: db.invoice.fields.totalPaise } } } }, { memberships: { none: { status: { in: ["ACTIVE", "FROZEN"] } } } }] },
    select: {
      id: true, firstName: true, lastName: true, phone: true, photoUrl: true, code: true,
      invoices: { select: { totalPaise: true, paidPaise: true, dueDate: true, issuedAt: true } },
      memberships: { orderBy: { endDate: "desc" }, take: 1, select: { status: true, endDate: true, plan: { select: { name: true } } } },
    },
  });
  const rows = members.map((m) => {
    const unpaid = m.invoices.filter((i) => i.totalPaise > i.paidPaise);
    const due = unpaid.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0);
    const since = unpaid.length ? new Date(Math.min(...unpaid.map((i) => (i.dueDate ?? i.issuedAt).getTime()))) : null;
    const last = m.memberships[0];
    return { ...m, name: [m.firstName, m.lastName].filter(Boolean).join(" "), due, dueDays: since ? daysSince(since, now) : 0, last, expiredDays: last && last.status !== "ACTIVE" && last.status !== "FROZEN" ? daysSince(last.endDate, now) : null };
  });
  const dues = rows.filter((r) => r.due > 0).sort((a, b) => b.dueDays - a.dueDays);
  const lapsed = rows.filter((r) => r.due === 0 && r.last && r.expiredDays !== null).sort((a, b) => (a.expiredDays ?? 0) - (b.expiredDays ?? 0));
  const totalDue = dues.reduce((s, r) => s + r.due, 0);

  const Row = ({ r, days, label, amount }: { r: (typeof rows)[number]; days: number; label: string; amount?: number }) => (
    <li>
      <Link href={`/members/${r.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
        <Avatar name={r.name} photoUrl={r.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{r.name} <span className="font-normal text-slate-400">{r.code}</span></div>
          <div className="truncate text-sm text-slate-500">{r.phone} · {r.last ? `${r.last.plan.name} till ${r.last.endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "no plan"}</div>
        </div>
        <div className="text-right">
          {amount !== undefined && <div className="font-semibold text-red-700">{paise(amount)}</div>}
          <div className={`text-sm ${days > 30 ? "text-red-700" : days > 7 ? "text-amber-700" : "text-slate-500"}`}>{days} {days === 1 ? "day" : "days"} {label}</div>
        </div>
      </Link>
    </li>
  );

  return (
    <AppShell title="Defaulters" actions={<span className="text-lg font-semibold text-red-700">{paise(totalDue)} due</span>}>
      <h2 className="mb-2 font-semibold text-slate-900">Unpaid dues ({dues.length})</h2>
      {dues.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-sm text-slate-500">Nobody owes money.</p> : <ul className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">{dues.map((r) => <Row key={r.id} r={r} days={r.dueDays} label="overdue" amount={r.due} />)}</ul>}
      <h2 className="mb-2 mt-6 font-semibold text-slate-900">Expired, not renewed ({lapsed.length})</h2>
      {lapsed.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-sm text-slate-500">Every member has an active plan.</p> : <ul className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">{lapsed.map((r) => <Row key={r.id} r={r} days={r.expiredDays ?? 0} label="since expiry" />)}</ul>}
    </AppShell>
  );
}
