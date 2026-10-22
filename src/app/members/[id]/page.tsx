import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { deleteDocument, deleteNote } from "@/server/members";
import { AppShell, Avatar, ButtonLink, StatusBadge } from "@/components/ui";
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
      ptAssignments: { orderBy: { createdAt: "desc" }, include: { trainer: { select: { name: true } }, sessions: { orderBy: { at: "desc" }, take: 5, include: { trainer: { select: { name: true } } } } } },
      documents: { orderBy: { createdAt: "desc" } },
      user: { select: { active: true } },
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
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  const current = m.memberships.find((ms) => ms.status === "ACTIVE" || ms.status === "FROZEN") ?? m.memberships[0];
  const live = current && (current.status === "ACTIVE" || current.status === "FROZEN") ? current : null;
  const now = new Date();
  const dues = m.invoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-neutral-500">{k}</dt><dd className="text-right">{v || "—"}</dd></div>
  );

  return (
    <AppShell title={name} back={{ href: "/members", label: "Members" }} actions={<><ButtonLink href={`/members/${m.id}/card`} secondary>QR card</ButtonLink>{write && <ButtonLink href={`/members/${m.id}/edit`} secondary>Edit</ButtonLink>}</>}>
      <section className="mb-4 flex items-center gap-4 rounded border bg-white p-4">
        <Avatar name={name} photoUrl={m.photoUrl} size={72} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-neutral-500">{m.code}</span><StatusBadge status={current?.status ?? "NONE"} /></div>
          <div className="text-lg">{m.phone}</div>
          {current && <div className="text-sm text-neutral-500">{current.plan.name} · {fmtDate(current.startDate)} to {fmtDate(current.endDate)}</div>}
          {dues > 0 && <div className="text-sm font-medium text-red-700">Dues {paise(dues)}</div>}
        </div>
      </section>

      <section className="mb-4 rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Membership</h2>
        {live ? (
          <p className="mb-3 text-sm text-neutral-600">
            {live.plan.name}, {live.status === "FROZEN" ? `frozen since ${fmtDate(live.frozenAt)}` : `${Math.max(0, Math.ceil((live.endDate.getTime() - now.getTime()) / 86400000))} days left`}, ends {fmtDate(live.endDate)}
            {live.frozenDays > 0 && ` (${live.frozenDays} frozen days added)`}
          </p>
        ) : <p className="mb-3 text-sm text-neutral-600">{current ? `Last plan ${current.plan.name} ${current.status.toLowerCase()} on ${fmtDate(current.endDate)}.` : "No plan yet."}</p>}
        {write && (
          <MembershipPanel
            memberId={m.id}
            plans={plans}
            current={live ? { id: live.id, status: live.status as "ACTIVE" | "FROZEN", endDate: live.endDate, planName: live.plan.name, credit: prorataCredit(live, now) } : null}
            renewFrom={renewalStart(live, new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))}
          />
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Profile</h2>
          <dl className="divide-y">
            {row("Email", m.email)}
            {row("Gender", m.gender?.toLowerCase())}
            {row("Date of birth", fmtDate(m.dob))}
            {row("Usual time", m.usualTime)}
            {row("Joined", fmtDate(m.joinedAt))}
            {row("Address", m.address)}
          </dl>
          <h2 className="mb-2 mt-4 font-medium">Emergency contact</h2>
          <dl className="divide-y">{row("Name", m.emergencyName)}{row("Phone", m.emergencyPhone && <a href={`tel:${m.emergencyPhone}`} className="underline">{m.emergencyPhone}</a>)}</dl>
          {m.notes && <><h2 className="mb-1 mt-4 font-medium">Profile notes</h2><p className="whitespace-pre-wrap text-sm text-neutral-700">{m.notes}</p></>}
        </section>

        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Documents</h2>
          {m.documents.length === 0 ? <p className="text-sm text-neutral-500">No documents.</p> : (
            <ul className="divide-y text-sm">
              {m.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-1">
                  <a href={d.url} target="_blank" rel="noreferrer" className="underline">{d.label}</a>
                  <span className="flex items-center gap-2 text-neutral-500">
                    {fmtDate(d.createdAt)}
                    {write && <form action={deleteDocument.bind(null, m.id, d.id)}><button className="text-red-600 hover:underline">Remove</button></form>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {write && <DocumentForm memberId={m.id} />}

          <h2 className="mb-2 mt-6 flex justify-between font-medium">Recent check-ins <Link href={`/attendance?member=${m.id}`} className="text-sm font-normal underline">All</Link></h2>
          {m.checkIns.length === 0 ? <p className="text-sm text-neutral-500">No check-ins yet.</p> : (
            <ul className="text-sm text-neutral-700">{m.checkIns.map((c) => <li key={c.id}>{c.checkedInAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Personal training</h2>
        {activePt ? (
          <div className="space-y-2">
            <p className="text-sm">{activePt.trainer.name} · {activePt.sessionsUsed}/{activePt.sessionsTotal} sessions, <strong>{sessionsLeft(activePt)} left</strong>{activePt.feePaise > 0 && ` · fee ${paise(activePt.feePaise)}`} · since {fmtDate(activePt.startDate)}</p>
            {can(role, "checkin:write") && <div className="flex gap-2"><div className="flex-1"><LogSessionForm assignmentId={activePt.id} /></div>{write && <form action={endPt.bind(null, activePt.id)}><button className="rounded border px-2 py-1 text-xs text-red-700">End</button></form>}</div>}
            {activePt.sessions.length > 0 && <ul className="text-xs text-neutral-500">{activePt.sessions.map((s) => <li key={s.id}>{s.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {s.trainer.name}{s.notes && ` · ${s.notes}`}</li>)}</ul>}
          </div>
        ) : <p className="mb-2 text-sm text-neutral-500">{m.ptAssignments[0] ? `Last PT with ${m.ptAssignments[0].trainer.name}, ${m.ptAssignments[0].sessionsUsed}/${m.ptAssignments[0].sessionsTotal} sessions.` : "No trainer assigned."}</p>}
        {write && !activePt && (trainers.length ? <div className="mt-2"><AssignPtForm memberId={m.id} trainers={trainers} memberships={ptMemberships} /></div> : <p className="text-sm text-neutral-500">Invite a trainer under Staff first.</p>)}
      </section>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-2 flex items-center justify-between font-medium">Billing {dues > 0 && <span className="text-red-700">{paise(dues)} due</span>}</h2>
        {can(role, "payments:write") && dues > 0 && <div className="mb-3"><CollectForm memberId={m.id} duePaise={dues} /></div>}
        {m.invoices.length === 0 ? <p className="text-sm text-neutral-500">No invoices yet.</p> : (
          <ul className="divide-y text-sm">
            {m.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-1">
                <Link href={`/invoices/${i.id}`} className="underline">{i.number}</Link>
                <span className="flex-1 truncate text-neutral-500">{i.membership?.plan.name ?? i.notes} · {fmtDate(i.issuedAt)}</span>
                <span className={i.totalPaise > i.paidPaise ? "font-medium text-red-700" : "text-green-700"}>{i.totalPaise > i.paidPaise ? `${paise(i.totalPaise - i.paidPaise)} due` : "Paid"}</span>
                <span className="w-20 text-right">{paise(i.totalPaise)}</span>
              </li>
            ))}
          </ul>
        )}
        {can(role, "payments:write") && <ChargeForm memberId={m.id} />}
      </section>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-1 font-medium">Member app login</h2>
        <p className="mb-2 text-sm text-neutral-500">{m.user?.active ? "Login is on. The member signs in at /login with gym code, phone and PIN to see plan, dues, QR and attendance." : m.user ? "Login is switched off." : "Not set up. Enable to give the member a PIN for the member portal."}</p>
        {write && <div className="flex flex-wrap items-start gap-2">
          <MemberAccessButton action={enableMemberAccess.bind(null, m.id)} label={m.user ? "Reset PIN" : "Enable login"} phone={m.phone} />
          {m.user?.active && <form action={disableMemberAccess.bind(null, m.id)}><button className="rounded border bg-white px-3 py-1 text-sm text-red-700 hover:bg-neutral-100">Disable</button></form>}
        </div>}
      </section>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Notes</h2>
        {write && <NoteForm memberId={m.id} />}
        {write && <CustomMessageForm memberId={m.id} hasEmail={!!m.email} />}
        {m.noteLog.length === 0 ? <p className="text-sm text-neutral-500">No notes yet.</p> : (
          <ul className="mt-3 divide-y">
            {m.noteLog.map((n) => (
              <li key={n.id} className="py-2">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 flex gap-2 text-xs text-neutral-500">
                  {n.author.name} · {n.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {write && <form action={deleteNote.bind(null, m.id, n.id)}><button className="text-red-600 hover:underline">Delete</button></form>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {m.memberships.length > 0 && (
        <section className="mt-4 rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Membership history</h2>
          <ul className="divide-y text-sm">{m.memberships.map((ms) => <li key={ms.id} className="flex flex-wrap items-center justify-between gap-2 py-1"><span>{ms.plan.name} <span className="text-neutral-400">{paise(ms.pricePaise - ms.discountPaise)}{ms.discountPaise > 0 && ` (−${paise(ms.discountPaise)})`}</span></span><span className="text-neutral-500">{fmtDate(ms.startDate)} – {fmtDate(ms.endDate)}{ms.cancelReason && ` · ${ms.cancelReason}`}</span><StatusBadge status={ms.status} /></li>)}</ul>
        </section>
      )}
    </AppShell>
  );
}
