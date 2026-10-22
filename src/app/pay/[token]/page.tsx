import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { upiPayUri } from "@/lib/upi";
import { UpiQrPanel } from "@/components/upi-qr";
import { UpiWaiting } from "@/components/upi-forms";

export const dynamic = "force-dynamic";

// Public, token-addressed pay page a member opens from WhatsApp or the portal. Shows only the gym, invoice number and amount.
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await db.upiRequest.findUnique({ where: { token }, include: { invoice: { select: { number: true } }, member: { select: { firstName: true } }, gym: { select: { name: true, upiId: true, phone: true, whatsapp: true } } } });
  if (!r || !r.gym.upiId) notFound();
  const status = r.status === "PENDING" && r.expiresAt <= new Date() ? "EXPIRED" : r.status;
  const uri = upiPayUri({ upiId: r.gym.upiId, payee: r.gym.name, amountPaise: r.amountPaise, code: r.code, note: r.invoice.number });
  return (
    <main className="mx-auto max-w-md p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{r.gym.name}</p>
      <h1 className="mb-3 text-xl font-semibold">Hi {r.member.firstName}, pay {paise(r.amountPaise)}</h1>
      <section className="rounded-lg border bg-white p-4">
        <UpiWaiting token={r.token} initial={status} amount={paise(r.amountPaise)} paidNote={<p className="mt-2 text-sm text-green-800">Your dues are updated. Thank you!</p>}>
          <UpiQrPanel uri={uri} amountPaise={r.amountPaise} code={r.code} upiId={r.gym.upiId} />
        </UpiWaiting>
      </section>
      <p className="mt-3 text-xs text-neutral-500">Invoice {r.invoice.number}. On a phone, tap the button to open GPay, PhonePe or Paytm. The gym is told automatically once the money arrives.</p>
    </main>
  );
}
