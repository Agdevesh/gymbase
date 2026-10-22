"use client";

import { useActionState } from "react";
import type { AccessState } from "@/server/portal";

export function MemberAccessButton({ action, label, phone }: { action: () => Promise<AccessState>; label: string; phone: string }) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  return (
    <form action={formAction}>
      <button disabled={pending} className="rounded border bg-white px-3 py-1 text-sm hover:bg-neutral-100">{pending ? "…" : label}</button>
      {state?.pin && (
        <div className="mt-2 rounded bg-green-50 p-3 text-sm text-green-900">
          Login PIN: <span className="font-mono text-lg font-semibold">{state.pin}</span> (phone {phone}). Shown once.
          <a href={state.wa} target="_blank" rel="noreferrer" className="ml-2 underline">Send on WhatsApp</a>
        </div>
      )}
      {state?.message && <p className="mt-1 text-xs text-red-700">{state.message}</p>}
    </form>
  );
}
