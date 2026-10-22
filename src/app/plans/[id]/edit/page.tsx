import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { updatePlan } from "@/server/plans";
import { AppShell } from "@/components/ui";
import { PlanForm } from "@/components/plan-form";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId } = await requireTenant("gym:manage");
  const { id } = await params;
  const plan = await db.plan.findFirst({ where: { id, gymId } });
  if (!plan) notFound();
  return <AppShell title={`Edit ${plan.name}`} back={{ href: "/plans", label: "Plans" }}><PlanForm action={updatePlan.bind(null, plan.id)} initial={plan} /></AppShell>;
}
