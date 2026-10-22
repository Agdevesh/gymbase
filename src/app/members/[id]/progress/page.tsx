import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MEASURE_FIELDS, bmi, bmiLabel, trend } from "@/lib/fitness";
import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenant";
import { deleteMeasurement } from "@/server/fitness";
import { AppShell } from "@/components/app-shell";
import { MeasurementForm } from "@/components/fitness-forms";
import { ProgressChart } from "@/components/progress-chart";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

export default async function ProgressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ metric?: string }> }) {
  const { gymId, role } = await requireTenant("members:read");
  const { id } = await params;
  const { metric = "weightKg" } = await searchParams;
  const m = await db.member.findFirst({ where: { id, gymId }, select: { id: true, firstName: true, lastName: true, measurements: { orderBy: { at: "desc" } } } });
  if (!m) notFound();
  const key = (MEASURE_FIELDS.find(([k]) => k === metric)?.[0] ?? "weightKg");
  const unit = MEASURE_FIELDS.find(([k]) => k === key)![2];
  const rows = m.measurements;
  const latest = rows[0];
  const b = latest ? bmi(trend(rows, "weightKg")?.latest, trend(rows, "heightCm")?.latest) : null;
  const write = can(role, "fitness:write");
  return (
    <AppShell title={`${m.firstName} ${m.lastName ?? ""} · progress`} back={{ href: `/members/${m.id}`, label: "Profile" }}>
      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MEASURE_FIELDS.map(([k, label, u]) => { const t = trend(rows, k); return t ? <a key={k} href={`?metric=${k}`} className={`rounded border bg-white p-2 ${k === key ? "ring-1 ring-neutral-900" : ""}`}><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold">{t.latest} <span className="text-xs font-normal">{u}</span></div>{t.delta != null && t.delta !== 0 && <div className={`text-xs ${t.delta < 0 ? "text-green-700" : "text-amber-700"}`}>{t.delta > 0 ? "+" : ""}{t.delta} since last</div>}</a> : null; })}
        {b && <div className="rounded border bg-white p-2"><div className="text-xs text-neutral-500">BMI</div><div className="text-lg font-semibold">{b}</div><div className="text-xs text-neutral-500">{bmiLabel(b)}</div></div>}
      </section>
      <section className="mb-4 rounded border bg-white p-4"><h2 className="mb-1 text-sm font-medium">{MEASURE_FIELDS.find(([k]) => k === key)![1]} over time</h2><ProgressChart points={rows.filter((r) => r[key] != null).map((r) => ({ at: r.at, value: r[key] as number })).reverse()} unit={unit} /></section>
      {write && <section className="mb-4 rounded border bg-white p-4"><h2 className="mb-2 font-medium">Record measurements</h2><MeasurementForm memberId={m.id} /></section>}
      <section className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500"><tr><th className="p-2">Date</th>{MEASURE_FIELDS.map(([k, l]) => <th key={k} className="p-2 text-right">{l}</th>)}<th className="p-2">Notes</th><th /></tr></thead>
          <tbody className="divide-y">{rows.map((r) => <tr key={r.id}><td className="p-2 whitespace-nowrap">{fmt(r.at)}</td>{MEASURE_FIELDS.map(([k]) => <td key={k} className="p-2 text-right">{r[k] ?? ""}</td>)}<td className="p-2 text-neutral-500">{r.notes}</td><td className="p-2">{write && <form action={deleteMeasurement.bind(null, m.id, r.id)}><button className="text-xs text-red-700 underline">Delete</button></form>}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-neutral-500">No measurements yet.</p>}
      </section>
    </AppShell>
  );
}
