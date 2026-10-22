"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/server/members";
import { confirmUpiByUtr } from "@/server/upi";
import { Field, buttonClass, inputClass } from "@/components/ui";

type Status = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

// Polls the request every 3 s and flips the screen when the bank alert lands.
export function useUpiStatus(token: string, initial: Status) {
  const [status, setStatus] = useState<Status>(initial);
  const [utr, setUtr] = useState<string | null>(null);
  useEffect(() => {
    if (status !== "PENDING") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/upi/status/${token}`, { cache: "no-store" });
        if (!r.ok || stop) return;
        const j = (await r.json()) as { status: Status; utr: string | null };
        if (j.status !== "PENDING") { setStatus(j.status); setUtr(j.utr); }
      } catch { /* offline; try again next tick */ }
    };
    const id = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [token, status]);
  return { status, utr };
}

export function UpiWaiting({ token, initial, amount, children, paidNote }: { token: string; initial: Status; amount: string; children: React.ReactNode; paidNote?: React.ReactNode }) {
  const { status, utr } = useUpiStatus(token, initial);
  if (status === "PAID") return (
    <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center">
      <div className="text-4xl">✓</div>
      <div className="text-xl font-semibold text-green-800">{amount} received</div>
      {utr && <div className="mt-1 font-mono text-sm text-green-800">UTR {utr}</div>}
      {paidNote}
    </div>
  );
  if (status !== "PENDING") return <div className="rounded-lg border bg-neutral-50 p-6 text-center text-neutral-600">This payment request is {status.toLowerCase()}. Ask reception for a fresh QR.</div>;
  return <>{children}<p className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-600"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />Waiting for payment… this screen updates by itself.</p></>;
}

export function UtrForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(confirmUpiByUtr.bind(null, requestId), undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="Or type the UTR from the member's phone" error={e.utr} hint="12-digit UPI Ref no. on their payment screen"><input name="utr" inputMode="numeric" className={inputClass} placeholder="629812345678" /></Field>
      <button disabled={pending} className={`${buttonClass} shrink-0`}>{pending ? "Checking…" : "Confirm by UTR"}</button>
      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
