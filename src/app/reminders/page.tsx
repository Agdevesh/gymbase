import Link from "next/link";
import { db } from "@/lib/db";
import { configuredChannels } from "@/lib/messaging";
import { CHANNEL_LABELS, TYPE_LABELS, statusFilter, waLink } from "@/lib/reminders";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { cancelReminder, generateNow, markSent, retryReminder, sendNow } from "@/server/reminders";
import { AppShell, ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";
const chip = (a: boolean) => `rounded-full border px-3 py-1 text-sm ${a ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`;
const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { gymId, role } = await requireTenant("members:write");
  const status = statusFilter.parse((await searchParams).status);
  const configured = configuredChannels();
  const [rows, counts] = await Promise.all([
    db.reminder.findMany({ where: { gymId, status }, orderBy: status === "PENDING" ? { scheduledAt: "asc" } : { sentAt: "desc" }, take: 200, include: { member: { select: { id: true, firstName: true, lastName: true } }, lead: { select: { id: true, name: true } } } }),
    db.reminder.groupBy({ by: ["status"], where: { gymId }, _count: true }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const btn = "rounded border bg-white px-2 py-1 text-xs hover:bg-neutral-100";
  return (
    <AppShell title="Reminders" actions={<>{can(role, "gym:manage") && <ButtonLink href="/reminders/settings" secondary>Rules</ButtonLink>}<form action={generateNow}><button className={btn + " py-2 px-4 text-sm"}>Generate today&apos;s</button></form></>}>
      {!configured.WHATSAPP && <p className="mb-3 rounded bg-amber-50 p-2 text-sm text-amber-900">No WhatsApp API connected: use the “Open WhatsApp” link on each reminder to send it from the reception phone, then mark it sent. Owners can connect a provider via environment variables.</p>}
      <div className="mb-3 flex flex-wrap gap-2">{(["PENDING", "SENT", "FAILED", "CANCELLED"] as const).map((s) => <Link key={s} href={`/reminders?status=${s}`} className={chip(status === s)}>{s[0] + s.slice(1).toLowerCase()} {n(s)}</Link>)}</div>
      {rows.length === 0 ? <p className="rounded border bg-white p-6 text-center text-neutral-500">Nothing {status.toLowerCase()}.</p> : (
        <ul className="divide-y rounded border bg-white">
          {rows.map((r) => {
            const who = r.member ? { href: `/members/${r.member.id}`, name: [r.member.firstName, r.member.lastName].filter(Boolean).join(" ") } : r.lead ? { href: `/leads/${r.lead.id}`, name: r.lead.name } : null;
            return (
              <li key={r.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{TYPE_LABELS[r.type]}</span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{CHANNEL_LABELS[r.channel]}</span>
                  {who && <Link href={who.href} className="font-medium underline">{who.name}</Link>}
                  <span className="text-neutral-500">{r.to}</span>
                  <span className="ml-auto text-xs text-neutral-500">{r.status === "SENT" && r.sentAt ? `Sent ${fmt(r.sentAt)}${r.providerRef === "manual" ? " by hand" : ""}` : `Due ${fmt(r.scheduledAt)}`}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{r.body}</p>
                {r.error && <p className="mt-1 text-xs text-red-700">{r.error}</p>}
                {(r.status === "PENDING" || r.status === "FAILED") && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.channel === "WHATSAPP" && <a href={waLink(r.to, r.body)} target="_blank" rel="noreferrer" className={`${btn} text-green-800`}>Open WhatsApp</a>}
                    {r.channel === "SMS" && <a href={`sms:${r.to}?body=${encodeURIComponent(r.body)}`} className={btn}>Open SMS</a>}
                    {r.channel === "EMAIL" && <a href={`mailto:${r.to}?body=${encodeURIComponent(r.body)}`} className={btn}>Open email</a>}
                    <form action={markSent.bind(null, r.id)}><button className={btn}>Mark sent</button></form>
                    {configured[r.channel] && <form action={(r.status === "FAILED" ? retryReminder : sendNow).bind(null, r.id)}><button className={btn}>{r.status === "FAILED" ? "Retry" : "Send now"}</button></form>}
                    <form action={cancelReminder.bind(null, r.id)}><button className={`${btn} text-red-700`}>Cancel</button></form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
