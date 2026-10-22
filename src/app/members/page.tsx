import Link from "next/link";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/members";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { Avatar, ButtonLink, StatusBadge, inputClass } from "@/components/ui";

const PAGE = 50;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { gymId, role } = await requireTenant("members:read");
  const { q = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const term = q.trim();
  const phone = term ? normalizePhone(term) : null;

  const where = {
    gymId,
    ...(term && {
      OR: [
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
        { code: { contains: term.toUpperCase() } },
        { phone: { contains: phone ?? (term.replace(/\D/g, "") || term) } },
        { email: { contains: term, mode: "insensitive" as const } },
      ],
    }),
  };
  const [members, total] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, code: true, firstName: true, lastName: true, phone: true, photoUrl: true, usualTime: true,
        memberships: { orderBy: { endDate: "desc" }, take: 1, select: { status: true, endDate: true, plan: { select: { name: true } } } },
      },
    }),
    db.member.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <AppShell title={`Members (${total})`} actions={can(role, "members:write") && <><ButtonLink href="/members/import" secondary>Import</ButtonLink><ButtonLink href="/members/new">+ Add member</ButtonLink></>}>
      <form className="mb-4 flex gap-2" action="/members">
        <input name="q" defaultValue={q} placeholder="Search name, phone, code or email" autoFocus className={inputClass} type="search" />
        <button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-4 text-sm">Search</button>
      </form>
      {members.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-slate-500">{term ? `No members match "${term}".` : "No members yet."}</p>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {members.map((m) => {
            const ms = m.memberships[0];
            const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
            return (
              <li key={m.id}>
                <Link href={`/members/${m.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">
                  <Avatar name={name} photoUrl={m.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name} <span className="font-normal text-slate-400">{m.code}</span></div>
                    <div className="truncate text-sm text-slate-500">{m.phone}{m.usualTime && ` · ${m.usualTime}`}{ms && ` · ${ms.plan.name} till ${ms.endDate.toLocaleDateString("en-IN")}`}</div>
                  </div>
                  <StatusBadge status={ms?.status ?? "NONE"} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={`/members?q=${encodeURIComponent(q)}&page=${page - 1}`}>← Previous</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/members?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next →</Link> : <span />}
        </div>
      )}
    </AppShell>
  );
}
