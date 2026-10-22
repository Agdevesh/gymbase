import Link from "next/link";
import { db } from "@/lib/db";
import { inGymSince } from "@/lib/checkin";
import { holidayOn } from "@/lib/settings";
import { localDateKey } from "@/lib/payments";
import { requireTenant } from "@/server/tenant";
import { checkOut } from "@/server/checkin";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui";
import { CheckinDesk } from "@/components/checkin-desk";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const { gymId } = await requireTenant("checkin:write");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [inGym, todayCount, gym] = await Promise.all([
    db.checkIn.findMany({
      where: { gymId, checkedOutAt: null, checkedInAt: { gte: inGymSince(now) } },
      orderBy: { checkedInAt: "desc" },
      include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true, code: true } } },
    }),
    db.checkIn.count({ where: { gymId, checkedInAt: { gte: todayStart } } }),
    db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { holidays: true, openTime: true, closeTime: true } }),
  ]);
  const holiday = holidayOn(gym.holidays, localDateKey(now));
  return (
    <AppShell title="Check-in" actions={<span className="text-sm text-slate-500">{todayCount} today</span>}>
      {holiday && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Today is marked as a holiday: {holiday}.</p>}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4"><CheckinDesk /></section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-4 p-4">
        <h2 className="mb-2 flex items-center justify-between font-semibold text-slate-900">In gym now <span className="rounded-full bg-green-100 px-3 py-0.5 text-lg text-green-800">{inGym.length}</span></h2>
        {inGym.length === 0 ? <p className="text-sm text-slate-500">Nobody checked in right now.</p> : (
          <ul className="divide-y divide-slate-100">
            {inGym.map((c) => {
              const name = [c.member.firstName, c.member.lastName].filter(Boolean).join(" ");
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <Avatar name={name} photoUrl={c.member.photoUrl} size={32} />
                  <Link href={`/members/${c.member.id}`} className="flex-1 truncate">{name} <span className="text-slate-400">{c.member.code}</span></Link>
                  <span className="text-sm text-slate-500">{c.checkedInAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <form action={checkOut.bind(null, c.id)}><button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-2 py-1 text-sm">Check out</button></form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
