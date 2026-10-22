import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OPEN_STATUSES, SOURCE_LABELS, STATUS_LABELS, followUpBucket } from "@/lib/leads";
import { requireTenant } from "@/server/tenant";
import { convertLead } from "@/server/leads";
import { AppShell } from "@/components/app-shell";
import { ButtonLink, buttonClass } from "@/components/ui";
import { LeadActivityForm } from "@/components/lead-activity-form";

const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId } = await requireTenant("leads:write");
  const { id } = await params;
  const lead = await db.lead.findFirst({
    where: { id, gymId },
    include: { owner: { select: { name: true } }, member: { select: { id: true, code: true } }, activity: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();
  const authors = await db.user.findMany({ where: { gymId, id: { in: lead.activity.map((a) => a.authorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const authorName = (id: string | null) => authors.find((a) => a.id === id)?.name;
  const open = OPEN_STATUSES.includes(lead.status);
  const bucket = followUpBucket(lead.followUpAt, new Date());
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-neutral-500">{k}</dt><dd className="text-right">{v || "—"}</dd></div>;

  return (
    <AppShell title={lead.name} back={{ href: "/leads", label: "Inquiries" }}
      actions={<>
        <ButtonLink href={`/leads/${lead.id}/edit`} secondary>Edit</ButtonLink>
        {lead.member ? <ButtonLink href={`/members/${lead.member.id}`}>Member {lead.member.code} →</ButtonLink>
          : open && <form action={convertLead.bind(null, lead.id)}><button className={buttonClass}>Convert to member</button></form>}
      </>}>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{STATUS_LABELS[lead.status]}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{SOURCE_LABELS[lead.source]}</span>
            {open && lead.followUpAt && <span className={`rounded px-2 py-0.5 text-xs ${bucket === "OVERDUE" ? "bg-red-100 text-red-800" : bucket === "TODAY" ? "bg-amber-100 text-amber-800" : "bg-neutral-100"}`}>Follow up {fmt(lead.followUpAt)}</span>}
          </div>
          <dl className="divide-y">
            {row("Phone", <span className="flex gap-2"><a href={`tel:${lead.phone}`} className="underline">{lead.phone}</a><a href={`https://wa.me/${lead.phone.replace("+", "")}`} target="_blank" rel="noreferrer" className="text-green-700 underline">WhatsApp</a></span>)}
            {row("Email", lead.email)}
            {row("Interested in", lead.interestedIn)}
            {row("Owner", lead.owner?.name)}
            {row("Added", fmt(lead.createdAt))}
            {lead.lostReason && row("Lost because", lead.lostReason)}
          </dl>
          {lead.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{lead.notes}</p>}
        </section>
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Follow-ups</h2>
          {open ? <LeadActivityForm leadId={lead.id} status={lead.status} /> : <p className="text-sm text-neutral-500">This lead is {STATUS_LABELS[lead.status].toLowerCase()}.{lead.status === "LOST" && <> <Link href={`/leads/${lead.id}/edit`} className="underline">Edit</Link> to reopen by changing details, or log below.</>}</p>}
          {!open && lead.status === "LOST" && <div className="mt-3"><LeadActivityForm leadId={lead.id} status={lead.status} /></div>}
          <ul className="mt-4 divide-y">
            {lead.activity.length === 0 && <li className="py-2 text-sm text-neutral-500">No activity yet.</li>}
            {lead.activity.map((a) => <li key={a.id} className="py-2 text-sm"><p className="whitespace-pre-wrap">{a.note}</p><p className="text-xs text-neutral-500">{authorName(a.authorId) ? `${authorName(a.authorId)} · ` : ""}{fmt(a.createdAt)}</p></li>)}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
