import Link from "next/link";
import { db } from "@/lib/db";
import { paise } from "@/lib/payments";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { deleteLocker, releaseLocker } from "@/server/fitness";
import { AppShell } from "@/components/ui";
import { AddLockersForm, AssignLockerForm } from "@/components/fitness-forms";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function LockersPage() {
  const { gymId, role } = await requireTenant("members:read");
  const manage = can(role, "gym:manage"), write = can(role, "members:write");
  const [lockers, members] = await Promise.all([
    db.locker.findMany({ where: { gymId }, include: { member: { select: { id: true, firstName: true, lastName: true, code: true } } } }),
    write ? db.member.findMany({ where: { gymId, locker: null }, select: { id: true, firstName: true, lastName: true, code: true }, orderBy: { firstName: "asc" }, take: 2000 }) : [],
  ]);
  lockers.sort((a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number));
  const now = new Date();
  const taken = lockers.filter((l) => l.memberId).length;
  const options = members.map((m) => ({ id: m.id, label: `${m.code} ${m.firstName} ${m.lastName ?? ""}`.trim() }));
  return (
    <AppShell title="Lockers" actions={<span className="text-sm text-neutral-500">{taken}/{lockers.length} in use</span>}>
      {manage && <section className="mb-4 rounded border bg-white p-4"><h2 className="mb-2 font-medium">Add lockers</h2><AddLockersForm /></section>}
      {lockers.length === 0 ? <p className="rounded border bg-white p-6 text-center text-neutral-500">No lockers yet.{manage && " Add a range above."}</p> : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {lockers.map((l) => { const overdue = l.until && l.until < now; return (
            <div key={l.id} className={`rounded border p-3 text-sm ${l.memberId ? (overdue ? "bg-red-50" : "bg-green-50") : "bg-white"}`}>
              <div className="flex items-center justify-between"><span className="text-lg font-semibold">#{l.number}</span>{l.feePaise > 0 && <span className="text-xs text-neutral-500">{paise(l.feePaise)}/mo</span>}</div>
              {l.member ? <>
                <Link href={`/members/${l.member.id}`} className="block truncate font-medium hover:underline">{l.member.firstName} {l.member.lastName}</Link>
                <div className="text-xs text-neutral-500">{l.member.code}{l.until && ` · till ${fmt(l.until)}`}{overdue && <span className="text-red-700"> · overdue</span>}</div>
                {write && <form action={releaseLocker.bind(null, l.id)}><button className="mt-1 text-xs underline">Release</button></form>}
              </> : <>
                <div className="text-xs text-neutral-500">Free</div>
                {write && <AssignLockerForm lockerId={l.id} feePaise={l.feePaise} members={options} />}
                {manage && <form action={deleteLocker.bind(null, l.id)}><button className="mt-1 text-xs text-red-700 underline">Remove</button></form>}
              </>}
            </div>); })}
        </div>
      )}
    </AppShell>
  );
}
