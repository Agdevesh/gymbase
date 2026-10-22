import { configuredChannels } from "@/lib/messaging";
import { RULE_DEFAULTS, TYPE_LABELS } from "@/lib/reminders";
import { requireTenant } from "@/server/tenant";
import { rulesFor } from "@/server/reminders";
import { AppShell } from "@/components/app-shell";
import { RuleForm } from "@/components/reminder-forms";

export default async function ReminderSettingsPage() {
  const { gymId } = await requireTenant("gym:manage");
  const rules = await rulesFor(gymId);
  const configured = configuredChannels();
  return (
    <AppShell title="Reminder rules" back={{ href: "/reminders", label: "Reminders" }}>
      <p className="mb-4 text-sm text-slate-600">Reminders are generated every morning and sent at 10:00. Channels marked “manual” have no API connected; reception sends those with one tap from the Reminders screen.</p>
      <div className="space-y-4">
        {rules.map((r) => (
          <section key={r.type} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            <h2 className="mb-2 font-semibold text-slate-900">{TYPE_LABELS[r.type]}</h2>
            <RuleForm type={r.type} rule={r} help={RULE_DEFAULTS[r.type].help} configured={configured} />
          </section>
        ))}
      </div>
    </AppShell>
  );
}
