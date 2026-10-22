import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { updateSettings } from "@/server/settings";
import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui";
import { SettingsForm } from "@/components/settings-forms";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { gymId } = await requireTenant("gym:manage");
  const gym = await db.gym.findUniqueOrThrow({ where: { id: gymId } });
  const base = baseUrl();
  return (
    <AppShell title="Settings" actions={<><ButtonLink href="/settings/upi" secondary>UPI verification</ButtonLink><ButtonLink href="/settings/audit" secondary>Activity log</ButtonLink><ButtonLink href="/billing" secondary>GYMBASE plan</ButtonLink></>}>
      <p className="mb-4 text-sm text-slate-500">Gym code <span className="font-mono">{gym.slug}</span> · staff sign in at <span className="font-mono">{base}/login</span></p>
      <SettingsForm action={updateSettings} initial={gym} />
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-6 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Export data (CSV, opens in Excel)</h2>
        <p className="mb-2 text-sm text-slate-500">Your data is yours. Each file downloads everything for this gym.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {[["members", "Members"], ["memberships", "Memberships"], ["payments", "Payments"], ["invoices", "Invoices & dues"], ["attendance", "Attendance (90 days)"], ["leads", "Inquiries"], ["expenses", "Expenses"]].map(([k, l]) => <a key={k} href={`/api/export/${k}`} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-3 py-1">⬇ {l}</a>)}
        </div>
      </section>
    </AppShell>
  );
}
