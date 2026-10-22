import Link from "next/link";
import { db } from "@/lib/db";
import { METHOD_LABELS, PAYMENT_METHODS, localDateKey, paise } from "@/lib/payments";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { inputClass } from "@/components/ui";
import { ClosingForm } from "@/components/payment-forms";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { gymId } = await requireTenant("payments:write");
  const { date } = await searchParams;
  const now = new Date();
  const key = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateKey(now);
  const start = new Date(`${key}T00:00:00`), end = new Date(start.getTime() + 86400_000);
  const [payments, closing, recentClosings] = await Promise.all([
    db.payment.findMany({ where: { gymId, paidAt: { gte: start, lt: end } }, orderBy: { paidAt: "desc" }, include: { member: { select: { id: true, firstName: true, lastName: true } }, invoice: { select: { id: true, number: true } }, takenBy: { select: { name: true } } } }),
    db.cashClosing.findUnique({ where: { gymId_date: { gymId, date: new Date(`${key}T00:00:00Z`) } }, include: { closedBy: { select: { name: true } } } }),
    db.cashClosing.findMany({ where: { gymId }, orderBy: { date: "desc" }, take: 7, include: { closedBy: { select: { name: true } } } }),
  ]);
  const signed = (p: { kind: string; amountPaise: number }) => (p.kind === "REFUND" ? -p.amountPaise : p.amountPaise);
  const byMethod = PAYMENT_METHODS.map((m) => ({ m, total: payments.filter((p) => p.method === m).reduce((s, p) => s + signed(p), 0) })).filter((x) => x.total !== 0);
  const total = payments.reduce((s, p) => s + signed(p), 0);
  const cashExpected = payments.filter((p) => p.method === "CASH" && !p.closingId).reduce((s, p) => s + signed(p), 0);
  const shift = (n: number) => localDateKey(new Date(start.getTime() + n * 86400_000));

  return (
    <AppShell title="Payments" actions={<span className="text-lg font-semibold">{paise(total)}</span>}>
      <form className="mb-4 flex items-center gap-2" action="/payments">
        <Link href={`/payments?date=${shift(-1)}`} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">←</Link>
        <input type="date" name="date" defaultValue={key} className={`${inputClass} w-auto`} />
        <button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">Go</button>
        {end <= now && <Link href={`/payments?date=${shift(1)}`} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">→</Link>}
      </form>
      <div className="mb-4 flex flex-wrap gap-3">
        {byMethod.map(({ m, total }) => <div key={m} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-4 py-2"><div className="text-xs text-slate-500">{METHOD_LABELS[m]}</div><div className="font-semibold">{paise(total)}</div></div>)}
        {byMethod.length === 0 && <p className="text-sm text-slate-500">No payments on this day.</p>}
      </div>
      {payments.length > 0 && (
        <table className="rounded-xl border border-slate-200 bg-white shadow-sm w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="p-2">Time</th><th className="p-2">Member</th><th className="p-2">Invoice</th><th className="p-2">Method</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className={p.kind === "REFUND" ? "text-red-700" : ""}>
                <td className="p-2">{p.paidAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="p-2"><Link href={`/members/${p.member.id}`} className="font-medium text-brand-700 hover:underline">{[p.member.firstName, p.member.lastName].filter(Boolean).join(" ")}</Link></td>
                <td className="p-2">{p.invoice && <Link href={`/invoices/${p.invoice.id}`} className="font-medium text-brand-700 hover:underline">{p.invoice.number}</Link>}</td>
                <td className="p-2">{p.kind === "REFUND" ? "Refund · " : ""}{METHOD_LABELS[p.method]}{p.reference && <span className="text-slate-400"> {p.reference}</span>}{p.takenBy && <span className="text-slate-400"> · {p.takenBy.name}</span>}</td>
                <td className="p-2 text-right">{p.kind === "REFUND" ? "− " : ""}{paise(p.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <section className="mt-6">
        <h2 className="mb-2 font-semibold text-slate-900">Cash closing · {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</h2>
        {closing ? (
          <p className={`rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-sm ${closing.countedPaise === closing.expectedPaise ? "" : "border-red-300"}`}>
            Closed by {closing.closedBy.name}: expected {paise(closing.expectedPaise)}, counted {paise(closing.countedPaise)}
            {closing.countedPaise !== closing.expectedPaise && <span className="text-red-700"> ({closing.countedPaise > closing.expectedPaise ? "excess" : "short"} {paise(Math.abs(closing.countedPaise - closing.expectedPaise))})</span>}
            {closing.notes && ` · ${closing.notes}`}
          </p>
        ) : <ClosingForm date={key} expectedPaise={cashExpected} />}
        {recentClosings.length > 0 && (
          <ul className="rounded-xl border border-slate-200 bg-white shadow-sm mt-3 divide-y text-sm divide-slate-100">
            {recentClosings.map((c) => <li key={c.id} className="flex justify-between px-3 py-1.5"><span>{c.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} · {c.closedBy.name}</span><span className={c.countedPaise === c.expectedPaise ? "text-green-700" : "text-red-700"}>{paise(c.countedPaise)} / {paise(c.expectedPaise)}</span></li>)}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
