import QRCode from "qrcode";
import { db } from "@/lib/db";
import { qrPayload } from "@/lib/checkin";
import { paise } from "@/lib/payments";
import { daysLeft, waLink } from "@/lib/portal";
import { holidayOn, upiLink } from "@/lib/settings";
import { localDateKey } from "@/lib/payments";
import { sessionsLeft } from "@/lib/staff";
import { requireMember } from "@/server/portal";
import { expireMemberships } from "@/server/memberships";
import { MemberShell } from "@/components/member-shell";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function PortalHome() {
  const { member: m, gym } = await requireMember();
  await expireMemberships(gym.id);
  const now = new Date(), since30 = new Date(now.getTime() - 30 * 86400_000);
  const [memberships, invoices, visits, pt, plans] = await Promise.all([
    db.membership.findMany({ where: { memberId: m.id }, orderBy: { endDate: "desc" }, take: 3, include: { plan: { select: { name: true } } } }),
    db.invoice.findMany({ where: { memberId: m.id, paidPaise: { lt: db.invoice.fields.totalPaise } }, select: { number: true, totalPaise: true, paidPaise: true } }),
    db.checkIn.findMany({ where: { memberId: m.id, checkedInAt: { gte: since30 } }, orderBy: { checkedInAt: "desc" }, select: { checkedInAt: true } }),
    db.ptAssignment.findFirst({ where: { memberId: m.id, endDate: null }, include: { trainer: { select: { name: true } } } }),
    db.plan.findMany({ where: { gymId: gym.id, active: true, type: { not: "PT" } }, orderBy: { durationDays: "asc" } }),
  ]);
  const current = memberships.find((x) => x.status === "ACTIVE" || x.status === "FROZEN");
  const due = invoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0);
  const left = current ? daysLeft(current.endDate, now) : 0;
  const svg = await QRCode.toString(qrPayload(m.qrToken), { type: "svg", margin: 1, width: 200 });
  const holiday = holidayOn(gym.holidays, localDateKey(now));
  const gymWa = gym.whatsapp ?? gym.phone;
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  const tone = !current ? "bg-neutral-100" : current.status === "FROZEN" ? "bg-blue-50" : left <= 7 ? "bg-amber-50" : "bg-green-50";

  return (
    <MemberShell gymName={gym.name} title={`Hi ${m.firstName}`}>
      <section className={`rounded-lg p-4 ${tone}`}>
        {current ? <>
          <div className="text-sm text-neutral-600">{current.plan.name}{current.status === "FROZEN" && " · frozen"}</div>
          <div className="text-2xl font-semibold">{left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Expires today"}</div>
          <div className="text-sm text-neutral-600">Valid till {fmt(current.endDate)}</div>
        </> : <>
          <div className="text-2xl font-semibold">No active plan</div>
          <div className="text-sm text-neutral-600">{memberships[0] ? `Last plan ended ${fmt(memberships[0].endDate)}.` : "Ask reception to start a plan."}</div>
        </>}
        {holiday && <p className="mt-2 text-sm text-amber-900">Gym is closed today: {holiday}.</p>}
      </section>

      {due > 0 && (
        <section className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-800">Pending dues</div>
          <div className="text-2xl font-semibold text-red-800">{paise(due)}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {gym.upiId && <a href={upiLink(gym.upiId, gym.name, due, invoices.map((i) => i.number).join(" "))} className="rounded bg-neutral-900 px-3 py-1.5 text-white">Pay {paise(due)} by UPI</a>}
            {gymWa && <a href={waLink(gymWa, `Hi, this is ${name} (${m.code}). I have paid ${paise(due)} via UPI. Please update my dues.`)} target="_blank" rel="noreferrer" className="rounded border bg-white px-3 py-1.5">Tell gym I paid</a>}
          </div>
          {gym.upiId && <p className="mt-1 text-xs text-neutral-500">UPI ID {gym.upiId}. Reception confirms the payment and your dues clear.</p>}
        </section>
      )}

      <section className="mt-3 rounded-lg border bg-white p-4 text-center">
        <div className="mx-auto w-48" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-1 font-mono text-neutral-500">{m.code}</p>
        <p className="text-xs text-neutral-500">Show this QR at reception to check in</p>
      </section>

      {(left <= 10 || !current) && plans.length > 0 && (
        <section className="mt-3 rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium">{current ? "Renew now" : "Join a plan"}</h2>
          <ul className="divide-y text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.name} <span className="text-neutral-500">· {p.durationDays} days</span></span>
                <span className="flex items-center gap-2"><span className="font-medium">{paise(p.pricePaise)}</span>
                  {gym.upiId && <a href={upiLink(gym.upiId, gym.name, p.pricePaise, `${m.code} ${p.name}`)} className="rounded bg-neutral-900 px-2 py-1 text-xs text-white">Pay UPI</a>}
                  {gymWa && <a href={waLink(gymWa, `Hi, this is ${name} (${m.code}). I want to renew with ${p.name} (${paise(p.pricePaise)}).`)} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs">WhatsApp</a>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">Pay, then message reception; they activate the plan and your receipt appears under Payments.</p>
        </section>
      )}

      <section className="mt-3 rounded-lg border bg-white p-4">
        <h2 className="mb-1 flex justify-between font-medium">Attendance <span className="text-sm font-normal text-neutral-500">{visits.length} visits in 30 days</span></h2>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 30 }, (_, i) => { const d = new Date(now.getTime() - (29 - i) * 86400_000); const key = localDateKey(d); const hit = visits.some((v) => localDateKey(v.checkedInAt) === key); return <span key={key} title={key} className={`h-4 w-4 rounded-sm ${hit ? "bg-green-500" : "bg-neutral-200"}`} />; })}
        </div>
        {visits[0] && <p className="mt-1 text-xs text-neutral-500">Last visit {visits[0].checkedInAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
      </section>

      {pt && <section className="mt-3 rounded-lg border bg-white p-4 text-sm"><h2 className="font-medium">Personal training</h2><p>Trainer {pt.trainer.name} · {sessionsLeft(pt)} of {pt.sessionsTotal} sessions left</p></section>}

      <section className="mt-3 rounded-lg border bg-white p-4 text-sm text-neutral-600">
        <h2 className="font-medium text-neutral-900">{gym.name}</h2>
        {(gym.openTime || gym.closeTime) && <p>Open {gym.openTime ?? "?"} to {gym.closeTime ?? "?"}{gym.weeklyOff && ` · ${gym.weeklyOff} off`}</p>}
        {gym.address && <p>{gym.address}</p>}
        <p className="mt-1 flex gap-3">{gym.phone && <a href={`tel:${gym.phone}`} className="underline">Call</a>}{gymWa && <a href={waLink(gymWa, `Hi, this is ${name} (${m.code}).`)} target="_blank" rel="noreferrer" className="underline">WhatsApp</a>}</p>
      </section>
    </MemberShell>
  );
}
