import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { deleteDocument, deleteNote } from "@/server/members";
import { AppShell, Avatar, ButtonLink, StatusBadge } from "@/components/ui";
import { DocumentForm, NoteForm } from "@/components/member-detail-forms";

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const paise = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId, role } = await requireTenant("members:read");
  const { id } = await params;
  const m = await db.member.findFirst({
    where: { id, gymId },
    include: {
      memberships: { orderBy: { endDate: "desc" }, include: { plan: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      noteLog: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      checkIns: { orderBy: { checkedInAt: "desc" }, take: 5 },
      invoices: { select: { totalPaise: true, paidPaise: true } },
    },
  });
  if (!m) notFound();
  const write = can(role, "members:write");
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  const current = m.memberships[0];
  const dues = m.invoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-neutral-500">{k}</dt><dd className="text-right">{v || "—"}</dd></div>
  );

  return (
    <AppShell title={name} back={{ href: "/members", label: "Members" }} actions={write && <ButtonLink href={`/members/${m.id}/edit`} secondary>Edit</ButtonLink>}>
      <section className="mb-4 flex items-center gap-4 rounded border bg-white p-4">
        <Avatar name={name} photoUrl={m.photoUrl} size={72} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-neutral-500">{m.code}</span><StatusBadge status={current?.status ?? "NONE"} /></div>
          <div className="text-lg">{m.phone}</div>
          {current && <div className="text-sm text-neutral-500">{current.plan.name} · {fmtDate(current.startDate)} to {fmtDate(current.endDate)}</div>}
          {dues > 0 && <div className="text-sm font-medium text-red-700">Dues {paise(dues)}</div>}
        </div>
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

          <h2 className="mb-2 mt-6 font-medium">Recent check-ins</h2>
          {m.checkIns.length === 0 ? <p className="text-sm text-neutral-500">No check-ins yet.</p> : (
            <ul className="text-sm text-neutral-700">{m.checkIns.map((c) => <li key={c.id}>{c.checkedInAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Notes</h2>
        {write && <NoteForm memberId={m.id} />}
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

      {m.memberships.length > 1 && (
        <section className="mt-4 rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Membership history</h2>
          <ul className="divide-y text-sm">{m.memberships.map((ms) => <li key={ms.id} className="flex justify-between py-1"><span>{ms.plan.name}</span><span className="text-neutral-500">{fmtDate(ms.startDate)} – {fmtDate(ms.endDate)}</span><StatusBadge status={ms.status} /></li>)}</ul>
        </section>
      )}
    </AppShell>
  );
}
