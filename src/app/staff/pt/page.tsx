import Link from "next/link";
import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { sessionsLeft } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { endPt } from "@/server/staff";
import { can } from "@/lib/rbac";
import { AppShell, Avatar } from "@/components/ui";
import { LogSessionForm } from "@/components/staff-forms";

export const dynamic = "force-dynamic";

export default async function PtPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { gymId, userId, role } = await requireTenant("checkin:write");
  const { all } = await searchParams;
  const mineOnly = role === "TRAINER";
  const rows = await db.ptAssignment.findMany({
    where: { gymId, ...(mineOnly && { trainerId: userId }), ...(!all && { endDate: null }) },
    orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
    include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } }, trainer: { select: { name: true } }, sessions: { orderBy: { at: "desc" }, take: 1 } },
  });
  return (
    <AppShell title={mineOnly ? "My PT clients" : "PT clients"} back={{ href: "/staff", label: "Staff" }} actions={<Link href={all ? "/staff/pt" : "/staff/pt?all=1"} className="text-sm underline">{all ? "Active only" : "Include finished"}</Link>}>
      {rows.length === 0 ? <p className="rounded border bg-white p-6 text-center text-neutral-500">No PT clients.</p> : (
        <ul className="divide-y rounded border bg-white">
          {rows.map((a) => {
            const name = [a.member.firstName, a.member.lastName].filter(Boolean).join(" ");
            const left = sessionsLeft(a);
            return (
              <li key={a.id} className="space-y-2 px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={name} photoUrl={a.member.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/members/${a.member.id}`} className="font-medium underline">{name}</Link>
                    <div className="text-sm text-neutral-500">{!mineOnly && `${a.trainer.name} · `}{a.sessionsUsed}/{a.sessionsTotal} sessions{a.feePaise > 0 && ` · ${paise(a.feePaise)}`}{a.sessions[0] && ` · last ${a.sessions[0].at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}</div>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-sm ${a.endDate ? "bg-neutral-100 text-neutral-500" : left <= 2 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{a.endDate ? "finished" : `${left} left`}</span>
                </div>
                {!a.endDate && <div className="flex gap-2"><div className="flex-1"><LogSessionForm assignmentId={a.id} /></div>{can(role, "members:write") && <form action={endPt.bind(null, a.id)}><button className="rounded border bg-white px-2 py-1 text-xs text-red-700 hover:bg-neutral-100">End</button></form>}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
