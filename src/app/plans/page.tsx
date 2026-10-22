import Link from "next/link";
import { db } from "@/lib/db";
import { paise } from "@/lib/memberships";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { togglePlan } from "@/server/plans";
import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui";

export default async function PlansPage() {
  const { gymId, role } = await requireTenant("members:read");
  const manage = can(role, "gym:manage");
  const plans = await db.plan.findMany({
    where: { gymId },
    orderBy: [{ active: "desc" }, { durationDays: "asc" }],
    include: { _count: { select: { memberships: { where: { status: { in: ["ACTIVE", "FROZEN"] } } } } } },
  });
  return (
    <AppShell title="Plans" actions={manage && <ButtonLink href="/plans/new">+ New plan</ButtonLink>}>
      {plans.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-slate-500">No plans yet.</p> : (
        <table className="rounded-xl border border-slate-200 bg-white shadow-sm w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="p-2">Plan</th><th className="p-2">Duration</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Active members</th><th className="p-2" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map((p) => (
              <tr key={p.id} className={p.active ? "" : "text-slate-400"}>
                <td className="p-2"><span className="font-medium">{p.name}</span> <span className="text-slate-400">{p.type.toLowerCase().replace("_", "-")}{p.ptSessions ? ` · ${p.ptSessions} sessions` : ""}</span></td>
                <td className="p-2">{p.durationDays} days</td>
                <td className="p-2 text-right">{paise(p.pricePaise)}</td>
                <td className="p-2 text-right">{p._count.memberships}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  {manage && <>
                    <Link href={`/plans/${p.id}/edit`} className="font-medium text-brand-700 hover:underline">Edit</Link>
                    <form action={togglePlan.bind(null, p.id, !p.active)} className="ml-3 inline"><button className="font-medium text-brand-700 hover:underline">{p.active ? "Retire" : "Reactivate"}</button></form>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
