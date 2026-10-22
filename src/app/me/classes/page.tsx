import { db } from "@/lib/db";
import { BOOK_AHEAD_DAYS, dateKey, dbDate, fmtTime, occurrences } from "@/lib/classes";
import { memberBook, memberCancel } from "@/server/classes";
import { requireMember } from "@/server/portal";
import { MemberShell } from "@/components/member-shell";

export const dynamic = "force-dynamic";

export default async function PortalClasses() {
  const { member: m, gym } = await requireMember();
  const now = new Date();
  const [classes, mine, active] = await Promise.all([
    db.gymClass.findMany({ where: { gymId: gym.id, active: true }, include: { trainer: { select: { name: true } } } }),
    db.classBooking.findMany({ where: { memberId: m.id, date: { gte: dbDate(dateKey(now)) } } }),
    db.membership.findFirst({ where: { memberId: m.id, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const occ = occurrences(classes, now, BOOK_AHEAD_DAYS).filter((o) => o.at.getTime() + o.cls.durationMin * 60_000 > now.getTime());
  const counts = await db.classBooking.groupBy({ by: ["classId", "date"], where: { gymId: gym.id, date: { gte: dbDate(dateKey(now)) }, status: { in: ["BOOKED", "ATTENDED"] } }, _count: true });
  const booked = (classId: string, dayKey: string) => counts.find((c) => c.classId === classId && c.date.getTime() === dbDate(dayKey).getTime())?._count ?? 0;
  const myBooking = (classId: string, dayKey: string) => mine.find((b) => b.classId === classId && b.date.getTime() === dbDate(dayKey).getTime() && b.status !== "CANCELLED");
  let lastDay = "";
  return (
    <MemberShell gymName={gym.name} title="Classes">
      {classes.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-500">No group classes at the moment.</p> : !active && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">You need an active plan to book classes.</p>}
      <ul className="space-y-2">
        {occ.map((o) => {
          const n = booked(o.cls.id, o.dayKey), b = myBooking(o.cls.id, o.dayKey), full = n >= o.cls.capacity;
          const header = o.dayKey !== lastDay ? (lastDay = o.dayKey, <h2 className="mt-3 text-xs uppercase tracking-wide text-slate-500">{o.dayKey === dateKey(now) ? "Today" : o.at.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</h2>) : null;
          return (
            <li key={o.cls.id + o.dayKey}>
              {header}
              <div className={`mt-1 flex items-center justify-between gap-2 rounded-lg border p-3 text-sm ${b ? "border-green-300 bg-green-50" : "bg-white"}`}>
                <div><div className="font-medium">{fmtTime(o.cls.startTime)} · {o.cls.name}</div><div className="text-xs text-slate-500">{o.cls.durationMin} min{o.cls.trainer && ` · ${o.cls.trainer.name}`} · {full ? "Full" : `${o.cls.capacity - n} seats left`}</div></div>
                {b ? <form action={memberCancel.bind(null, b.id)}><button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-1 text-xs">{b.status === "ATTENDED" ? "Attended" : "Cancel"}</button></form>
                  : active && !full ? <form action={memberBook.bind(null, o.cls.id, o.dayKey)}><button className="rounded-lg bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700 shadow-sm font-medium">Book</button></form> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </MemberShell>
  );
}
