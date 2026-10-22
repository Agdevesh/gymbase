import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ROLE_LABELS, hoursBetween, localDay } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { revokeInvite, setCommissionPercent, setStaffActive, staffMarkIn, staffMarkOut } from "@/server/staff";
import { AppShell, Avatar, ButtonLink, inputClass } from "@/components/ui";
import { InviteForm } from "@/components/staff-forms";
import { ResetLinkButton } from "@/components/settings-forms";
import { adminResetPassword } from "@/server/settings";

export const dynamic = "force-dynamic";
const time = (d: Date | null) => (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { gymId, userId, role } = await requireTenant();
  if (role === "MEMBER") return null;
  const manage = can(role, "staff:manage");
  const { date } = await searchParams;
  const now = new Date();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : localDay(now);
  const isToday = day.getTime() === localDay(now).getTime();
  const [staff, attendance, invites, sub] = await Promise.all([
    db.user.findMany({ where: { gymId, role: { not: "MEMBER" } }, orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] }),
    db.staffAttendance.findMany({ where: { gymId, date: day } }),
    manage ? db.invite.findMany({ where: { gymId, acceptedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } }) : [],
    db.subscription.findUnique({ where: { gymId }, select: { staffLimit: true } }),
  ]);
  const att = (id: string) => attendance.find((a) => a.userId === id);
  const btn = "rounded border bg-white px-2 py-1 text-xs hover:bg-neutral-100";
  const shift = (n: number) => new Date(day.getTime() + n * 86400_000).toISOString().slice(0, 10);

  return (
    <AppShell title="Staff" actions={<><ButtonLink href="/staff/pt" secondary>PT clients</ButtonLink>{manage && <ButtonLink href="/staff/commissions" secondary>Commissions</ButtonLink>}</>}>
      <form className="mb-3 flex items-center gap-2" action="/staff">
        <Link href={`/staff?date=${shift(-1)}`} className="rounded border bg-white px-3 py-2 text-sm">←</Link>
        <input type="date" name="date" defaultValue={day.toISOString().slice(0, 10)} className={`${inputClass} w-auto`} />
        <button className="rounded border bg-white px-3 py-2 text-sm">Go</button>
        {!isToday && <Link href={`/staff?date=${shift(1)}`} className="rounded border bg-white px-3 py-2 text-sm">→</Link>}
        <span className="ml-auto text-sm text-neutral-500">{staff.filter((s) => s.active && s.role !== "OWNER").length}/{sub?.staffLimit ?? "∞"} staff logins</span>
      </form>
      <table className="w-full rounded border bg-white text-sm">
        <thead className="text-left text-neutral-500"><tr><th className="p-2">Staff</th><th className="p-2">In</th><th className="p-2">Out</th><th className="p-2">Hours</th>{manage && <th className="p-2">Commission %</th>}<th className="p-2" /></tr></thead>
        <tbody className="divide-y">
          {staff.map((s) => {
            const a = att(s.id);
            const me = s.id === userId;
            const canMark = isToday && (me || role === "OWNER");
            return (
              <tr key={s.id} className={s.active ? "" : "text-neutral-400"}>
                <td className="p-2"><div className="flex items-center gap-2"><Avatar name={s.name} photoUrl={null} size={28} /><div><div className="font-medium">{s.name}{me && <span className="text-neutral-400"> (you)</span>}</div><div className="text-xs text-neutral-500">{ROLE_LABELS[s.role]} · {s.email}{!s.active && " · deactivated"}</div></div></div></td>
                <td className="p-2">{time(a?.inAt ?? null)}</td>
                <td className="p-2">{time(a?.outAt ?? null)}</td>
                <td className="p-2">{a?.outAt ? hoursBetween(a.inAt, a.outAt) : a ? <span className="text-green-700">in</span> : ""}</td>
                {manage && <td className="p-2">{s.role === "TRAINER" ? <form action={setCommissionPercent.bind(null, s.id)} className="flex items-center gap-1"><input name="percent" type="number" min={0} max={100} defaultValue={s.commissionPercent} className="w-16 rounded border px-1 py-0.5" /><button className={btn}>Set</button></form> : "—"}</td>}
                <td className="p-2 text-right whitespace-nowrap">
                  {canMark && s.active && !a && <form action={staffMarkIn.bind(null, s.id)} className="inline"><button className={`${btn} text-green-800`}>{me ? "I'm in" : "Mark in"}</button></form>}
                  {canMark && a && !a.outAt && <form action={staffMarkOut.bind(null, s.id)} className="inline"><button className={btn}>{me ? "I'm out" : "Mark out"}</button></form>}
                  {manage && !me && s.active && <span className="ml-2"><ResetLinkButton action={adminResetPassword.bind(null, s.id)} name={s.name} /></span>}
                  {manage && !me && <form action={setStaffActive.bind(null, s.id, !s.active)} className="ml-2 inline"><button className={`${btn} ${s.active ? "text-red-700" : ""}`}>{s.active ? "Deactivate" : "Reactivate"}</button></form>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {manage && (
        <section className="mt-6 rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Invite staff</h2>
          <InviteForm />
          {invites.length > 0 && (
            <ul className="mt-3 divide-y text-sm">
              {invites.map((i) => <li key={i.id} className="flex items-center justify-between py-1"><span>{i.email} <span className="text-neutral-500">· {ROLE_LABELS[i.role]} · expires {i.expiresAt.toLocaleDateString("en-IN")}</span></span><span className="flex gap-2"><a href={`/invite/${i.token}`} className="underline">Link</a><form action={revokeInvite.bind(null, i.id)}><button className="text-red-700 underline">Revoke</button></form></span></li>)}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}
