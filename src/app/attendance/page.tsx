import Link from "next/link";
import { db } from "@/lib/db";
import { dayRange } from "@/lib/checkin";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { Avatar, inputClass } from "@/components/ui";

const time = (d: Date | null) => (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; member?: string }> }) {
  const { gymId } = await requireTenant("members:read");
  const { date, member } = await searchParams;
  const now = new Date();
  const day = dayRange(date, now);
  const where = member ? { gymId, memberId: member } : { gymId, checkedInAt: { gte: day.start, lt: day.end } };
  const [rows, last7] = await Promise.all([
    db.checkIn.findMany({ where, orderBy: { checkedInAt: "desc" }, take: 200, include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true, code: true } } } }),
    db.checkIn.groupBy({ by: ["memberId"], where: { gymId, checkedInAt: { gte: new Date(day.end.getTime() - 7 * 86400_000), lt: day.end } }, _count: true }),
  ]);
  const uniqueWeek = last7.length;
  const memberName = member && rows[0] ? [rows[0].member.firstName, rows[0].member.lastName].filter(Boolean).join(" ") : null;
  const prev = new Date(day.start.getTime() - 86400_000), next = new Date(day.end.getTime());
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <AppShell title={memberName ? `Attendance · ${memberName}` : "Attendance"} back={member ? { href: `/members/${member}`, label: "Profile" } : undefined}>
      {!member && (
        <form className="mb-4 flex items-center gap-2" action="/attendance">
          <Link href={`/attendance?date=${key(prev)}`} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">←</Link>
          <input type="date" name="date" defaultValue={day.key} className={`${inputClass} w-auto`} />
          <button className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">Go</button>
          {next <= now && <Link href={`/attendance?date=${key(next)}`} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-2 text-sm">→</Link>}
          <span className="ml-auto text-sm text-slate-500">{rows.length} visits · {uniqueWeek} members in last 7 days</span>
        </form>
      )}
      {rows.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-slate-500">No check-ins.</p> : (
        <table className="rounded-xl border border-slate-200 bg-white shadow-sm w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="p-2">Member</th>{member && <th className="p-2">Date</th>}<th className="p-2">In</th><th className="p-2">Out</th><th className="p-2">Via</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const name = [c.member.firstName, c.member.lastName].filter(Boolean).join(" ");
              return (
                <tr key={c.id}>
                  <td className="p-2"><Link href={`/members/${c.member.id}`} className="flex items-center gap-2"><Avatar name={name} photoUrl={c.member.photoUrl} size={28} />{name} <span className="text-slate-400">{c.member.code}</span></Link></td>
                  {member && <td className="p-2">{c.checkedInAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>}
                  <td className="p-2">{time(c.checkedInAt)}</td>
                  <td className="p-2">{time(c.checkedOutAt)}</td>
                  <td className="p-2 text-slate-500">{c.source.toLowerCase()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
