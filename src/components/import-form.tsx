"use client";

import { useActionState } from "react";
import { previewImport, runImport, type ImportState } from "@/server/import";
import { buttonClass, inputClass } from "@/components/ui";

const d = (x: Date | null) => (x ? x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "");

export function ImportForm() {
  const [state, action, pending] = useActionState(async (prev: ImportState, fd: FormData) => (fd.get("csv") ? runImport(prev, fd) : previewImport(prev, fd)), undefined);
  if (state?.result) {
    const r = state.result;
    return (
      <div className="rounded border bg-white p-4 text-sm">
        <p className="text-lg font-semibold text-green-800">Imported {r.created} member{r.created === 1 ? "" : "s"}, {r.memberships} with a plan.</p>
        {r.skipped > 0 && <p>{r.skipped} skipped because the phone number already exists.</p>}
        {r.failed.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-red-700">{r.failed.length} row{r.failed.length === 1 ? "" : "s"} with issues</summary><ul className="mt-1 list-disc pl-5 text-xs">{r.failed.map((f, i) => <li key={i}>{f}</li>)}</ul></details>}
        <a href="/members" className={`${buttonClass} mt-3`}>Go to members</a>
      </div>
    );
  }
  if (state?.preview) {
    const { rows, plans, csv } = state.preview;
    const ok = rows.filter((r) => !r.errors.length), bad = rows.length - ok.length;
    const unknownPlans = [...new Set(rows.map((r) => r.plan).filter((p): p is string => !!p && !plans.some((n) => n.toLowerCase() === p.toLowerCase())))];
    return (
      <form action={action} className="space-y-3">
        <input type="hidden" name="csv" value={csv} />
        <p className="text-sm">{rows.length} rows read: <strong className="text-green-800">{ok.length} ready</strong>{bad > 0 && <>, <strong className="text-red-700">{bad} with problems</strong> (they will be skipped)</>}.</p>
        {unknownPlans.length > 0 && <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">Plans not found: {unknownPlans.join(", ")}. Those members import without a plan. Your plans: {plans.join(", ")}. Fix the sheet or add the plans first.</p>}
        <div className="max-h-96 overflow-auto rounded border bg-white">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-100 text-left"><tr><th className="p-1">#</th><th className="p-1">Name</th><th className="p-1">Phone</th><th className="p-1">Plan</th><th className="p-1">Start</th><th className="p-1">End</th><th className="p-1 text-right">Paid</th><th className="p-1">Issues</th></tr></thead>
            <tbody className="divide-y">{rows.slice(0, 300).map((r) => <tr key={r.line} className={r.errors.length ? "bg-red-50" : ""}><td className="p-1 text-neutral-400">{r.line}</td><td className="p-1">{r.name}</td><td className="p-1">{r.phone}</td><td className="p-1">{r.plan}</td><td className="p-1">{d(r.start)}</td><td className="p-1">{d(r.end)}</td><td className="p-1 text-right">{r.paidPaise ? (r.paidPaise / 100).toLocaleString("en-IN") : ""}</td><td className="p-1 text-red-700">{r.errors.join(", ")}</td></tr>)}</tbody>
          </table>
          {rows.length > 300 && <p className="p-2 text-xs text-neutral-500">Showing the first 300 rows.</p>}
        </div>
        <div className="flex gap-2"><button disabled={pending || ok.length === 0} className={buttonClass}>{pending ? "Importing…" : `Import ${ok.length} members`}</button><a href="/members/import" className="rounded border bg-white px-4 py-2 text-sm">Choose another file</a></div>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-3">
      {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <input name="file" type="file" accept=".csv,text/csv" required className={inputClass} />
      <button disabled={pending} className={buttonClass}>{pending ? "Reading…" : "Preview import"}</button>
    </form>
  );
}
