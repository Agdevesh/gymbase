import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { updateSettings } from "@/server/settings";
import { AppShell, ButtonLink } from "@/components/ui";
import { SettingsForm } from "@/components/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { gymId } = await requireTenant("gym:manage");
  const gym = await db.gym.findUniqueOrThrow({ where: { id: gymId } });
  const base = process.env.AUTH_URL ?? "";
  return (
    <AppShell title="Settings" actions={<><ButtonLink href="/settings/audit" secondary>Activity log</ButtonLink><ButtonLink href="/billing" secondary>GYMBASE plan</ButtonLink></>}>
      <p className="mb-4 text-sm text-neutral-500">Gym code <span className="font-mono">{gym.slug}</span> · staff sign in at <span className="font-mono">{base}/login</span></p>
      <SettingsForm action={updateSettings} initial={gym} />
      <section className="mt-6 rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Export data (CSV, opens in Excel)</h2>
        <p className="mb-2 text-sm text-neutral-500">Your data is yours. Each file downloads everything for this gym.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {[["members", "Members"], ["memberships", "Memberships"], ["payments", "Payments"], ["invoices", "Invoices & dues"], ["attendance", "Attendance (90 days)"], ["leads", "Inquiries"]].map(([k, l]) => <a key={k} href={`/api/export/${k}`} className="rounded border bg-white px-3 py-1 hover:bg-neutral-100">⬇ {l}</a>)}
        </div>
      </section>
    </AppShell>
  );
}
