import Link from "next/link";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/members";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { AppShell, Avatar, ButtonLink, StatusBadge, inputClass } from "@/components/ui";

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
        id: true, code: true, firstName: true, lastName: true, phone: true, photoUrl: true,
        memberships: { orderBy: { endDate: "desc" }, take: 1, select: { status: true, endDate: true, plan: { select: { name: true } } } },
      },
    }),
    db.member.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <AppShell title={`Members (${total})`} actions={can(role, "members:write") && <ButtonLink href="/members/new">+ Add member</ButtonLink>}>
      <form className="mb-4 flex gap-2" action="/members">
        <input name="q" defaultValue={q} placeholder="Search name, phone, code or email" autoFocus className={inputClass} type="search" />
        <button className="rounded border border-neutral-300 bg-white px-4 text-sm">Search</button>
      </form>
      {members.length === 0 ? (
        <p className="rounded border bg-white p-6 text-center text-neutral-500">{term ? `No members match "${term}".` : "No members yet."}</p>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {members.map((m) => {
            const ms = m.memberships[0];
            const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
            return (
              <li key={m.id}>
                <Link href={`/members/${m.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none">
                  <Avatar name={name} photoUrl={m.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name} <span className="font-normal text-neutral-400">{m.code}</span></div>
                    <div className="truncate text-sm text-neutral-500">{m.phone}{ms && ` · ${ms.plan.name} till ${ms.endDate.toLocaleDateString("en-IN")}`}</div>
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
          <span className="text-neutral-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/members?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next →</Link> : <span />}
        </div>
      )}
    </AppShell>
  );
}
