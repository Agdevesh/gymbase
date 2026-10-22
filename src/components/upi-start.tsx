"use client";

import { useActionState } from "react";
import { startUpiRequest } from "@/server/upi";
import { paise } from "@/lib/payments";
import { buttonClass } from "@/components/ui";

export function StartUpiButton({ invoiceId, duePaise }: { invoiceId: string; duePaise: number }) {
  const [state, action, pending] = useActionState(async () => startUpiRequest(invoiceId), undefined);
  return (
    <form action={action} className="flex items-center gap-3">
      <button disabled={pending} className={buttonClass}>{pending ? "Opening…" : `Collect ${paise(duePaise)} by UPI QR`}</button>
      <span className="text-xs text-neutral-500">Fixed amount, verified from the bank alert</span>
      {state?.message && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}
