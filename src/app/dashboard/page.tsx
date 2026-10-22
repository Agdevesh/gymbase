import Link from "next/link";
import { db } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { inGymSince } from "@/lib/checkin";
import { DAY, bucketByDay, conversionRate, dayStart, monthStart, shortDay, signedTotal } from "@/lib/dashboard";
import { OPEN_STATUSES, SOURCE_LABELS } from "@/lib/leads";
import { METHOD_LABELS, PAYMENT_METHODS, paise } from "@/lib/payments";
import { can } from "@/lib/rbac";
import { sessionsLeft } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { subscriptionState } from "@/lib/saas";
import { expireMemberships } from "@/server/memberships";
import { AppShell, Avatar, ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const time = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const name = (m: { firstName: string; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(" ");

function Tile({ label, value, sub, href, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; tone?: "red" | "amber" | "green" }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : tone === "green" ? "text-green-700" : "";
  const body = <><dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt><dd className={`mt-1 text-2xl font-semibold ${color}`}>{value}</dd>{sub && <dd className="text-xs text-neutral-500">{sub}</dd>}</>;
  return href ? <Link href={href} className="block rounded border bg-white p-3 hover:bg-neutral-50">{body}</Link> : <div className="rounded border bg-white p-3">{body}</div>;
}

function Card({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return <section className="rounded border bg-white p-3"><h2 className="mb-2 flex items-center justify-between text-sm font-medium">{title}{href && <Link href={href} className="text-xs font-normal underline">All</Link>}</h2>{children}</section>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { gymId, userId, role } = await requireTenant();
  const { denied } = await searchParams;
  await expireMemberships(gymId);
  const now = new Date();
  const today = dayStart(now), tomorrow = new Date(today.getTime() + DAY), week = new Date(today.getTime() + 7 * DAY), month = monthStart(now), last30 = new Date(today.getTime() - 29 * DAY);
  const reports = can(role, "reports:read"), money = can(role, "payments:write"), leadsOk = can(role, "leads:write");

  const [gym, checkInsToday, inGym, recentCheckIns, activeMembers, expiring, payments30, duesInvoices, leadsMonth, followUps, newMembersMonth, expensesMonth, ptClients] = await Promise.all([
    db.gym.findUniqueOrThrow({ where: { id: gymId }, include: { subscription: true } }),
    db.checkIn.count({ where: { gymId, checkedInAt: { gte: today } } }),
    db.checkIn.count({ where: { gymId, checkedOutAt: null, checkedInAt: { gte: inGymSince(now) } } }),
    db.checkIn.findMany({ where: { gymId, checkedInAt: { gte: today } }, orderBy: { checkedInAt: "desc" }, take: 8, include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } } }),
    db.membership.count({ where: { gymId, status: { in: ["ACTIVE", "FROZEN"] } } }),
    db.membership.findMany({ where: { gymId, status: "ACTIVE", endDate: { gte: today, lt: week }, renewedTo: null }, orderBy: { endDate: "asc" }, include: { member: { select: { id: true, firstName: true, lastName: true, phone: true } }, plan: { select: { name: true } } } }),
    money ? db.payment.findMany({ where: { gymId, paidAt: { gte: last30 } }, select: { paidAt: true, amountPaise: true, kind: true, method: true } }) : [],
    money ? db.invoice.findMany({ where: { gymId, paidPaise: { lt: db.invoice.fields.totalPaise } }, select: { memberId: true, totalPaise: true, paidPaise: true } }) : [],
    leadsOk ? db.lead.findMany({ where: { gymId, createdAt: { gte: month } }, select: { status: true, source: true } }) : [],
    leadsOk ? db.lead.findMany({ where: { gymId, status: { in: OPEN_STATUSES }, followUpAt: { lt: tomorrow } }, orderBy: { followUpAt: "asc" }, take: 8, select: { id: true, name: true, phone: true, source: true, followUpAt: true } }) : [],
    db.member.count({ where: { gymId, joinedAt: { gte: month } } }),
    reports ? db.expense.aggregate({ where: { gymId, paidAt: { gte: month } }, _sum: { amountPaise: true } }) : null,
    role === "TRAINER" ? db.ptAssignment.findMany({ where: { gymId, trainerId: userId, endDate: null }, include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } }, take: 10 }) : [],
  ]);

  const todays = payments30.filter((p) => p.paidAt >= today);
  const revenueToday = signedTotal(todays), revenueMonth = signedTotal(payments30.filter((p) => p.paidAt >= month));
  const byMethod = PAYMENT_METHODS.map((m) => [m, signedTotal(todays.filter((p) => p.method === m))] as const).filter(([, v]) => v !== 0);
  const dueTotal = duesInvoices.reduce((s, i) => s + i.totalPaise - i.paidPaise, 0), dueMembers = new Set(duesInvoices.map((i) => i.memberId)).size;
  const converted = leadsMonth.filter((l) => l.status === "CONVERTED").length;
  const bySource = Object.entries(leadsMonth.reduce<Record<string, number>>((acc, l) => ((acc[l.source] = (acc[l.source] ?? 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]);
  const series = bucketByDay(payments30, now, 14);
  const subState = subscriptionState(gym.subscription, now);
  const max = Math.max(1, ...series.map((s) => s.total));

  return (
    <AppShell title={gym.name} actions={<>
      <Link href="/billing" className="self-center text-xs text-neutral-500 hover:underline">{role.toLowerCase()} · {gym.subscription?.planCode} {subState.label}</Link>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="rounded border bg-white px-3 py-1 text-sm">Sign out</button></form>
    </>}>
      {role === "OWNER" && (subState.locked || subState.label === "trial" || subState.label === "payment failed" || subState.label === "cancelling") && (
        <p className={`mb-4 rounded p-3 text-sm ${subState.locked ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
          {subState.locked ? subState.reason : subState.label === "trial" ? `Free trial: ${subState.daysLeft} day${subState.daysLeft === 1 ? "" : "s"} left.` : subState.label === "payment failed" ? `Payment failed. ${subState.daysLeft} days before access pauses.` : `Subscription ends in ${subState.daysLeft} days.`}{" "}
          <Link href="/billing" className="underline">Choose a plan</Link>
        </p>
      )}
      {denied && <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-900">Your {role.toLowerCase()} login does not have access to that screen ({denied}). Ask the owner if you need it.</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {can(role, "checkin:write") && <ButtonLink href="/checkin">Check-in desk</ButtonLink>}
        {can(role, "members:write") && <ButtonLink href="/members/new" secondary>+ Member</ButtonLink>}
        {leadsOk && <ButtonLink href="/leads/new" secondary>+ Lead</ButtonLink>}
        {money && <ButtonLink href="/defaulters" secondary>Collect dues</ButtonLink>}
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Check-ins today" value={checkInsToday} sub={`${inGym} in gym now`} href="/checkin" tone="green" />
        {money && <Tile label="Collected today" value={paise(revenueToday)} sub={byMethod.length ? byMethod.map(([m, v]) => `${METHOD_LABELS[m]} ${paise(v)}`).join(" · ") : "nothing yet"} href="/payments" />}
        {money && <Tile label="Dues outstanding" value={paise(dueTotal)} sub={`${dueMembers} member${dueMembers === 1 ? "" : "s"}`} href="/defaulters" tone={dueTotal > 0 ? "red" : undefined} />}
        <Tile label="Expiring in 7 days" value={expiring.length} sub={`${activeMembers} active members`} href="/members" tone={expiring.length ? "amber" : undefined} />
        {leadsOk && <Tile label="Leads this month" value={leadsMonth.length} sub={`${converted} joined · ${conversionRate(converted, leadsMonth.length)}% conversion`} href="/leads" />}
        {leadsOk && <Tile label="Follow-ups due" value={followUps.length} href="/leads?status=DUE" tone={followUps.length ? "amber" : undefined} />}
        {reports && <Tile label="Revenue this month" value={paise(revenueMonth)} sub={`${newMembersMonth} new members`} href="/reports" />}
        {reports && <Tile label="Net this month" value={paise(revenueMonth - (expensesMonth?._sum.amountPaise ?? 0))} sub={`after ${paise(expensesMonth?._sum.amountPaise ?? 0)} expenses`} href="/expenses" tone={revenueMonth - (expensesMonth?._sum.amountPaise ?? 0) < 0 ? "red" : undefined} />}
        {role === "TRAINER" && <Tile label="My PT clients" value={ptClients.length} href="/staff/pt" />}
      </dl>

      {reports && (
        <Card title="Collections, last 14 days">
          <svg viewBox={`0 0 ${series.length * 24} 70`} className="h-24 w-full" role="img" aria-label="Daily collections">
            {series.map((s, i) => { const h = Math.round((s.total / max) * 50); return <g key={i}><rect x={i * 24 + 4} y={55 - h} width={16} height={h} rx={2} className="fill-neutral-800" /><text x={i * 24 + 12} y={66} textAnchor="middle" className="fill-neutral-400" fontSize={7}>{s.date.getDate()}</text></g>; })}
          </svg>
          <p className="text-xs text-neutral-500">Best day {paise(max)} · {shortDay(series[0].date)} {fmtDate(series[0].date)} to today</p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Expiring this week" href="/members">
          {expiring.length === 0 ? <p className="text-sm text-neutral-500">No plans ending this week.</p> : <ul className="divide-y text-sm">{expiring.map((e) => <li key={e.id} className="flex items-center justify-between py-1"><Link href={`/members/${e.member.id}`} className="underline">{name(e.member)}</Link><span className="text-neutral-500">{e.plan.name} · {fmtDate(e.endDate)}</span></li>)}</ul>}
        </Card>
        {leadsOk && (
          <Card title="Follow-ups due today" href="/leads?status=DUE">
            {followUps.length === 0 ? <p className="text-sm text-neutral-500">All caught up.</p> : <ul className="divide-y text-sm">{followUps.map((l) => <li key={l.id} className="flex items-center justify-between py-1"><Link href={`/leads/${l.id}`} className="underline">{l.name}</Link><span className={`text-xs ${l.followUpAt && l.followUpAt < today ? "text-red-700" : "text-neutral-500"}`}>{SOURCE_LABELS[l.source]}{l.followUpAt && l.followUpAt < today ? " · overdue" : ""}</span></li>)}</ul>}
          </Card>
        )}
        <Card title="Today's check-ins" href="/attendance">
          {recentCheckIns.length === 0 ? <p className="text-sm text-neutral-500">Nobody yet today.</p> : <ul className="divide-y text-sm">{recentCheckIns.map((c) => <li key={c.id} className="flex items-center gap-2 py-1"><Avatar name={name(c.member)} photoUrl={c.member.photoUrl} size={24} /><Link href={`/members/${c.member.id}`} className="flex-1 underline">{name(c.member)}</Link><span className="text-neutral-500">{time(c.checkedInAt)}</span></li>)}</ul>}
        </Card>
        {leadsOk && bySource.length > 0 && (
          <Card title="Lead sources this month" href="/leads">
            <ul className="text-sm">{bySource.map(([s, n]) => <li key={s} className="flex items-center gap-2 py-0.5"><span className="w-24 text-neutral-600">{SOURCE_LABELS[s as keyof typeof SOURCE_LABELS]}</span><span className="h-2 rounded bg-neutral-800" style={{ width: `${(n / leadsMonth.length) * 100}%` }} /><span className="text-neutral-500">{n}</span></li>)}</ul>
          </Card>
        )}
        {role === "TRAINER" && (
          <Card title="My PT clients" href="/staff/pt">
            {ptClients.length === 0 ? <p className="text-sm text-neutral-500">No clients assigned.</p> : <ul className="divide-y text-sm">{ptClients.map((a) => <li key={a.id} className="flex items-center gap-2 py-1"><Avatar name={name(a.member)} photoUrl={a.member.photoUrl} size={24} /><Link href={`/members/${a.member.id}`} className="flex-1 underline">{name(a.member)}</Link><span className="text-neutral-500">{sessionsLeft(a)} left</span></li>)}</ul>}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
