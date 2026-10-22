import Link from "next/link";
import { db } from "@/lib/db";
import { fmtTimeOnly } from "@/lib/pt";
import { waLink } from "@/lib/portal";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { completeSlot, markSlot } from "@/server/ptslots";
import { AppShell } from "@/components/app-shell";
import { Avatar, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PtSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; trainer?: string }> }) {
  const { gymId, userId, role } = await requireTenant("checkin:write");
  const { date, trainer } = await searchParams;
  const now = new Date();
  const key = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(`${key}T00:00:00`), end = new Date(start.getTime() + 86400_000);
  const trainerId = role === "TRAINER" ? userId : trainer || undefined;
  const [slots, trainers, gym] = await Promise.all([
    db.ptSlot.findMany({ where: { gymId, at: { gte: start, lt: end }, ...(trainerId && { trainerId }) }, orderBy: { at: "asc" }, include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } }, assignment: { select: { sessionsTotal: true, sessionsUsed: true, trainer: { select: { name: true } } } } } }),
    role === "TRAINER" ? [] : db.user.findMany({ where: { gymId, role: { in: ["TRAINER", "OWNER"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { name: true } }),
  ]);
  const shift = (n: number) => new Date(start.getTime() + n * 86400_000).toISOString().slice(0, 10);
  const btn = "rounded border bg-white px-2 py-0.5 text-xs hover:bg-slate-100";
  const tone: Record<string, string> = { SCHEDULED: "", DONE: "bg-green-50", NO_SHOW: "bg-red-50", CANCELLED: "opacity-50" };
  const q = (d: string) => `/staff/pt/schedule?date=${d}${trainerId && role !== "TRAINER" ? `&trainer=${trainerId}` : ""}`;
  return (
    <AppShell title="PT schedule" back={{ href: "/staff/pt", label: "PT clients" }}>
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/staff/pt/schedule">
        <Link href={q(shift(-1))} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">←</Link>
        <input type="date" name="date" defaultValue={key} className={`${inputClass} w-auto`} />
        {trainers.length > 0 && <select name="trainer" defaultValue={trainerId ?? ""} className={`${inputClass} w-auto`}><option value="">All trainers</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
        <button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">Go</button>
        <Link href={q(shift(1))} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">→</Link>
        <span className="ml-auto text-sm text-slate-500">{slots.filter((s) => s.status !== "CANCELLED").length} sessions</span>
      </form>
      {slots.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-slate-500">No PT sessions booked for this day. Book slots from a member's profile.</p> : (
        <ul className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {slots.map((s) => { const mem = s.member; const name = [mem.firstName, mem.lastName].filter(Boolean).join(" "); const past = s.at.getTime() + s.durationMin * 60_000 < now.getTime(); return (
            <li key={s.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${tone[s.status]}`}>
              <span className="w-16 font-mono text-sm">{fmtTimeOnly(s.at)}</span>
              <Avatar name={name} photoUrl={s.member.photoUrl} size={28} />
              <div className="min-w-0 flex-1"><Link href={`/members/${s.member.id}`} className="font-medium hover:underline">{name}</Link><div className="text-xs text-slate-500">{s.durationMin} min{!trainerId && ` · ${s.assignment.trainer.name}`} · session {Math.min(s.assignment.sessionsUsed + 1, s.assignment.sessionsTotal)}/{s.assignment.sessionsTotal}{s.notes && ` · ${s.notes}`}</div></div>
              {s.status === "SCHEDULED" ? (
                <span className="flex flex-wrap items-center gap-1">
                  {!past && <a href={waLink(mem.phone, `Hi ${mem.firstName}, reminder: your PT session at ${gym.name} is on ${s.at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${fmtTimeOnly(s.at)}. See you!`)} target="_blank" rel="noreferrer" className={btn}>Remind</a>}
                  <form action={completeSlot.bind(null, s.id)} className="flex gap-1"><input name="notes" placeholder="Notes" className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 w-28 px-1 py-0.5 text-xs" /><button className={`${btn} text-green-800`}>Done</button></form>
                  <form action={markSlot.bind(null, s.id, "NO_SHOW")}><button className={btn}>No-show</button></form>
                  <form action={markSlot.bind(null, s.id, "CANCELLED")}><button className={`${btn} text-red-700`}>Cancel</button></form>
                </span>
              ) : <span className="text-xs text-slate-500">{s.status.toLowerCase().replace("_", " ")}</span>}
            </li>); })}
        </ul>
      )}
      {!can(role, "staff:manage") && <p className="mt-2 text-xs text-slate-500">Marking Done logs the session and reduces sessions left.</p>}
    </AppShell>
  );
}
