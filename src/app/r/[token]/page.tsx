import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { METHOD_LABELS, paise } from "@/lib/payments";
import { upiLink } from "@/lib/settings";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Public receipt page members open from WhatsApp. No login; the token is unguessable.
export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const inv = await db.invoice.findUnique({ where: { publicToken: token }, include: { gym: { select: { name: true, phone: true, address: true, upiId: true, gstin: true, logoUrl: true, receiptNote: true } }, member: { select: { firstName: true, lastName: true, code: true } }, membership: { include: { plan: { select: { name: true } } } }, payments: { orderBy: { paidAt: "asc" } } } });
  if (!inv) notFound();
  const due = inv.totalPaise - inv.paidPaise;
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">{inv.gym.name}</p>
        <h1 className="text-xl font-semibold">{due > 0 ? "Invoice" : "Receipt"} {inv.number}</h1>
        <p className="text-sm text-slate-500">{fmt(inv.issuedAt)} · {inv.member.firstName} {inv.member.lastName} ({inv.member.code})</p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt>{inv.membership ? `${inv.membership.plan.name} membership, ${fmt(inv.membership.startDate)} to ${fmt(inv.membership.endDate)}` : inv.notes ?? "Charge"}</dt><dd>{paise(inv.subtotalPaise + (inv.membership?.discountPaise ?? 0))}</dd></div>
          {inv.membership && inv.membership.discountPaise > 0 && <div className="flex justify-between text-slate-500"><dt>Discount</dt><dd>− {paise(inv.membership.discountPaise)}</dd></div>}
          {inv.gstPercent > 0 && <div className="flex justify-between text-slate-500"><dt>GST @ {inv.gstPercent}%{inv.gym.gstin && ` (${inv.gym.gstin})`}</dt><dd>{paise(inv.gstPaise)}</dd></div>}
          <div className="flex justify-between border-t pt-1 font-semibold"><dt>Total</dt><dd>{paise(inv.totalPaise)}</dd></div>
          {inv.payments.map((p) => <div key={p.id} className="flex justify-between text-green-700"><dt>{p.kind === "REFUND" ? "Refund" : `Paid by ${METHOD_LABELS[p.method]}`} · {fmt(p.paidAt)}</dt><dd>{p.kind === "REFUND" ? "− " : ""}{paise(p.amountPaise)}</dd></div>)}
          <div className={`flex justify-between font-semibold ${due > 0 ? "text-red-700" : "text-green-700"}`}><dt>{due > 0 ? "Balance due" : "Fully paid"}</dt><dd>{due > 0 ? paise(due) : "✓"}</dd></div>
        </dl>
        {due > 0 && inv.gym.upiId && <a href={upiLink(inv.gym.upiId, inv.gym.name, due, inv.number)} className="mt-4 block rounded-lg bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-700 shadow-sm">Pay {paise(due)} by UPI</a>}
        <a href={`/r/${token}/pdf`} className="mt-2 block rounded-lg border py-2 text-center text-sm">Download PDF</a>
        <p className="mt-4 text-center text-xs text-slate-500">{inv.gym.receiptNote ?? "Thank you for training with us."}{inv.gym.phone && ` · ${inv.gym.phone}`}</p>
      </div>
    </main>
  );
}
