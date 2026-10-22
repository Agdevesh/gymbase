import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { METHOD_LABELS, paise } from "@/lib/payments";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { AppShell, ButtonLink } from "@/components/ui";
import { CollectForm, RefundForm } from "@/components/payment-forms";
import { ReceiptShare } from "@/components/receipt-share";
import { StartUpiButton } from "@/components/upi-start";

const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId, role } = await requireTenant("members:read");
  const { id } = await params;
  const inv = await db.invoice.findFirst({
    where: { id, gymId },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, phone: true } },
      membership: { include: { plan: { select: { name: true } } } },
      gym: { select: { upiId: true } },
      payments: { orderBy: { paidAt: "asc" }, include: { takenBy: { select: { name: true } }, refunds: { select: { amountPaise: true } } } },
    },
  });
  if (!inv) notFound();
  const due = inv.totalPaise - inv.paidPaise;
  const name = [inv.member.firstName, inv.member.lastName].filter(Boolean).join(" ");
  const row = (k: string, v: React.ReactNode, cls = "") => <div className={`flex justify-between py-1 text-sm ${cls}`}><dt className="text-neutral-500">{k}</dt><dd>{v}</dd></div>;
  return (
    <AppShell title={`Invoice ${inv.number}`} back={{ href: `/members/${inv.member.id}`, label: name }}
      actions={<>{can(role, "payments:write") && <span className="self-center"><ReceiptShare invoiceId={inv.id} label="Send on WhatsApp" /></span>}<a href={`/invoices/${inv.id}/pdf`} className="inline-flex items-center rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100">Download PDF</a></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border bg-white p-4">
          <p className="text-sm text-neutral-500">{fmt(inv.issuedAt)} · <Link href={`/members/${inv.member.id}`} className="underline">{name}</Link> · {inv.member.phone}</p>
          <dl className="mt-2 divide-y">
            {row(inv.membership ? `${inv.membership.plan.name} (${inv.membership.startDate.toLocaleDateString("en-IN")} – ${inv.membership.endDate.toLocaleDateString("en-IN")})` : inv.notes ?? "Charge", paise(inv.subtotalPaise + (inv.membership?.discountPaise ?? 0)))}
            {inv.membership && inv.membership.discountPaise > 0 && row("Discount", `− ${paise(inv.membership.discountPaise)}`)}
            {inv.gstPercent > 0 && row(`GST ${inv.gstPercent}%`, paise(inv.gstPaise))}
            {row("Total", paise(inv.totalPaise), "font-medium")}
            {row("Paid", paise(inv.paidPaise))}
            {row("Due", paise(Math.max(0, due)), due > 0 ? "font-medium text-red-700" : "text-green-700")}
          </dl>
        </section>
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Payments</h2>
          {inv.payments.length === 0 ? <p className="text-sm text-neutral-500">Nothing paid yet.</p> : (
            <ul className="divide-y text-sm">
              {inv.payments.map((p) => {
                const refunded = p.refunds.reduce((s, r) => s + r.amountPaise, 0);
                return (
                  <li key={p.id} className="py-2">
                    <div className="flex justify-between"><span>{p.kind === "REFUND" ? "Refund" : METHOD_LABELS[p.method]}{p.reference && <span className="text-neutral-500"> · {p.reference}</span>}</span><span className={p.kind === "REFUND" ? "text-red-700" : ""}>{p.kind === "REFUND" ? "− " : ""}{paise(p.amountPaise)}</span></div>
                    <div className="flex justify-between text-xs text-neutral-500"><span>{fmt(p.paidAt)}{p.takenBy && ` · ${p.takenBy.name}`}</span>
                      {p.kind === "PAYMENT" && can(role, "payments:refund") && p.amountPaise - refunded > 0 && <RefundForm paymentId={p.id} maxPaise={p.amountPaise - refunded} />}</div>
                  </li>
                );
              })}
            </ul>
          )}
          {due > 0 && can(role, "payments:write") && <div className="mt-3 space-y-3">{inv.gym.upiId && <StartUpiButton invoiceId={inv.id} duePaise={due} />}<CollectForm memberId={inv.member.id} duePaise={due} invoiceId={inv.id} /></div>}
        </section>
      </div>
      <p className="mt-4 text-sm"><ButtonLink href={`/members/${inv.member.id}`} secondary>Back to member</ButtonLink></p>
    </AppShell>
  );
}
