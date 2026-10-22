import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { createLead } from "@/server/leads";
import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/lead-form";

export default async function NewLeadPage() {
  const { gymId } = await requireTenant("leads:write");
  const plans = await db.plan.findMany({ where: { gymId, active: true }, select: { name: true }, orderBy: { durationDays: "asc" } });
  return <AppShell title="Add lead" back={{ href: "/leads", label: "Inquiries" }}><LeadForm action={createLead} plans={plans.map((p) => p.name)} cancelHref="/leads" /></AppShell>;
}
