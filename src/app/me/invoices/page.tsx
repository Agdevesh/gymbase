import { db } from "@/lib/db";
import { METHOD_LABELS, paise } from "@/lib/payments";
import { requireMember } from "@/server/portal";
import { MemberShell } from "@/components/member-shell";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function PortalInvoices() {
  const { member: m, gym } = await requireMember();
  const invoices = await db.invoice.findMany({ where: { memberId: m.id }, orderBy: { issuedAt: "desc" }, include: { membership: { include: { plan: { select: { name: true } } } }, payments: { orderBy: { paidAt: "desc" } } } });
  return (
    <MemberShell gymName={gym.name} title="Payments">
      {invoices.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-500">No bills yet.</p> : (
        <ul className="space-y-2">
          {invoices.map((i) => { const due = i.totalPaise - i.paidPaise; return (
            <li key={i.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex justify-between"><span className="font-medium">{i.membership ? `${i.membership.plan.name} membership` : i.notes ?? "Charge"}</span><span className="font-medium">{paise(i.totalPaise)}</span></div>
              <div className="flex justify-between text-slate-500"><span>{i.number} · {fmt(i.issuedAt)}</span>{due > 0 ? <span className="text-red-700">{paise(due)} due</span> : <span className="text-green-700">Paid</span>}</div>
              {i.payments.map((p) => <div key={p.id} className="text-xs text-slate-500">{p.kind === "REFUND" ? "Refund" : "Paid"} {paise(p.amountPaise)} by {METHOD_LABELS[p.method]} on {fmt(p.paidAt)}</div>)}
              <a href={`/invoices/${i.id}/pdf`} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">{due > 0 ? "Invoice PDF" : "Receipt PDF"}</a>
            </li>); })}
        </ul>
      )}
    </MemberShell>
  );
}
