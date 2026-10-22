import Link from "next/link";
import { db } from "@/lib/db";
import { SOURCE_LABELS } from "@/lib/leads";
import { METHOD_LABELS, paise } from "@/lib/payments";
import { CATEGORY_LABELS, monthRange, pct, renewalRate, sumBy, visitHistogram } from "@/lib/reports";
import { WEEKDAYS } from "@/lib/classes";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

function Bars({ values, labels, highlight }: { values: number[]; labels: string[]; highlight?: (i: number) => boolean }) {
  const max = Math.max(1, ...values);
  return (
    <svg viewBox={`0 0 ${values.length * 14} 60`} className="h-20 w-full" role="img">
      {values.map((v, i) => { const h = Math.round((v / max) * 44); return <g key={i}><rect x={i * 14 + 2} y={48 - h} width={10} height={h} rx={1} className={highlight?.(i) ? "fill-green-600" : "fill-neutral-800"} /><text x={i * 14 + 7} y={57} textAnchor="middle" fontSize={6} className="fill-neutral-500">{labels[i]}</text></g>; })}
    </svg>
  );
}
const Row = ({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: string }) => <div className={`flex justify-between py-1 text-sm ${strong ? "font-semibold" : ""} ${tone ?? ""}`}><span>{k}</span><span>{v}</span></div>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { gymId } = await requireTenant("reports:read");
  const { month = "" } = await searchParams;
  const r = monthRange(month);
  const now = new Date(), since30 = new Date(now.getTime() - 30 * 86400_000);
  const [payments, expenses, endedMemberships, newMembers, activeNow, visits, leads, sixMonths, invoicesDue, staffPt] = await Promise.all([
    db.payment.findMany({ where: { gymId, paidAt: { gte: r.start, lt: r.end } }, select: { amountPaise: true, kind: true, method: true, invoice: { select: { membership: { select: { plan: { select: { name: true } } } }, notes: true } } } }),
    db.expense.findMany({ where: { gymId, paidAt: { gte: r.start, lt: r.end } }, select: { amountPaise: true, category: true } }),
    db.membership.findMany({ where: { gymId, endDate: { gte: r.start, lt: r.end }, status: { in: ["EXPIRED", "ACTIVE", "FROZEN"] } }, select: { renewedTo: { select: { id: true } } } }),
    db.member.count({ where: { gymId, joinedAt: { gte: r.start, lt: r.end } } }),
    db.membership.count({ where: { gymId, status: { in: ["ACTIVE", "FROZEN"] } } }),
    db.checkIn.findMany({ where: { gymId, checkedInAt: { gte: since30 } }, select: { checkedInAt: true, memberId: true } }),
    db.lead.findMany({ where: { gymId, createdAt: { gte: r.start, lt: r.end } }, select: { source: true, status: true } }),
    db.member.groupBy({ by: ["joinedAt"], where: { gymId, joinedAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } }, _count: true }),
    db.invoice.aggregate({ where: { gymId, paidPaise: { lt: db.invoice.fields.totalPaise } }, _sum: { totalPaise: true, paidPaise: true } }),
    db.ptSession.groupBy({ by: ["trainerId"], where: { assignment: { gymId }, at: { gte: r.start, lt: r.end } }, _count: true }),
  ]);
  const trainers = staffPt.length ? await db.user.findMany({ where: { id: { in: staffPt.map((s) => s.trainerId) } }, select: { id: true, name: true } }) : [];
  const collected = payments.filter((p) => p.kind === "PAYMENT").reduce((s, p) => s + p.amountPaise, 0);
  const refunded = payments.filter((p) => p.kind === "REFUND").reduce((s, p) => s + p.amountPaise, 0);
  const spent = expenses.reduce((s, e) => s + e.amountPaise, 0);
  const net = collected - refunded - spent;
  const byMethod = sumBy(payments, (p) => p.method, (p) => (p.kind === "REFUND" ? -p.amountPaise : p.amountPaise));
  const byPlan = sumBy(payments, (p) => p.invoice?.membership?.plan.name ?? (p.invoice?.notes ? "Other charges" : "Unlinked"), (p) => (p.kind === "REFUND" ? -p.amountPaise : p.amountPaise));
  const byCat = sumBy(expenses, (e) => e.category, (e) => e.amountPaise);
  const renewal = renewalRate(endedMemberships.map((m) => ({ renewed: !!m.renewedTo })));
  const hist = visitHistogram(visits.map((v) => v.checkedInAt));
  const uniqueVisitors = new Set(visits.map((v) => v.memberId)).size;
  const peakHour = hist.hours.indexOf(Math.max(...hist.hours));
  const bySource = sumBy(leads, (l) => l.source, () => 1);
  const converted = leads.filter((l) => l.status === "CONVERTED").length;
  const growth = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); const k = `${d.getFullYear()}-${d.getMonth()}`; return { label: d.toLocaleDateString("en-IN", { month: "short" }), n: sixMonths.filter((g) => `${g.joinedAt.getFullYear()}-${g.joinedAt.getMonth()}` === k).reduce((s, g) => s + g._count, 0) }; });
  const dues = (invoicesDue._sum.totalPaise ?? 0) - (invoicesDue._sum.paidPaise ?? 0);
  const card = "rounded border bg-white p-4";

  return (
    <AppShell title="Reports">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href={`/reports?month=${r.prev}`} className="rounded border bg-white px-3 py-1">←</Link>
        <span className="font-medium">{r.label}</span>
        <Link href={`/reports?month=${r.next}`} className="rounded border bg-white px-3 py-1">→</Link>
        <span className="ml-auto flex gap-3"><Link href={`/expenses?month=${r.key}`} className="underline">Expenses</Link><Link href="/settings" className="underline">Exports</Link></span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className="mb-1 font-medium">Profit & loss</h2>
          <Row k="Collected" v={paise(collected)} />
          {refunded > 0 && <Row k="Refunds" v={`- ${paise(refunded)}`} tone="text-red-700" />}
          {byCat.map(([c, v]) => <Row key={c} k={CATEGORY_LABELS[c]} v={`- ${paise(v)}`} tone="text-neutral-600" />)}
          {byCat.length === 0 && <Row k="Expenses" v="none recorded" tone="text-neutral-400" />}
          <div className="mt-1 border-t pt-1"><Row k="Net" v={paise(net)} strong tone={net < 0 ? "text-red-700" : "text-green-700"} /></div>
          <p className="mt-2 text-xs text-neutral-500">Dues still outstanding (all time): {paise(dues)}</p>
        </section>
        <section className={card}>
          <h2 className="mb-1 font-medium">Collections by method & plan</h2>
          {byMethod.map(([m, v]) => <Row key={m} k={METHOD_LABELS[m]} v={paise(v)} />)}
          <div className="mt-2 border-t pt-1">{byPlan.map(([p, v]) => <Row key={p} k={p} v={`${paise(v)} · ${pct(v, collected - refunded)}%`} />)}</div>
          {payments.length === 0 && <p className="text-sm text-neutral-500">No payments this month.</p>}
        </section>
        <section className={card}>
          <h2 className="mb-1 font-medium">Members</h2>
          <Row k="Active memberships now" v={String(activeNow)} />
          <Row k={`New members in ${r.label.split(" ")[0]}`} v={String(newMembers)} />
          <Row k="Plans ending this month" v={String(endedMemberships.length)} />
          <Row k="Renewal rate" v={renewal == null ? "—" : `${renewal}%`} tone={renewal != null && renewal < 50 ? "text-red-700" : ""} />
          <p className="mb-1 mt-3 text-xs text-neutral-500">New members, last 6 months</p>
          <Bars values={growth.map((g) => g.n)} labels={growth.map((g) => g.label)} />
        </section>
        <section className={card}>
          <h2 className="mb-1 font-medium">Peak hours (last 30 days)</h2>
          <p className="mb-1 text-xs text-neutral-500">{visits.length} visits by {uniqueVisitors} members · busiest around {peakHour}:00</p>
          <Bars values={hist.hours.slice(5, 23)} labels={hist.hours.slice(5, 23).map((_, i) => String(i + 5))} highlight={(i) => i + 5 === peakHour} />
          <p className="mb-1 mt-2 text-xs text-neutral-500">By weekday</p>
          <Bars values={hist.days} labels={[...WEEKDAYS]} />
        </section>
        <section className={card}>
          <h2 className="mb-1 font-medium">Inquiries</h2>
          <Row k="Inquiries this month" v={String(leads.length)} />
          <Row k="Converted" v={`${converted} · ${pct(converted, leads.length)}%`} />
          {bySource.map(([s, n]) => <Row key={s} k={SOURCE_LABELS[s]} v={`${n} · ${pct(leads.filter((l) => l.source === s && l.status === "CONVERTED").length, n)}% joined`} tone="text-neutral-600" />)}
        </section>
        <section className={card}>
          <h2 className="mb-1 font-medium">Personal training sessions</h2>
          {staffPt.length === 0 ? <p className="text-sm text-neutral-500">No PT sessions logged this month.</p> : staffPt.map((s) => <Row key={s.trainerId} k={trainers.find((t) => t.id === s.trainerId)?.name ?? "—"} v={`${s._count} sessions`} />)}
        </section>
      </div>
    </AppShell>
  );
}
