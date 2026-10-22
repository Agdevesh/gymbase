import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { updateLead } from "@/server/leads";
import { AppShell } from "@/components/ui";
import { LeadForm } from "@/components/lead-form";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId } = await requireTenant("leads:write");
  const { id } = await params;
  const [lead, plans] = await Promise.all([db.lead.findFirst({ where: { id, gymId } }), db.plan.findMany({ where: { gymId, active: true }, select: { name: true } })]);
  if (!lead) notFound();
  return <AppShell title={`Edit ${lead.name}`} back={{ href: `/leads/${id}`, label: lead.name }}><LeadForm action={updateLead.bind(null, id)} initial={lead} plans={plans.map((p) => p.name)} cancelHref={`/leads/${id}`} /></AppShell>;
}
