import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { WEEKDAYS, dateKey, dbDate, fmtTime, occurrences, runsOn } from "@/lib/classes";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { setBookingStatus } from "@/server/classes";
import { AppShell, Avatar } from "@/components/ui";
import { BookMemberForm } from "@/components/class-forms";

export const dynamic = "force-dynamic";

export default async function ClassRosterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { gymId, role } = await requireTenant("members:read");
  const { id } = await params;
  const { date } = await searchParams;
  const cls = await db.gymClass.findFirst({ where: { id, gymId }, include: { trainer: { select: { name: true } } } });
  if (!cls) notFound();
  const now = new Date();
  const next = occurrences([cls], now, 14);
  const dayKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : next[0]?.dayKey ?? dateKey(now);
  const write = can(role, "members:write"), mark = can(role, "checkin:write");
  const [bookings, members] = await Promise.all([
    db.classBooking.findMany({ where: { classId: cls.id, date: dbDate(dayKey) }, orderBy: { createdAt: "asc" }, include: { member: { select: { id: true, firstName: true, lastName: true, code: true, photoUrl: true, phone: true } } } }),
    write ? db.member.findMany({ where: { gymId, memberships: { some: { status: "ACTIVE" } } }, select: { id: true, firstName: true, lastName: true, code: true }, orderBy: { firstName: "asc" }, take: 2000 }) : [],
  ]);
  const live = bookings.filter((b) => b.status !== "CANCELLED");
  const btn = "rounded border bg-white px-2 py-0.5 text-xs hover:bg-neutral-100";
  const tone: Record<string, string> = { BOOKED: "", ATTENDED: "text-green-700", NO_SHOW: "text-red-700", CANCELLED: "text-neutral-400 line-through" };
  return (
    <AppShell title={`${cls.name} · ${fmtTime(cls.startTime)}`} back={{ href: "/classes", label: "Classes" }}>
      <p className="mb-3 text-sm text-neutral-500">{cls.weekdays.map((w) => WEEKDAYS[w]).join(", ")} · {cls.durationMin} min · {cls.capacity} seats{cls.trainer && ` · ${cls.trainer.name}`}{cls.notes && ` · ${cls.notes}`}</p>
      <div className="mb-4 flex flex-wrap gap-1">{next.slice(0, 8).map((o) => <Link key={o.dayKey} href={`/classes/${cls.id}?date=${o.dayKey}`} className={`rounded-full border px-3 py-1 text-xs ${o.dayKey === dayKey ? "bg-neutral-900 text-white" : "bg-white"}`}>{o.at.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</Link>)}</div>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 flex items-center justify-between font-medium">Roster for {new Date(`${dayKey}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} <span className={`text-sm font-normal ${live.length >= cls.capacity ? "text-red-700" : "text-neutral-500"}`}>{live.length}/{cls.capacity} booked</span></h2>
        {!runsOn(cls, dayKey) && <p className="mb-2 text-sm text-amber-800">This class does not run on that day.</p>}
        {bookings.length === 0 ? <p className="mb-3 text-sm text-neutral-500">Nobody booked yet.</p> : (
          <ul className="mb-3 divide-y text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-1.5">
                <Avatar name={b.member.firstName} photoUrl={b.member.photoUrl} size={28} />
                <Link href={`/members/${b.member.id}`} className={`flex-1 hover:underline ${tone[b.status]}`}>{b.member.firstName} {b.member.lastName} <span className="text-neutral-400">{b.member.code}</span></Link>
                <span className={`text-xs ${tone[b.status]}`}>{b.status.toLowerCase().replace("_", " ")}</span>
                {mark && b.status !== "CANCELLED" && <span className="flex gap-1">
                  {b.status !== "ATTENDED" && <form action={setBookingStatus.bind(null, b.id, "ATTENDED")}><button className={`${btn} text-green-800`}>Present</button></form>}
                  {b.status !== "NO_SHOW" && <form action={setBookingStatus.bind(null, b.id, "NO_SHOW")}><button className={btn}>No-show</button></form>}
                  {b.status === "BOOKED" && <form action={setBookingStatus.bind(null, b.id, "CANCELLED")}><button className={`${btn} text-red-700`}>Cancel</button></form>}
                </span>}
              </li>
            ))}
          </ul>
        )}
        {write && runsOn(cls, dayKey) && <BookMemberForm classId={cls.id} dayKey={dayKey} members={members.map((m) => ({ id: m.id, label: `${m.code} ${m.firstName} ${m.lastName ?? ""}`.trim() }))} />}
      </section>
    </AppShell>
  );
}
