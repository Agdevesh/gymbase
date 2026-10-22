import Link from "next/link";
import { requireTenant } from "@/server/tenant";
import { dismissSetup, setupStatus } from "@/server/setup";
import { AppShell, ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const { gymId } = await requireTenant("gym:manage");
  const s = await setupStatus(gymId);
  return (
    <AppShell title="Getting started" actions={!s.dismissed && <form action={dismissSetup}><button className="rounded border bg-white px-3 py-1 text-sm">Hide checklist</button></form>}>
      <p className="mb-4 text-sm text-neutral-600">{s.done} of {s.total} essentials done. Each step takes a minute or two.</p>
      <ol className="divide-y rounded border bg-white">
        {s.steps.map((st, i) => (
          <li key={st.key} className="flex items-start gap-3 p-3">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${st.done ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-700"}`}>{st.done ? "✓" : i + 1}</span>
            <div className="flex-1"><Link href={st.href} className={`font-medium hover:underline ${st.done ? "text-neutral-500 line-through" : ""}`}>{st.label}</Link><p className="text-xs text-neutral-500">{st.hint}</p></div>
            {!st.done && <ButtonLink href={st.href} secondary className="shrink-0 py-1 text-xs">Do it</ButtonLink>}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-neutral-500">Demo login to explore first: gym code <span className="font-mono">demo</span>, owner@demo.gym / password123 (if seeded).</p>
    </AppShell>
  );
}
