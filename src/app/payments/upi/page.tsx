import Link from "next/link";
import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { requireTenant } from "@/server/tenant";
import { assignAlert, cancelUpiRequest } from "@/server/upi";
import { AppShell, ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Live list of QR requests waiting for money, plus bank alerts the matcher could not place.
export default async function UpiDeskPage() {
  const { gymId, role } = await requireTenant("payments:write");
  const now = new Date(), since = new Date(now.getTime() - 7 * 86400_000);
  const [pending, unmatched, recent, gym] = await Promise.all([
    db.upiRequest.findMany({ where: { gymId, status: "PENDING", expiresAt: { gt: now } }, orderBy: { createdAt: "asc" }, include: { member: { select: { firstName: true, lastName: true } }, invoice: { select: { number: true } } } }),
    db.bankAlert.findMany({ where: { gymId, requestId: null, amountPaise: { not: null }, receivedAt: { gte: since } }, orderBy: { receivedAt: "desc" }, take: 30 }),
    db.upiRequest.findMany({ where: { gymId, status: { in: ["PAID", "EXPIRED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 20, include: { member: { select: { firstName: true, lastName: true } }, invoice: { select: { number: true } } } }),
    db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { upiId: true, upiAlertToken: true } }),
  ]);
  const name = (m: { firstName: string; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(" ");
  return (
    <AppShell title="UPI desk" actions={role === "OWNER" ? <ButtonLink href="/settings/upi" secondary>Verification setup</ButtonLink> : undefined}>
      {!gym.upiId && <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-900">No UPI ID yet. The owner adds it under Settings, then every invoice gets a fixed-amount QR.</p>}
      {gym.upiId && !gym.upiAlertToken && <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-900">Bank alerts are not connected, so payments are confirmed by typing the UTR. Owner: set up under Verification setup.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Waiting for payment ({pending.length})</h2>
          {pending.length === 0 ? <p className="text-sm text-neutral-500">No open requests. Open an invoice and press "Collect by UPI QR".</p> : (
            <ul className="divide-y text-sm">
              {pending.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span><Link href={`/invoices/${r.invoiceId}/upi`} className="underline">{name(r.member)}</Link> · {r.invoice.number} · <span className="font-mono text-xs">{r.code}</span><br /><span className="text-xs text-neutral-500">since {fmt(r.createdAt)}, expires {fmt(r.expiresAt)}</span></span>
                  <span className="flex items-center gap-2"><strong>{paise(r.amountPaise)}</strong><form action={cancelUpiRequest.bind(null, r.id)}><button className="text-xs text-red-700 underline">Cancel</button></form></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Bank credits not matched ({unmatched.length})</h2>
          {unmatched.length === 0 ? <p className="text-sm text-neutral-500">Every credit alert in the last 7 days was matched.</p> : (
            <ul className="divide-y text-sm">
              {unmatched.map((a) => {
                const candidates = pending.filter((p) => p.amountPaise === a.amountPaise);
                return (
                  <li key={a.id} className="py-2">
                    <div className="flex justify-between"><span><strong>{paise(a.amountPaise!)}</strong>{a.payerVpa && <span className="text-neutral-500"> from {a.payerVpa}</span>}{a.utr && <span className="font-mono text-xs text-neutral-500"> · {a.utr}</span>}</span><span className="text-xs text-neutral-500">{fmt(a.receivedAt)}</span></div>
                    <p className="text-xs text-neutral-500">{a.note ?? "Unmatched"}{a.sender && ` · ${a.sender}`}</p>
                    {candidates.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{candidates.map((p) => <form key={p.id} action={assignAlert.bind(null, a.id, p.id)}><button className="rounded border px-2 py-0.5 text-xs">This is {name(p.member)} ({p.invoice.number})</button></form>)}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Recent</h2>
        {recent.length === 0 ? <p className="text-sm text-neutral-500">Nothing yet.</p> : (
          <ul className="divide-y text-sm">
            {recent.map((r) => <li key={r.id} className="flex justify-between py-1"><span><Link href={`/invoices/${r.invoiceId}`} className="underline">{r.invoice.number}</Link> · {name(r.member)}{r.utr && <span className="font-mono text-xs text-neutral-500"> · {r.utr}</span>}</span><span className={r.status === "PAID" ? "text-green-700" : "text-neutral-500"}>{paise(r.amountPaise)} · {r.status.toLowerCase()} · {fmt(r.paidAt ?? r.createdAt)}</span></li>)}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
