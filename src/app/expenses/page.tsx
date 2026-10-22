import Link from "next/link";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/members";
import { METHOD_LABELS, paise } from "@/lib/payments";
import { can } from "@/lib/rbac";
import { CATEGORY_LABELS, monthRange, sumBy } from "@/lib/reports";
import { requireTenant } from "@/server/tenant";
import { deleteExpense } from "@/server/expenses";
import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { gymId, role } = await requireTenant("payments:write");
  const { month = "" } = await searchParams;
  const r = monthRange(month);
  const manage = can(role, "gym:manage");
  const rows = await db.expense.findMany({ where: { gymId, paidAt: { gte: r.start, lt: r.end } }, orderBy: { paidAt: "desc" }, include: { createdBy: { select: { name: true } } } });
  const total = rows.reduce((s, e) => s + e.amountPaise, 0);
  const byCat = sumBy(rows, (e) => e.category, (e) => e.amountPaise);
  return (
    <AppShell title="Expenses" actions={<>{manage && <ButtonLink href={`/reports?month=${r.key}`} secondary>Reports</ButtonLink>}<span className="self-center text-lg font-semibold">{paise(total)}</span></>}>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href={`/expenses?month=${r.prev}`} className="rounded border bg-white px-3 py-1">←</Link>
        <span className="font-medium">{r.label}</span>
        <Link href={`/expenses?month=${r.next}`} className="rounded border bg-white px-3 py-1">→</Link>
        {manage && <a href={`/api/export/expenses?from=${r.key}-01&to=${new Date(r.end.getTime() - 1).toISOString().slice(0, 10)}`} className="ml-auto underline">⬇ CSV</a>}
      </div>
      <section className="mb-4 rounded border bg-white p-4"><h2 className="mb-2 font-medium">Add expense</h2><ExpenseForm /></section>
      {byCat.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{byCat.map(([c, v]) => <div key={c} className="rounded border bg-white px-3 py-1.5 text-sm"><span className="text-neutral-500">{CATEGORY_LABELS[c]}</span> <strong>{paise(v)}</strong></div>)}</div>}
      {rows.length === 0 ? <p className="rounded border bg-white p-6 text-center text-neutral-500">No expenses recorded in {r.label}.</p> : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500"><tr><th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Paid to</th><th className="p-2">By</th><th className="p-2 text-right">Amount</th><th className="p-2" /></tr></thead>
            <tbody className="divide-y">{rows.map((e) => <tr key={e.id}><td className="p-2 whitespace-nowrap">{fmt(e.paidAt)}</td><td className="p-2">{CATEGORY_LABELS[e.category]}{e.notes && <span className="text-neutral-500"> · {e.notes}</span>}</td><td className="p-2">{e.vendor ?? "—"}</td><td className="p-2 text-neutral-500">{METHOD_LABELS[e.method]} · {e.createdBy?.name ?? "—"}</td><td className="p-2 text-right font-medium">{paise(e.amountPaise)}</td><td className="p-2 text-right whitespace-nowrap">{e.receiptId && <a href={fileUrl(e.receiptId)} target="_blank" rel="noreferrer" className="underline">Bill</a>}{manage && <form action={deleteExpense.bind(null, e.id)} className="ml-2 inline"><button className="text-red-700 underline">Delete</button></form>}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
