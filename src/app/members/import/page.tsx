import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { ImportForm } from "@/components/import-form";

export default async function ImportPage() {
  await requireTenant("members:write");
  return (
    <AppShell title="Import members from Excel" back={{ href: "/members", label: "Members" }}>
      <section className="mb-4 rounded border bg-white p-4 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li><a href="/api/import" className="underline">Download the template</a> or use your own sheet with columns <span className="font-mono">name, phone, email, gender, dob, joined, plan, start, end, paid, notes</span> (only name and phone are required; common headings like "Mobile" or "Expiry date" are recognised).</li>
          <li>In Excel: File → Save As → <strong>CSV (comma delimited)</strong>. Dates can be 31/01/2026 or 2026-01-31.</li>
          <li>Upload below, check the preview, then import. Members whose phone already exists are skipped, so re-running is safe.</li>
        </ol>
        <p className="mt-2 text-neutral-500">"plan" must match one of your plan names. With a start date, a membership is created (end date from the plan if blank) and the "paid" amount is recorded as received; the rest shows as dues.</p>
      </section>
      <ImportForm />
    </AppShell>
  );
}
