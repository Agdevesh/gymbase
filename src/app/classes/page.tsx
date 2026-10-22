import Link from "next/link";
import { db } from "@/lib/db";
import { WEEKDAYS, dateKey, dbDate, fmtTime, occurrences } from "@/lib/classes";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { ClassForm } from "@/components/class-forms";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const { gymId, role } = await requireTenant("members:read");
  const manage = can(role, "gym:manage");
  const now = new Date();
  const [classes, trainers] = await Promise.all([
    db.gymClass.findMany({ where: { gymId, ...(manage ? {} : { active: true }) }, orderBy: [{ active: "desc" }, { startTime: "asc" }], include: { trainer: { select: { name: true } } } }),
    manage ? db.user.findMany({ where: { gymId, role: { in: ["TRAINER", "OWNER"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const upcoming = occurrences(classes.filter((c) => c.active), now, 7);
  const counts = await db.classBooking.groupBy({ by: ["classId", "date"], where: { gymId, date: { gte: dbDate(dateKey(now)) }, status: { in: ["BOOKED", "ATTENDED"] } }, _count: true });
  const booked = (classId: string, dayKey: string) => counts.find((c) => c.classId === classId && c.date.getTime() === dbDate(dayKey).getTime())?._count ?? 0;
  const byDay = WEEKDAYS.map((label, i) => ({ label, i, classes: classes.filter((c) => c.active && c.weekdays.includes(i)) }));
  const todayKey = dateKey(now);

  return (
    <AppShell title="Classes" actions={manage && <ClassForm trainers={trainers} />}>
      {classes.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-slate-500">No group classes yet.{manage && " Add Zumba, yoga, HIIT or any batch with a fixed time."}</p> : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm mb-4 p-4">
            <h2 className="mb-2 font-semibold text-slate-900">Next 7 days</h2>
            {upcoming.length === 0 ? <p className="text-sm text-slate-500">No sessions scheduled.</p> : (
              <ul className="divide-y text-sm divide-slate-100">
                {upcoming.map((o) => { const n = booked(o.cls.id, o.dayKey); return (
                  <li key={o.cls.id + o.dayKey} className="flex items-center justify-between gap-2 py-1.5">
                    <Link href={`/classes/${o.cls.id}?date=${o.dayKey}`} className="hover:underline"><span className={o.dayKey === todayKey ? "font-medium" : ""}>{o.dayKey === todayKey ? "Today" : o.at.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span> · {fmtTime(o.cls.startTime)} · {o.cls.name}{o.cls.trainer && <span className="text-slate-500"> · {o.cls.trainer.name}</span>}</Link>
                    <span className={`whitespace-nowrap text-xs ${n >= o.cls.capacity ? "text-red-700" : "text-slate-500"}`}>{n}/{o.cls.capacity}{n >= o.cls.capacity && " full"}</span>
                  </li>); })}
              </ul>
            )}
          </section>
          <section className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {byDay.filter((d) => d.classes.length).map((d) => (
              <div key={d.i} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-sm">
                <h3 className="mb-1 font-medium">{d.label}</h3>
                <ul className="space-y-1">{d.classes.map((c) => <li key={c.id}><Link href={`/classes/${c.id}`} className="hover:underline">{fmtTime(c.startTime)} {c.name}</Link>{c.trainer && <span className="text-slate-500"> · {c.trainer.name}</span>}</li>)}</ul>
              </div>
            ))}
          </section>
          {manage && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
              <h2 className="mb-2 font-semibold text-slate-900">All classes</h2>
              <ul className="divide-y text-sm divide-slate-100">
                {classes.map((c) => (
                  <li key={c.id} className={`py-2 ${c.active ? "" : "text-slate-400"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><strong>{c.name}</strong> · {c.weekdays.map((w) => WEEKDAYS[w]).join(", ")} · {fmtTime(c.startTime)} · {c.durationMin} min · {c.capacity} seats{c.trainer && ` · ${c.trainer.name}`}{!c.active && " · inactive"}</span>
                      <ClassForm trainers={trainers} initial={c} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
