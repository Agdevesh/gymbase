import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { LEAD_SOURCES, LEAD_STATUSES, OPEN_STATUSES, SOURCE_LABELS, STATUS_LABELS, followUpBucket, sourceFilter, statusFilter } from "@/lib/leads";
import { normalizePhone } from "@/lib/members";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { ButtonLink, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const chip = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`;
const BUCKET_STYLE = { OVERDUE: "bg-red-100 text-red-800", TODAY: "bg-amber-100 text-amber-800", UPCOMING: "bg-neutral-100 text-neutral-600", NONE: "" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; source?: string; q?: string }> }) {
  const { gymId } = await requireTenant("leads:write");
  const sp = await searchParams;
  const status = statusFilter.parse(sp.status);
  const source = sourceFilter.parse(sp.source);
  const q = (sp.q ?? "").trim();
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const phone = q ? normalizePhone(q) : null;

  const where: Prisma.LeadWhereInput = {
    gymId,
    ...(status === "OPEN" ? { status: { in: OPEN_STATUSES } } : status === "DUE" ? { status: { in: OPEN_STATUSES }, followUpAt: { lt: endOfToday } } : { status }),
    ...(source && { source }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: phone ?? (q.replace(/\D/g, "") || q) } }] }),
  };
  const link = (p: Partial<{ status: string; source: string; q: string }>) => {
    const u = new URLSearchParams({ status, ...(source && { source }), ...(q && { q }), ...p });
    for (const [k, v] of [...u]) if (!v) u.delete(k);
    return `/leads?${u}`;
  };

  const [leads, counts, dueCount, sourceCounts] = await Promise.all([
    db.lead.findMany({ where, orderBy: [{ followUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 200, include: { owner: { select: { name: true } } } }),
    db.lead.groupBy({ by: ["status"], where: { gymId }, _count: true }),
    db.lead.count({ where: { gymId, status: { in: OPEN_STATUSES }, followUpAt: { lt: endOfToday } } }),
    db.lead.groupBy({ by: ["source"], where: { gymId, status: { in: OPEN_STATUSES } }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const openCount = OPEN_STATUSES.reduce((n, s) => n + countOf(s), 0);
  const srcCount = (s: string) => sourceCounts.find((c) => c.source === s)?._count ?? 0;

  return (
    <AppShell title="Inquiries" actions={<ButtonLink href="/leads/new">+ Add lead</ButtonLink>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href={link({ status: "OPEN" })} className={chip(status === "OPEN")}>Open {openCount}</Link>
        <Link href={link({ status: "DUE" })} className={chip(status === "DUE")}>Due today {dueCount}</Link>
        {LEAD_STATUSES.map((s) => <Link key={s} href={link({ status: s })} className={chip(status === s)}>{STATUS_LABELS[s]} {countOf(s)}</Link>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Source:</span>
        <Link href={link({ source: "" })} className={chip(!source)}>All</Link>
        {LEAD_SOURCES.map((s) => <Link key={s} href={link({ source: s })} className={chip(source === s)}>{SOURCE_LABELS[s]}{srcCount(s) ? ` ${srcCount(s)}` : ""}</Link>)}
      </div>
      <form className="mb-4 flex gap-2" action="/leads">
        <input type="hidden" name="status" value={status} />{source && <input type="hidden" name="source" value={source} />}
        <input name="q" defaultValue={q} type="search" placeholder="Search name or phone" className={inputClass} />
        <button className="rounded border bg-white px-4 text-sm">Search</button>
      </form>
      {leads.length === 0 ? <p className="rounded border bg-white p-6 text-center text-neutral-500">No leads here.</p> : (
        <ul className="divide-y rounded border bg-white">
          {leads.map((l) => {
            const b = followUpBucket(l.followUpAt, now);
            return (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.name} <span className="font-normal text-neutral-400">{SOURCE_LABELS[l.source]}</span></div>
                    <div className="truncate text-sm text-neutral-500">{l.phone}{l.interestedIn && ` · ${l.interestedIn}`}{l.owner && ` · ${l.owner.name}`}</div>
                  </div>
                  {l.followUpAt && OPEN_STATUSES.includes(l.status) && <span className={`rounded px-2 py-0.5 text-xs ${BUCKET_STYLE[b]}`}>{b === "OVERDUE" ? "Overdue" : b === "TODAY" ? "Today" : l.followUpAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{STATUS_LABELS[l.status]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
