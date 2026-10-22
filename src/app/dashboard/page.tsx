import Link from "next/link";
import { db } from "@/lib/db";
import { DAY, bucketByDay, conversionRate, dayStart, monthStart, signedTotal } from "@/lib/dashboard";
import { daysOverdue, dueAmount, dueBucket, duesReminderText, waLink } from "@/lib/dues";
import { OPEN_STATUSES, SOURCE_LABELS } from "@/lib/leads";
import { METHOD_LABELS, PAYMENT_METHODS, paise } from "@/lib/payments";
import { can } from "@/lib/rbac";
import { sessionsLeft } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { subscriptionState } from "@/lib/saas";
import { tidyMemberships } from "@/server/memberships";
import { setupStatus } from "@/server/setup";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { CollectionsChart } from "@/components/collections-chart";
import { Avatar, ButtonLink, Card, EmptyState, Notice, StatTile, TONES } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const name = (m: { firstName: string; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(" ");
const greeting = (h: number) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

type DueRow = { memberId: string; name: string; phone: string; photoUrl: string | null; amount: number; days: number; invoiceId: string; label: string; suspended: boolean };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { gymId, userId, role } = await requireTenant();
  const { denied } = await searchParams;
  await tidyMemberships(gymId);
  const now = new Date();
  const today = dayStart(now), tomorrow = new Date(today.getTime() + DAY), week = new Date(today.getTime() + 7 * DAY), month = monthStart(now), last30 = new Date(today.getTime() - 29 * DAY);
  const reports = can(role, "reports:read"), money = can(role, "payments:write"), leadsOk = can(role, "leads:write");

  const [gym, me, activeMembers, expiring, endingToday, payments30, unpaid, leadsMonth, followUps, newMembersMonth, expensesMonth, ptClients] = await Promise.all([
    db.gym.findUniqueOrThrow({ where: { id: gymId }, include: { subscription: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.membership.count({ where: { gymId, status: { in: ["ACTIVE", "FROZEN"] } } }),
    db.membership.findMany({ where: { gymId, status: "ACTIVE", endDate: { gte: today, lt: week }, renewedTo: null }, orderBy: { endDate: "asc" }, include: { member: { select: { id: true, firstName: true, lastName: true, phone: true } }, plan: { select: { name: true } } } }),
    money ? db.membership.findMany({ where: { gymId, status: "ACTIVE", endDate: { gte: today, lt: tomorrow }, renewedTo: null }, include: { member: { select: { id: true, firstName: true, lastName: true, phone: true, photoUrl: true } }, plan: { select: { name: true, pricePaise: true } } } }) : [],
    money ? db.payment.findMany({ where: { gymId, paidAt: { gte: last30 } }, select: { paidAt: true, amountPaise: true, kind: true, method: true } }) : [],
    money ? db.invoice.findMany({ where: { gymId, paidPaise: { lt: db.invoice.fields.totalPaise } }, orderBy: { issuedAt: "asc" }, select: { id: true, number: true, totalPaise: true, paidPaise: true, dueDate: true, issuedAt: true, member: { select: { id: true, firstName: true, lastName: true, phone: true, photoUrl: true, memberships: { where: { status: "SUSPENDED" }, select: { id: true }, take: 1 } } } } }) : [],
    leadsOk ? db.lead.findMany({ where: { gymId, createdAt: { gte: month } }, select: { status: true, source: true } }) : [],
    leadsOk ? db.lead.findMany({ where: { gymId, status: { in: OPEN_STATUSES }, followUpAt: { lt: tomorrow } }, orderBy: { followUpAt: "asc" }, take: 8, select: { id: true, name: true, phone: true, source: true, followUpAt: true } }) : [],
    db.member.count({ where: { gymId, joinedAt: { gte: month } } }),
    reports ? db.expense.aggregate({ where: { gymId, paidAt: { gte: month } }, _sum: { amountPaise: true } }) : null,
    role === "TRAINER" ? db.ptAssignment.findMany({ where: { gymId, trainerId: userId, endDate: null }, include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } }, take: 10 }) : [],
  ]);

  const todays = payments30.filter((p) => p.paidAt >= today);
  const revenueToday = signedTotal(todays), revenueMonth = signedTotal(payments30.filter((p) => p.paidAt >= month));
  const byMethod = PAYMENT_METHODS.map((m) => [m, signedTotal(todays.filter((p) => p.method === m))] as const).filter(([, v]) => v !== 0);
  const dueTotal = unpaid.reduce((s, i) => s + dueAmount(i), 0), dueMembers = new Set(unpaid.map((i) => i.member.id)).size;
  const converted = leadsMonth.filter((l) => l.status === "CONVERTED").length;
  const bySource = Object.entries(leadsMonth.reduce<Record<string, number>>((acc, l) => ((acc[l.source] = (acc[l.source] ?? 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]);
  const series = bucketByDay(payments30, now, 14);
  const subState = subscriptionState(gym.subscription, now);
  const setup = role === "OWNER" && !gym.setupDoneAt ? await setupStatus(gymId) : null;
  const expenses = expensesMonth?._sum.amountPaise ?? 0;

  // Payments panel: one row per member, oldest unpaid invoice decides the days; renewals ending today join "due today".
  const perMember = new Map<string, DueRow>();
  for (const i of unpaid) {
    const row = perMember.get(i.member.id);
    const amt = dueAmount(i), days = daysOverdue(i, now);
    if (row) { row.amount += amt; if (days > row.days) { row.days = days; row.invoiceId = i.id; row.label = i.number; } }
    else perMember.set(i.member.id, { memberId: i.member.id, name: name(i.member), phone: i.member.phone, photoUrl: i.member.photoUrl, amount: amt, days, invoiceId: i.id, label: i.number, suspended: i.member.memberships.length > 0 });
  }
  const overdue = [...perMember.values()].filter((r) => r.days > 0).sort((a, b) => b.days - a.days);
  const dueToday: (DueRow & { kind: "invoice" | "renewal" })[] = [
    ...[...perMember.values()].filter((r) => r.days === 0 && unpaid.some((i) => i.member.id === r.memberId && dueBucket(i, now) === "today")).map((r) => ({ ...r, kind: "invoice" as const })),
    ...endingToday.filter((m) => !perMember.has(m.member.id)).map((m) => ({ memberId: m.member.id, name: name(m.member), phone: m.member.phone, photoUrl: m.member.photoUrl, amount: m.plan.pricePaise, days: 0, invoiceId: "", label: `${m.plan.name} renewal`, suspended: false, kind: "renewal" as const })),
  ];
  const overdueTotal = overdue.reduce((s, r) => s + r.amount, 0);

  const DueList = ({ rows, tone }: { rows: (DueRow & { kind?: "invoice" | "renewal" })[]; tone: "amber" | "red" }) => (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li key={r.memberId} className="py-3">
          <div className="flex items-center gap-3">
            <Avatar name={r.name} photoUrl={r.photoUrl} size={36} />
            <div className="min-w-0 flex-1">
              <Link href={`/members/${r.memberId}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{r.name}</Link>
              <p className="text-xs text-slate-500">
                {r.kind === "renewal" ? `Plan ends today · ${r.label}` : r.days === 0 ? `Due today · ${r.label}` : `${r.days} day${r.days === 1 ? "" : "s"} overdue`}
              </p>
            </div>
            <p className={`shrink-0 text-sm font-semibold ${TONES[tone].text}`}>{paise(r.amount)}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
            <Link href={r.kind === "renewal" ? `/members/${r.memberId}` : `/invoices/${r.invoiceId}`} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"><Icon name="rupee" size={12} />{r.kind === "renewal" ? "Renew" : "Collect"}</Link>
            <a href={waLink(r.phone, duesReminderText(r.name.split(" ")[0], gym.name, r.amount, r.days, gym.upiId))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><Icon name="whatsapp" size={12} />WhatsApp remind</a>
            {r.suspended && <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">Suspended</span>}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <AppShell
      title={`${greeting(now.getHours())}, ${(me?.name ?? "").split(" ")[0] || role.toLowerCase()}`}
      subtitle={<>{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {gym.name}{role === "OWNER" && <> · <Link href="/billing" className="hover:underline">{gym.subscription?.planCode?.toLowerCase()} plan, {subState.label}</Link></>}</>}
      actions={<>
        {can(role, "members:write") && <ButtonLink href="/members/new"><Icon name="plus" size={16} />Member</ButtonLink>}
        {leadsOk && <ButtonLink href="/leads/new" secondary><Icon name="plus" size={16} />Inquiry</ButtonLink>}
      </>}
    >

      {role === "OWNER" && (subState.locked || subState.label === "trial" || subState.label === "payment failed" || subState.label === "cancelling") && (
        <Notice tone={subState.locked ? "red" : "amber"}>
          {subState.locked ? subState.reason : subState.label === "trial" ? `Free trial: ${subState.daysLeft} day${subState.daysLeft === 1 ? "" : "s"} left.` : subState.label === "payment failed" ? `Payment failed. ${subState.daysLeft} days before access pauses.` : `Subscription ends in ${subState.daysLeft} days.`}{" "}
          <Link href="/billing" className="font-medium underline">Choose a plan</Link>
        </Notice>
      )}
      {denied && <Notice tone="amber">Your {role.toLowerCase()} login does not have access to that screen ({denied}). Ask the owner if you need it.</Notice>}
      {setup && !setup.complete && (
        <Card className="mb-5" tone="brand" title={<><Icon name="check" size={16} />Getting started: {setup.done}/{setup.total} done</>} href="/setup" hrefLabel="Open checklist">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">{setup.steps.filter((s) => !s.done).slice(0, 4).map((s) => <li key={s.key}><Link href={s.href} className="hover:text-brand-700 hover:underline">○ {s.label}</Link></li>)}</ul>
        </Card>
      )}

      <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatTile label="Active members" value={activeMembers} sub={`${newMembersMonth} joined this month`} href="/members" icon="members" tone="green" />
        {money && <StatTile label="Collected today" value={paise(revenueToday)} sub={byMethod.length ? byMethod.map(([m, v]) => `${METHOD_LABELS[m]} ${paise(v)}`).join(" · ") : "Nothing yet"} href="/payments" icon="payments" tone="brand" />}
        {money && <StatTile label="Dues outstanding" value={paise(dueTotal)} sub={`${dueMembers} member${dueMembers === 1 ? "" : "s"}`} href="/defaulters" icon="defaulters" tone="red" alert={dueTotal > 0} />}
        <StatTile label="Expiring in 7 days" value={expiring.length} sub="Call them to renew" href="/members" icon="clock" tone="amber" alert={expiring.length > 0} />
        {leadsOk && <StatTile label="Inquiries this month" value={leadsMonth.length} sub={`${converted} joined · ${conversionRate(converted, leadsMonth.length)}% conversion`} href="/leads" icon="leads" tone="violet" />}
        {leadsOk && <StatTile label="Follow-ups due" value={followUps.length} sub={followUps.length ? "Call them today" : "All caught up"} href="/leads?status=DUE" icon="phone" tone="sky" alert={followUps.length > 0} />}
        {reports && <StatTile label="Revenue this month" value={paise(revenueMonth)} sub={`${newMembersMonth} new member${newMembersMonth === 1 ? "" : "s"}`} href="/reports" icon="trend" tone="brand" />}
        {reports && <StatTile label="Net this month" value={paise(revenueMonth - expenses)} sub={`after ${paise(expenses)} expenses`} href="/expenses" icon="reports" tone={revenueMonth - expenses < 0 ? "red" : "green"} alert={revenueMonth - expenses < 0} />}
        {role === "TRAINER" && <StatTile label="My PT clients" value={ptClients.length} href="/staff/pt" icon="staff" tone="violet" />}
      </dl>

      {money && (
        <Card className="order-first md:order-none" title={<><Icon name="rupee" size={16} className="text-brand-600" />Payments</>} href="/defaulters" hrefLabel="All dues"
          action={<span className="hidden text-xs text-slate-500 sm:inline">{overdue.length} overdue · {paise(overdueTotal)}</span>}>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700"><Icon name="calendar" size={14} />Needs to pay today <span className="rounded-full bg-amber-50 px-1.5 text-[11px]">{dueToday.length}</span></h3>
              {dueToday.length === 0 ? <EmptyState icon="check" title="Nothing due today" hint="Members whose invoice or plan falls due today show up here." /> : <DueList rows={dueToday} tone="amber" />}
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700"><Icon name="defaulters" size={14} />Not paid yet <span className="rounded-full bg-red-50 px-1.5 text-[11px]">{overdue.length}</span></h3>
              {overdue.length === 0 ? <EmptyState icon="check" title="No overdue dues" hint="Everyone is paid up." /> : <DueList rows={overdue.slice(0, 8)} tone="red" />}
              {overdue.length > 8 && <Link href="/defaulters" className="mt-2 block text-xs font-medium text-brand-600">+{overdue.length - 8} more</Link>}
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <Icon name="clock" size={14} className="mr-1 inline align-[-3px]" />
            {gym.autoSuspendEnabled ? `Memberships are suspended automatically after ${gym.autoSuspendDays} days unpaid and restored when they pay.` : "Automatic suspension of unpaid members is off."}
            {role === "OWNER" && <Link href="/settings" className="ml-1 font-medium text-brand-600 hover:underline">Change</Link>}
          </p>
        </Card>
      )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {reports && (
          <Card className="lg:col-span-2" title="Collections, last 14 days" href="/reports" hrefLabel="Reports">
            <CollectionsChart series={series} />
          </Card>
        )}
        {leadsOk && bySource.length > 0 && (
          <Card title="Inquiry sources this month" href="/leads">
            <ul className="space-y-2 text-sm">{bySource.map(([s, n]) => <li key={s}><div className="flex justify-between text-xs"><span className="text-slate-600">{SOURCE_LABELS[s as keyof typeof SOURCE_LABELS]}</span><span className="font-medium text-slate-700">{n}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-400" style={{ width: `${(n / leadsMonth.length) * 100}%` }} /></div></li>)}</ul>
          </Card>
        )}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card title={<><Icon name="clock" size={16} className="text-amber-500" />Expiring this week</>} href="/members">
          {expiring.length === 0 ? <EmptyState icon="check" title="No plans ending this week" /> : <ul className="divide-y divide-slate-100 text-sm">{expiring.map((e) => <li key={e.id} className="flex items-center justify-between py-2"><Link href={`/members/${e.member.id}`} className="font-medium text-slate-800 hover:text-brand-700">{name(e.member)}</Link><span className="text-xs text-slate-500">{e.plan.name} · {fmtDate(e.endDate)}</span></li>)}</ul>}
        </Card>
        {leadsOk && (
          <Card title={<><Icon name="phone" size={16} className="text-sky-500" />Follow-ups due</>} href="/leads?status=DUE">
            {followUps.length === 0 ? <EmptyState icon="check" title="All caught up" /> : <ul className="divide-y divide-slate-100 text-sm">{followUps.map((l) => <li key={l.id} className="flex items-center justify-between py-2"><Link href={`/leads/${l.id}`} className="font-medium text-slate-800 hover:text-brand-700">{l.name}</Link><span className={`text-xs ${l.followUpAt && l.followUpAt < today ? "font-medium text-red-600" : "text-slate-500"}`}>{SOURCE_LABELS[l.source]}{l.followUpAt && l.followUpAt < today ? " · overdue" : ""}</span></li>)}</ul>}
          </Card>
        )}
        {role === "TRAINER" && (
          <Card title="My PT clients" href="/staff/pt">
            {ptClients.length === 0 ? <EmptyState title="No clients assigned" /> : <ul className="divide-y divide-slate-100 text-sm">{ptClients.map((a) => <li key={a.id} className="flex items-center gap-2 py-1.5"><Avatar name={name(a.member)} photoUrl={a.member.photoUrl} size={28} /><Link href={`/members/${a.member.id}`} className="flex-1 font-medium text-slate-800">{name(a.member)}</Link><span className="text-xs text-slate-500">{sessionsLeft(a)} left</span></li>)}</ul>}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
