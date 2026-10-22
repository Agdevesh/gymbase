import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { daysLeft, waLink } from "@/lib/portal";
import { holidayOn, upiLink } from "@/lib/settings";
import { localDateKey } from "@/lib/payments";
import { sessionsLeft } from "@/lib/staff";
import { fmtSlot } from "@/lib/pt";
import { requireMember } from "@/server/portal";
import { startMemberUpiRequest } from "@/server/upi";
import { expireMemberships } from "@/server/memberships";
import { MemberShell } from "@/components/member-shell";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ upi?: string }> }) {
  const { member: m, gym } = await requireMember();
  const { upi: upiError } = await searchParams;
  await expireMemberships(gym.id);
  const now = new Date();
  const [memberships, invoices, pt, plans] = await Promise.all([
    db.membership.findMany({ where: { memberId: m.id }, orderBy: { endDate: "desc" }, take: 3, include: { plan: { select: { name: true } } } }),
    db.invoice.findMany({ where: { memberId: m.id, paidPaise: { lt: db.invoice.fields.totalPaise } }, select: { id: true, number: true, totalPaise: true, paidPaise: true }, orderBy: { issuedAt: "asc" } }),
    db.ptAssignment.findFirst({ where: { memberId: m.id, endDate: null }, include: { trainer: { select: { name: true } }, slots: { where: { status: "SCHEDULED", at: { gte: now } }, orderBy: { at: "asc" }, take: 3 } } }),
    db.plan.findMany({ where: { gymId: gym.id, active: true, type: { not: "PT" } }, orderBy: { durationDays: "asc" } }),
  ]);
  const current = memberships.find((x) => x.status === "ACTIVE" || x.status === "FROZEN" || x.status === "SUSPENDED");
  const due = invoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0);
  const left = current ? daysLeft(current.endDate, now) : 0;
  const holiday = holidayOn(gym.holidays, localDateKey(now));
  const gymWa = gym.whatsapp ?? gym.phone;
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  const tone = !current ? "bg-slate-100" : current.status === "FROZEN" ? "bg-blue-50" : current.status === "SUSPENDED" ? "bg-red-50" : left <= 7 ? "bg-amber-50" : "bg-green-50";

  return (
    <MemberShell gymName={gym.name} title={`Hi ${m.firstName}`}>
      <section className={`rounded-lg p-4 ${tone}`}>
        {current ? <>
          <div className="text-sm text-slate-600">{current.plan.name}{current.status === "FROZEN" && " · frozen"}{current.status === "SUSPENDED" && " · suspended until dues are paid"}</div>
          <div className="text-2xl font-semibold">{left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Expires today"}</div>
          <div className="text-sm text-slate-600">Valid till {fmt(current.endDate)}</div>
        </> : <>
          <div className="text-2xl font-semibold">No active plan</div>
          <div className="text-sm text-slate-600">{memberships[0] ? `Last plan ended ${fmt(memberships[0].endDate)}.` : "Ask reception to start a plan."}</div>
        </>}
        {holiday && <p className="mt-2 text-sm text-amber-900">Gym is closed today: {holiday}.</p>}
      </section>

      {due > 0 && (
        <section className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-800">Pending dues</div>
          <div className="text-2xl font-semibold text-red-800">{paise(due)}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {gym.upiId && invoices.map((i) => <form key={i.id} action={startMemberUpiRequest.bind(null, i.id)}><button className="rounded-lg bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700 shadow-sm font-medium">Pay {paise(i.totalPaise - i.paidPaise)} by UPI{invoices.length > 1 && ` · ${i.number}`}</button></form>)}
            {gymWa && <a href={waLink(gymWa, `Hi, this is ${name} (${m.code}). I have paid ${paise(due)} via UPI. Please update my dues.`)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-1.5">Tell gym I paid</a>}
          </div>
          {upiError && <p className="mt-1 text-xs text-red-700">{upiError}</p>}
          {gym.upiId && <p className="mt-1 text-xs text-slate-500">You get a QR with the exact amount; your dues clear automatically once the gym's bank confirms it.</p>}
        </section>
      )}

      {(left <= 10 || !current) && plans.length > 0 && (
        <section className="mt-3 rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold text-slate-900">{current ? "Renew now" : "Join a plan"}</h2>
          <ul className="divide-y text-sm divide-slate-100">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.name} <span className="text-slate-500">· {p.durationDays} days</span></span>
                <span className="flex items-center gap-2"><span className="font-medium">{paise(p.pricePaise)}</span>
                  {gym.upiId && <a href={upiLink(gym.upiId, gym.name, p.pricePaise, `${m.code} ${p.name}`)} className="rounded-lg bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 shadow-sm font-medium">Pay UPI</a>}
                  {gymWa && <a href={waLink(gymWa, `Hi, this is ${name} (${m.code}). I want to renew with ${p.name} (${paise(p.pricePaise)}).`)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-2 py-1 text-xs">WhatsApp</a>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Pay, then message reception; they activate the plan and your receipt appears under Payments.</p>
        </section>
      )}

      {pt && <section className="mt-3 rounded-lg border bg-white p-4 text-sm"><h2 className="font-semibold text-slate-900">Personal training</h2><p>Trainer {pt.trainer.name} · {sessionsLeft(pt)} of {pt.sessionsTotal} sessions left</p>{pt.slots.length > 0 && <ul className="mt-1 text-slate-600">{pt.slots.map((s) => <li key={s.id}>Next: {fmtSlot(s.at)}</li>)}</ul>}</section>}

      <section className="mt-3 rounded-lg border bg-white p-4 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900 text-slate-900">{gym.name}</h2>
        {(gym.openTime || gym.closeTime) && <p>Open {gym.openTime ?? "?"} to {gym.closeTime ?? "?"}{gym.weeklyOff && ` · ${gym.weeklyOff} off`}</p>}
        {gym.address && <p>{gym.address}</p>}
        <p className="mt-1 flex gap-3">{gym.phone && <a href={`tel:${gym.phone}`} className="font-medium text-brand-700 hover:underline">Call</a>}{gymWa && <a href={waLink(gymWa, `Hi, this is ${name} (${m.code}).`)} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">WhatsApp</a>}</p>
      </section>
    </MemberShell>
  );
}
