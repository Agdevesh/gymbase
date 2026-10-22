import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
const PAGE = 100;
const when = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string; id?: string }> }) {
  const { gymId } = await requireTenant("gym:manage");
  const { page: p, entity, id } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const where = { gymId, ...(entity && { entity }), ...(id && { entityId: id }) };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true } } } }),
    db.auditLog.count({ where }),
  ]);
  const link = (e: string | null, i: string | null) => (e === "member" && i ? `/members/${i}` : e === "invoice" && i ? `/invoices/${i}` : e === "lead" && i ? `/leads/${i}` : null);
  return (
    <AppShell title="Activity log" back={{ href: "/settings", label: "Settings" }}>
      <p className="mb-3 text-sm text-neutral-500">{total.toLocaleString("en-IN")} entries. Every payment, refund, membership change, member edit and settings change is recorded with who did it.</p>
      {rows.length === 0 ? <p className="rounded border bg-white p-6 text-center text-neutral-500">Nothing yet.</p> : (
        <ul className="divide-y rounded border bg-white text-sm">
          {rows.map((r) => { const href = link(r.entity, r.entityId); return (
            <li key={r.id} className="flex flex-wrap gap-x-3 px-3 py-2">
              <span className="w-28 shrink-0 text-neutral-500">{when(r.createdAt)}</span>
              <span className="w-28 shrink-0 truncate font-medium">{r.user?.name ?? "System"}</span>
              <span className="flex-1">{href ? <Link href={href} className="hover:underline">{r.summary}</Link> : r.summary}</span>
              <span className="text-xs text-neutral-400">{r.action}</span>
            </li>); })}
        </ul>
      )}
      {total > PAGE && <div className="mt-3 flex justify-between text-sm">{page > 1 ? <Link href={`/settings/audit?page=${page - 1}`}>← Newer</Link> : <span />}{page * PAGE < total ? <Link href={`/settings/audit?page=${page + 1}`}>Older →</Link> : <span />}</div>}
    </AppShell>
  );
}
