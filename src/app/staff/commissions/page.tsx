import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { periodOf } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { deleteCommission, markCommissionsPaid } from "@/server/staff";
import { AppShell } from "@/components/ui";
import { CommissionForm } from "@/components/staff-forms";

export const dynamic = "force-dynamic";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { gymId } = await requireTenant("staff:manage");
  const { period: p } = await searchParams;
  const period = p && /^\d{4}-\d{2}$/.test(p) ? p : periodOf(new Date());
  const [rows, staff] = await Promise.all([
    db.commission.findMany({ where: { gymId, period }, orderBy: [{ userId: "asc" }, { createdAt: "asc" }], include: { user: { select: { id: true, name: true } } } }),
    db.user.findMany({ where: { gymId, role: { not: "MEMBER" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const byUser = new Map<string, { name: string; rows: typeof rows }>();
  for (const r of rows) { const g = byUser.get(r.userId) ?? { name: r.user.name, rows: [] }; g.rows.push(r); byUser.set(r.userId, g); }
  const [y, m] = period.split("-").map(Number);
  const shift = (n: number) => periodOf(new Date(y, m - 1 + n, 1));
  const total = rows.reduce((s, r) => s + r.amountPaise, 0), unpaid = rows.filter((r) => !r.paidAt).reduce((s, r) => s + r.amountPaise, 0);
  return (
    <AppShell title="Commissions" back={{ href: "/staff", label: "Staff" }} actions={<span className="text-sm text-neutral-600">{paise(total)} · {paise(unpaid)} unpaid</span>}>
      <form className="mb-3 flex items-center gap-2" action="/staff/commissions">
        <a href={`/staff/commissions?period=${shift(-1)}`} className="rounded border bg-white px-3 py-2 text-sm">←</a>
        <input type="month" name="period" defaultValue={period} className="rounded border px-3 py-2" />
        <button className="rounded border bg-white px-3 py-2 text-sm">Go</button>
        <a href={`/staff/commissions?period=${shift(1)}`} className="rounded border bg-white px-3 py-2 text-sm">→</a>
      </form>
      <CommissionForm staff={staff} period={period} />
      {byUser.size === 0 ? <p className="mt-4 rounded border bg-white p-6 text-center text-neutral-500">No commissions for {period}.</p> : (
        <div className="mt-4 space-y-3">
          {[...byUser.entries()].map(([uid, g]) => {
            const due = g.rows.filter((r) => !r.paidAt).reduce((s, r) => s + r.amountPaise, 0);
            return (
              <section key={uid} className="rounded border bg-white p-3">
                <div className="mb-1 flex items-center justify-between"><h2 className="font-medium">{g.name}</h2><div className="flex items-center gap-3 text-sm"><span>{paise(g.rows.reduce((s, r) => s + r.amountPaise, 0))}</span>{due > 0 ? <form action={markCommissionsPaid.bind(null, uid, period)}><button className="rounded bg-neutral-900 px-3 py-1 text-xs text-white">Mark {paise(due)} paid</button></form> : <span className="text-xs text-green-700">all paid</span>}</div></div>
                <ul className="divide-y text-sm">{g.rows.map((r) => <li key={r.id} className="flex items-center justify-between py-1"><span>{r.reason}</span><span className="flex items-center gap-2"><span className={r.paidAt ? "text-neutral-400" : ""}>{paise(r.amountPaise)}</span>{r.paidAt ? <span className="text-xs text-green-700">paid {r.paidAt.toLocaleDateString("en-IN")}</span> : <form action={deleteCommission.bind(null, r.id)}><button className="text-xs text-red-700 underline">Remove</button></form>}</span></li>)}</ul>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
