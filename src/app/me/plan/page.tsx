import { db } from "@/lib/db";
import { MEASURE_FIELDS, bmi, bmiLabel, trend } from "@/lib/fitness";
import { requireMember } from "@/server/portal";
import { MemberShell } from "@/components/member-shell";
import { ProgressChart } from "@/components/progress-chart";

export const dynamic = "force-dynamic";

export default async function PortalPlan() {
  const { member: m, gym } = await requireMember();
  const [plans, rows] = await Promise.all([
    db.fitnessPlan.findMany({ where: { memberId: m.id, active: true }, orderBy: { type: "asc" }, include: { author: { select: { name: true } } } }),
    db.measurement.findMany({ where: { memberId: m.id }, orderBy: { at: "desc" }, take: 50 }),
  ]);
  const b = bmi(trend(rows, "weightKg")?.latest, trend(rows, "heightCm")?.latest);
  return (
    <MemberShell gymName={gym.name} title="My plan">
      {plans.length === 0 && rows.length === 0 && <p className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-500">Your trainer has not added a plan or measurements yet.</p>}
      {plans.map((p) => (
        <section key={p.id} className="mb-3 rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-slate-900">{p.type === "DIET" ? "🥗" : "🏋️"} {p.title}</h2>
          <p className="mb-2 text-xs text-slate-500">{p.author?.name && `By ${p.author.name} · `}updated {p.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
          <pre className="whitespace-pre-wrap font-sans text-sm">{p.body}</pre>
        </section>
      ))}
      {rows.length > 0 && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold text-slate-900">Body measurements</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {MEASURE_FIELDS.map(([k, label, u]) => { const t = trend(rows, k); return t ? <div key={k}><div className="text-xs text-slate-500">{label}</div><div className="font-semibold">{t.latest} {u}</div>{t.delta != null && t.delta !== 0 && <div className={`text-xs ${t.delta < 0 ? "text-green-700" : "text-amber-700"}`}>{t.delta > 0 ? "+" : ""}{t.delta}</div>}</div> : null; })}
            {b && <div><div className="text-xs text-slate-500">BMI</div><div className="font-semibold">{b}</div><div className="text-xs text-slate-500">{bmiLabel(b)}</div></div>}
          </div>
          <div className="mt-3"><ProgressChart points={rows.filter((r) => r.weightKg != null).map((r) => ({ at: r.at, value: r.weightKg as number })).reverse()} unit="kg" /></div>
        </section>
      )}
    </MemberShell>
  );
}
