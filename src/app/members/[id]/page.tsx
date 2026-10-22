import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { deleteDocument, deleteNote } from "@/server/members";
import { AppShell } from "@/components/app-shell";
import { Avatar, ButtonLink, StatusBadge } from "@/components/ui";
import { DocumentForm, NoteForm } from "@/components/member-detail-forms";
import { MembershipPanel } from "@/components/membership-panel";
import { expireMemberships } from "@/server/memberships";
import { prorataCredit, renewalStart } from "@/lib/memberships";
import { ChargeForm, CollectForm } from "@/components/payment-forms";
import { CustomMessageForm } from "@/components/reminder-forms";
import { AssignPtForm, LogSessionForm } from "@/components/staff-forms";
import { endPt } from "@/server/staff";
import { sessionsLeft } from "@/lib/staff";
import { MemberAccessButton } from "@/components/portal-forms";
import { disableMemberAccess, enableMemberAccess } from "@/server/portal";
import { MEASURE_FIELDS, bmi, trend } from "@/lib/fitness";
import { setPlanActive } from "@/server/fitness";
import { MeasurementForm, PlanEditor } from "@/components/fitness-forms";
import { PtSlotForm } from "@/components/pt-slot-form";
import { ReceiptShare } from "@/components/receipt-share";
import { fmtSlot } from "@/lib/pt";
import { markSlot } from "@/server/ptslots";

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const paise = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId, role } = await requireTenant("members:read");
  const { id } = await params;
  await expireMemberships(gymId);
  const plansQ = db.plan.findMany({ where: { gymId, active: true }, orderBy: { durationDays: "asc" }, select: { id: true, name: true, pricePaise: true, durationDays: true } });
  const m = await db.member.findFirst({
    where: { id, gymId },
    include: {
      memberships: { orderBy: { endDate: "desc" }, include: { plan: { select: { name: true, type: true, ptSessions: true } } } },
      ptAssignments: { orderBy: { createdAt: "desc" }, include: { trainer: { select: { name: true } }, slots: { where: { status: "SCHEDULED" }, orderBy: { at: "asc" }, take: 12 }, sessions: { orderBy: { at: "desc" }, take: 5, include: { trainer: { select: { name: true } } } } } },
      documents: { orderBy: { createdAt: "desc" } },
      user: { select: { active: true } },
      measurements: { orderBy: { at: "desc" }, take: 10 },
      fitnessPlans: { orderBy: [{ active: "desc" }, { updatedAt: "desc" }], include: { author: { select: { name: true } } } },
      locker: { select: { id: true, number: true, until: true } },
      noteLog: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      checkIns: { orderBy: { checkedInAt: "desc" }, take: 5 },
      invoices: { orderBy: { issuedAt: "desc" }, select: { id: true, number: true, totalPaise: true, paidPaise: true, issuedAt: true, notes: true, membership: { select: { plan: { select: { name: true } } } } } },
    },
  });
  if (!m) notFound();
  const [plans, trainers] = await Promise.all([plansQ, db.user.findMany({ where: { gymId, role: { in: ["TRAINER", "OWNER"] }, active: true }, select: { id: true, name: true, commissionPercent: true }, orderBy: { name: "asc" } })]);
  const activePt = m.ptAssignments.find((a) => !a.endDate);
  const ptMemberships = m.memberships.filter((ms) => ms.plan.type === "PT" && (ms.status === "ACTIVE" || ms.status === "FROZEN")).map((ms) => ({ id: ms.id, label: `${ms.plan.name} (${fmtDate(ms.startDate)})`, ptSessions: ms.plan.ptSessions, pricePaise: ms.pricePaise - ms.discountPaise }));
  const write = can(role, "members:write");
  const fitness = can(role, "fitness:write");
  const bmiNow = bmi(trend(m.measurements, "weightKg")?.latest, trend(m.measurements, "heightCm")?.latest);
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  const current = m.memberships.find((ms) => ms.status === "ACTIVE" || ms.status === "FROZEN" || ms.status === "SUSPENDED") ?? m.memberships[0];
  const live = current && (current.status === "ACTIVE" || current.status === "FROZEN" || current.status === "SUSPENDED") ? current : null;
  const now = new Date();
  const dues = m.invoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-slate-500">{k}</dt><dd className="text-right">{v || "—"}</dd></div>
  );

  return (
    <AppShell title={name} back={{ href: "/members", label: "Members" }} actions={<><ButtonLink href={`/members/${m.id}/card`} secondary>QR card</ButtonLink>{write && <ButtonLink href={`/members/${m.id}/edit`} secondary>Edit</ButtonLink>}</>}>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mb-4 flex items-center gap-4 p-4">
        <Avatar name={name} photoUrl={m.photoUrl} size={72} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-slate-500">{m.code}</span><StatusBadge status={current?.status ?? "NONE"} /></div>
          <div className="text-lg">{m.phone}</div>
          {current && <div className="text-sm text-slate-500">{current.plan.name} · {fmtDate(current.startDate)} to {fmtDate(current.endDate)}</div>}
          {dues > 0 && <div className="text-sm font-medium text-red-700">Dues {paise(dues)}</div>}
          {m.locker && <div className="text-sm text-slate-500">Locker #{m.locker.number}{m.locker.until && ` till ${fmtDate(m.locker.until)}`} · <Link href="/lockers" className="font-medium text-brand-700 hover:underline">lockers</Link></div>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mb-4 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Membership</h2>
        {live ? (
          <p className="mb-3 text-sm text-slate-600">
            {live.plan.name}, {live.status === "FROZEN" ? `frozen since ${fmtDate(live.frozenAt)}` : live.status === "SUSPENDED" ? `suspended since ${fmtDate(live.suspendedAt)} (${live.suspendReason ?? "dues unpaid"}; restores on payment)` : `${Math.max(0, Math.ceil((live.endDate.getTime() - now.getTime()) / 86400000))} days left`}, ends {fmtDate(live.endDate)}
            {live.frozenDays > 0 && ` (${live.frozenDays} frozen days added)`}
          </p>
        ) : <p className="mb-3 text-sm text-slate-600">{current ? `Last plan ${current.plan.name} ${current.status.toLowerCase()} on ${fmtDate(current.endDate)}.` : "No plan yet."}</p>}
        {write && (
          <MembershipPanel
            memberId={m.id}
            plans={plans}
            current={live ? { id: live.id, status: live.status as "ACTIVE" | "FROZEN" | "SUSPENDED", endDate: live.endDate, planName: live.plan.name, credit: prorataCredit(live, now) } : null}
            renewFrom={renewalStart(live, new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))}
          />
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h2 className="mb-2 font-semibold text-slate-900">Profile</h2>
          <dl className="divide-y divide-slate-100">
            {row("Email", m.email)}
            {row("Gender", m.gender?.toLowerCase())}
            {row("Date of birth", fmtDate(m.dob))}
            {row("Usual time", m.usualTime)}
            {row("Joined", fmtDate(m.joinedAt))}
            {row("Address", m.address)}
          </dl>
          <h2 className="mb-2 mt-4 font-semibold text-slate-900">Emergency contact</h2>
          <dl className="divide-y divide-slate-100">{row("Name", m.emergencyName)}{row("Phone", m.emergencyPhone && <a href={`tel:${m.emergencyPhone}`} className="font-medium text-brand-700 hover:underline">{m.emergencyPhone}</a>)}</dl>
          {m.notes && <><h2 className="mb-1 mt-4 font-semibold text-slate-900">Profile notes</h2><p className="whitespace-pre-wrap text-sm text-slate-700">{m.notes}</p></>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h2 className="mb-2 font-semibold text-slate-900">Documents</h2>
          {m.documents.length === 0 ? <p className="text-sm text-slate-500">No documents.</p> : (
            <ul className="divide-y text-sm divide-slate-100">
              {m.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-1">
                  <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">{d.label}</a>
                  <span className="flex items-center gap-2 text-slate-500">
                    {fmtDate(d.createdAt)}
                    {write && <form action={deleteDocument.bind(null, m.id, d.id)}><button className="text-red-600 hover:underline">Remove</button></form>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {write && <DocumentForm memberId={m.id} />}

          <h2 className="mb-2 mt-6 flex justify-between font-semibold text-slate-900">Recent check-ins <Link href={`/attendance?member=${m.id}`} className="text-sm font-normal font-medium text-brand-700 hover:underline">All</Link></h2>
          {m.checkIns.length === 0 ? <p className="text-sm text-slate-500">No check-ins yet.</p> : (
            <ul className="text-sm text-slate-700">{m.checkIns.map((c) => <li key={c.id}>{c.checkedInAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Personal training</h2>
        {activePt ? (
          <div className="space-y-2">
            <p className="text-sm">{activePt.trainer.name} · {activePt.sessionsUsed}/{activePt.sessionsTotal} sessions, <strong>{sessionsLeft(activePt)} left</strong>{activePt.feePaise > 0 && ` · fee ${paise(activePt.feePaise)}`} · since {fmtDate(activePt.startDate)}</p>
            {can(role, "checkin:write") && <div className="flex gap-2"><div className="flex-1"><LogSessionForm assignmentId={activePt.id} /></div>{write && <form action={endPt.bind(null, activePt.id)}><button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-2 py-1 text-xs text-red-700">End</button></form>}</div>}
            <div className="rounded-lg bg-slate-50 p-2 text-sm">
              <div className="mb-1 flex items-center justify-between"><span className="font-medium">Upcoming slots</span><Link href={`/staff/pt/schedule?trainer=${activePt.trainerId}`} className="text-xs font-medium text-brand-700 hover:underline">Trainer's day</Link></div>
              {activePt.slots.length === 0 ? <p className="text-xs text-slate-500">No slots booked.</p> : <ul className="space-y-0.5">{activePt.slots.map((s) => <li key={s.id} className="flex items-center justify-between"><span>{fmtSlot(s.at)} · {s.durationMin} min</span>{can(role, "checkin:write") && <form action={markSlot.bind(null, s.id, "CANCELLED")}><button className="text-xs text-red-700 underline">Cancel</button></form>}</li>)}</ul>}
              {can(role, "checkin:write") && <div className="mt-2"><PtSlotForm assignmentId={activePt.id} left={sessionsLeft(activePt) - activePt.slots.length} /></div>}
            </div>
            {activePt.sessions.length > 0 && <ul className="text-xs text-slate-500">{activePt.sessions.map((s) => <li key={s.id}>{s.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {s.trainer.name}{s.notes && ` · ${s.notes}`}</li>)}</ul>}
          </div>
        ) : <p className="mb-2 text-sm text-slate-500">{m.ptAssignments[0] ? `Last PT with ${m.ptAssignments[0].trainer.name}, ${m.ptAssignments[0].sessionsUsed}/${m.ptAssignments[0].sessionsTotal} sessions.` : "No trainer assigned."}</p>}
        {write && !activePt && (trainers.length ? <div className="mt-2"><AssignPtForm memberId={m.id} trainers={trainers} memberships={ptMemberships} /></div> : <p className="text-sm text-slate-500">Invite a trainer under Staff first.</p>)}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-2 flex items-center justify-between font-semibold text-slate-900">Billing {dues > 0 && <span className="text-red-700">{paise(dues)} due</span>}</h2>
        {can(role, "payments:write") && dues > 0 && <div className="mb-3"><CollectForm memberId={m.id} duePaise={dues} /></div>}
        {m.invoices.length === 0 ? <p className="text-sm text-slate-500">No invoices yet.</p> : (
          <ul className="divide-y text-sm divide-slate-100">
            {m.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-1">
                <Link href={`/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.number}</Link>
                <span className="flex-1 truncate text-slate-500">{i.membership?.plan.name ?? i.notes} · {fmtDate(i.issuedAt)}</span>
                <span className={i.totalPaise > i.paidPaise ? "font-medium text-red-700" : "text-green-700"}>{i.totalPaise > i.paidPaise ? <>{paise(i.totalPaise - i.paidPaise)} due{can(role, "payments:write") && <> · <Link href={`/invoices/${i.id}`} className="font-normal font-medium text-brand-700 hover:underline">UPI QR</Link></>}</> : "Paid"}</span>
                <span className="w-20 text-right">{paise(i.totalPaise)}</span>
                {can(role, "payments:write") && <ReceiptShare invoiceId={i.id} label="WhatsApp" />}
              </li>
            ))}
          </ul>
        )}
        {can(role, "payments:write") && <ChargeForm memberId={m.id} />}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-2 flex items-center justify-between font-semibold text-slate-900">Body measurements <Link href={`/members/${m.id}/progress`} className="text-sm font-normal font-medium text-brand-700 hover:underline">History & chart</Link></h2>
        {m.measurements.length === 0 ? <p className="mb-2 text-sm text-slate-500">Nothing recorded yet.</p> : (
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            {MEASURE_FIELDS.map(([k, label, u]) => { const t = trend(m.measurements, k); return t ? <span key={k}><span className="text-slate-500">{label}</span> <strong>{t.latest}</strong> {u}{t.delta != null && t.delta !== 0 && <span className={t.delta < 0 ? "text-green-700" : "text-amber-700"}> ({t.delta > 0 ? "+" : ""}{t.delta})</span>}</span> : null; })}
            {bmiNow && <span><span className="text-slate-500">BMI</span> <strong>{bmiNow}</strong></span>}
            <span className="text-slate-400">last {fmtDate(m.measurements[0].at)}</span>
          </div>
        )}
        {fitness && <MeasurementForm memberId={m.id} />}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Diet & workout plans</h2>
        {m.fitnessPlans.length === 0 && <p className="mb-2 text-sm text-slate-500">No plans given yet. The member sees active plans in their app.</p>}
        <ul className="space-y-2">
          {m.fitnessPlans.map((p) => (
            <li key={p.id} className={`rounded-lg border p-3 text-sm ${p.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{p.type === "DIET" ? "Diet" : "Workout"}:</strong> {p.title} <span className="text-slate-500">· {p.author?.name ?? "—"} · {fmtDate(p.updatedAt)}{!p.active && " · inactive"}</span></span>
                {fitness && <span className="flex gap-3">{p.active && <PlanEditor memberId={m.id} plan={{ id: p.id, type: p.type, title: p.title, body: p.body }} />}<form action={setPlanActive.bind(null, m.id, p.id, !p.active)}><button className="text-xs font-medium text-brand-700 hover:underline">{p.active ? "Deactivate" : "Reactivate"}</button></form></span>}
              </div>
              {p.active && <details className="mt-1"><summary className="cursor-pointer text-xs text-slate-500">Show plan</summary><pre className="mt-1 whitespace-pre-wrap font-sans text-sm">{p.body}</pre></details>}
            </li>
          ))}
        </ul>
        {fitness && <div className="mt-2"><PlanEditor memberId={m.id} /></div>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-1 font-semibold text-slate-900">Member app login</h2>
        <p className="mb-2 text-sm text-slate-500">{m.user?.active ? "Login is on. The member signs in at /login with gym code, phone and PIN to see plan, dues, QR and attendance." : m.user ? "Login is switched off." : "Not set up. Enable to give the member a PIN for the member portal."}</p>
        {write && <div className="flex flex-wrap items-start gap-2">
          <MemberAccessButton action={enableMemberAccess.bind(null, m.id)} label={m.user ? "Reset PIN" : "Enable login"} phone={m.phone} />
          {m.user?.active && <form action={disableMemberAccess.bind(null, m.id)}><button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-1 text-sm text-red-700">Disable</button></form>}
        </div>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Notes</h2>
        {write && <NoteForm memberId={m.id} />}
        {write && <CustomMessageForm memberId={m.id} hasEmail={!!m.email} />}
        {m.noteLog.length === 0 ? <p className="text-sm text-slate-500">No notes yet.</p> : (
          <ul className="mt-3 divide-y divide-slate-100">
            {m.noteLog.map((n) => (
              <li key={n.id} className="py-2">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 flex gap-2 text-xs text-slate-500">
                  {n.author.name} · {n.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {write && <form action={deleteNote.bind(null, m.id, n.id)}><button className="text-red-600 hover:underline">Delete</button></form>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {m.memberships.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
          <h2 className="mb-2 font-semibold text-slate-900">Membership history</h2>
          <ul className="divide-y text-sm divide-slate-100">{m.memberships.map((ms) => <li key={ms.id} className="flex flex-wrap items-center justify-between gap-2 py-1"><span>{ms.plan.name} <span className="text-slate-400">{paise(ms.pricePaise - ms.discountPaise)}{ms.discountPaise > 0 && ` (−${paise(ms.discountPaise)})`}</span></span><span className="text-slate-500">{fmtDate(ms.startDate)} – {fmtDate(ms.endDate)}{ms.cancelReason && ` · ${ms.cancelReason}`}</span><StatusBadge status={ms.status} /></li>)}</ul>
        </section>
      )}
    </AppShell>
  );
}
