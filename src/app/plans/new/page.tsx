import { requireTenant } from "@/server/tenant";
import { createPlan } from "@/server/plans";
import { AppShell } from "@/components/ui";
import { PlanForm } from "@/components/plan-form";

export default async function NewPlanPage() {
  await requireTenant("gym:manage");
  return <AppShell title="New plan" back={{ href: "/plans", label: "Plans" }}><PlanForm action={createPlan} /></AppShell>;
}
