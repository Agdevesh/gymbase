import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { waLink } from "@/lib/portal";
import { upiPayUri } from "@/lib/upi";
import { requireTenant } from "@/server/tenant";
import { cancelUpiRequest } from "@/server/upi";
import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui";
import { UpiQrPanel } from "@/components/upi-qr";
import { UpiWaiting, UtrForm } from "@/components/upi-forms";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// Reception's "collect by UPI" screen: the fixed-amount QR, live status, UTR fallback and a WhatsApp link to the member's own pay page.
export default async function InvoiceUpiPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId } = await requireTenant("payments:write");
  const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, gymId }, include: { member: { select: { id: true, firstName: true, lastName: true, phone: true } }, gym: { select: { name: true, upiId: true, upiAlertToken: true } } } });
  if (!inv) notFound();
  const request = await db.upiRequest.findFirst({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
  if (!request || !inv.gym.upiId) redirect(`/invoices/${id}`);
  const status = request.status === "PENDING" && request.expiresAt <= new Date() ? "EXPIRED" : request.status;
  const uri = upiPayUri({ upiId: inv.gym.upiId, payee: inv.gym.name, amountPaise: request.amountPaise, code: request.code, note: inv.number });
  const base = baseUrl();
  const name = [inv.member.firstName, inv.member.lastName].filter(Boolean).join(" ");
  const sameAmount = status === "PENDING" ? await db.upiRequest.count({ where: { gymId, status: "PENDING", expiresAt: { gt: new Date() }, amountPaise: request.amountPaise, id: { not: request.id } } }) : 0;
  return (
    <AppShell title={`Collect ${paise(request.amountPaise)} by UPI`} back={{ href: `/invoices/${id}`, label: `Invoice ${inv.number}` }}>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <UpiWaiting token={request.token} initial={status} amount={paise(request.amountPaise)} paidNote={<p className="mt-2 text-sm"><ButtonLink href={`/invoices/${id}`}>Back to invoice</ButtonLink></p>}>
            <UpiQrPanel uri={uri} amountPaise={request.amountPaise} code={request.code} upiId={inv.gym.upiId} />
          </UpiWaiting>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm space-y-4 p-4 text-sm">
          <p><strong>{name}</strong> · {inv.member.phone} · Invoice {inv.number}</p>
          {status === "PENDING" && <>
            {!inv.gym.upiAlertToken && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">Automatic verification is not set up yet. Owner: <a href="/settings/upi" className="font-medium text-brand-700 hover:underline">connect the bank SMS</a>. Until then, confirm by UTR below.</p>}
            {sameAmount > 0 && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">{sameAmount} other member{sameAmount > 1 ? "s are" : " is"} also paying {paise(request.amountPaise)} right now. If the bank alert cannot tell them apart it will appear under <a href="/payments/upi" className="font-medium text-brand-700 hover:underline">UPI desk</a> for you to pick.</p>}
            <UtrForm requestId={request.id} />
            <div className="flex flex-wrap gap-2">
              <a href={waLink(inv.member.phone, `Hi ${inv.member.firstName}, please pay ${paise(request.amountPaise)} for ${inv.number} at ${inv.gym.name} using this link (amount is fixed): ${base}/pay/${request.token}`)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-1.5">Send pay link on WhatsApp</a>
              <form action={cancelUpiRequest.bind(null, request.id)}><button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-1.5 text-red-700">Cancel request</button></form>
            </div>
            <p className="text-xs text-slate-500">Request {request.code} expires {request.expiresAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. A payment of any other amount will not be matched to this invoice.</p>
          </>}
        </section>
      </div>
    </AppShell>
  );
}
