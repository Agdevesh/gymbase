import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { regenerateUpiAlertToken } from "@/server/upi";
import { AppShell, ButtonLink, secondaryButtonClass } from "@/components/ui";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Owner-only: the webhook link for the phone that receives the bank's SMS, with step-by-step setup and a live log.
export default async function UpiSetupPage() {
  const { gymId } = await requireTenant("gym:manage");
  const [gym, alerts] = await Promise.all([
    db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { upiId: true, upiAlertToken: true } }),
    db.bankAlert.findMany({ where: { gymId }, orderBy: { receivedAt: "desc" }, take: 15, include: { request: { select: { code: true, amountPaise: true } } } }),
  ]);
  const base = baseUrl();
  const url = gym.upiAlertToken ? `${base}/api/upi/alerts/${gym.upiAlertToken}` : null;
  return (
    <AppShell title="Automatic UPI verification" back={{ href: "/settings", label: "Settings" }} actions={<ButtonLink href="/payments/upi" secondary>UPI desk</ButtonLink>}>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">How it works (free, no gateway)</h2>
          <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
            <li>Reception opens an invoice and presses <strong>Collect by UPI QR</strong>. The QR carries the exact amount, so ₹700 due means ₹700 paid, never ₹600.</li>
            <li>Your bank sends a credit SMS to the phone whose number is linked to <span className="font-mono">{gym.upiId ?? "your UPI ID"}</span>.</li>
            <li>A small forwarder app on that phone posts the SMS to the link below. GYMBASE matches amount and UTR to the waiting QR, records the payment and clears the dues. The screen turns green by itself.</li>
            <li>No forwarder yet? Reception can type the UTR from the member's phone; the same UTR is never accepted twice.</li>
          </ol>
          <h2 className="mb-2 mt-4 font-medium">Set up the phone (5 minutes)</h2>
          <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
            <li>On the Android phone that gets the bank SMS, install a free SMS forwarder: <strong>"SMS to URL Forwarder"</strong> (F-Droid / Play, open source) or any app that can POST an SMS to a URL (MacroDroid, Tasker, SMS Forwarder).</li>
            <li>Add a forwarding rule: sender filter = your bank's SMS ids (e.g. SBIINB, HDFCBK, ICICIB, AXISBK, KOTAKB, PAYTMB), URL = the link below, method POST, JSON body.</li>
            <li>Body template: <code className="rounded bg-neutral-100 px-1">{`{"from":"%from%","text":"%text%"}`}</code>. Any JSON with a <code>text</code>, <code>message</code> or <code>body</code> field works; plain text works too.</li>
            <li>Keep the app excluded from battery saving so it forwards instantly. Send yourself ₹1 to test; it appears in the log here.</li>
          </ol>
          <p className="mt-3 text-xs text-neutral-500">Only the amount, UTR and payer UPI ID are kept from each SMS. Debits, OTPs and balance messages are ignored. Treat the link like a password.</p>
        </section>
        <section className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Your webhook link</h2>
          {!gym.upiId && <p className="mb-2 rounded bg-amber-50 p-2 text-amber-900">Add your UPI ID under Settings first.</p>}
          {url ? <p className="break-all rounded bg-neutral-100 p-2 font-mono text-xs">{url}</p> : <p className="text-neutral-500">Not created yet.</p>}
          <form action={regenerateUpiAlertToken} className="mt-2"><button className={secondaryButtonClass}>{url ? "Replace link (old one stops working)" : "Create link"}</button></form>
          <h2 className="mb-2 mt-4 font-medium">Last alerts received</h2>
          {alerts.length === 0 ? <p className="text-neutral-500">Nothing received yet.</p> : (
            <ul className="divide-y">
              {alerts.map((a) => <li key={a.id} className="py-1"><div className="flex justify-between"><span>{a.amountPaise != null ? `₹${a.amountPaise / 100}` : "no amount"}{a.utr && <span className="font-mono text-xs text-neutral-500"> · {a.utr}</span>} · {a.source.toLowerCase()}</span><span className="text-xs text-neutral-500">{fmt(a.receivedAt)}</span></div><p className="text-xs text-neutral-500">{a.request ? `Matched ${a.request.code}` : a.note ?? "Unmatched"}</p></li>)}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
