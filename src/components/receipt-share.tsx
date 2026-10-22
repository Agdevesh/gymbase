"use client";

import { useActionState } from "react";
import { shareReceipt } from "@/server/payments";

export function ReceiptShare({ invoiceId, label = "WhatsApp receipt" }: { invoiceId: string; label?: string }) {
  const [state, action, pending] = useActionState(async () => shareReceipt(invoiceId), undefined);
  if (state?.wa) return <a href={state.wa} target="_blank" rel="noreferrer" className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-700">Open WhatsApp</a>;
  return <form action={action} className="inline"><button disabled={pending} className="text-xs underline">{pending ? "…" : label}</button>{state?.message && <span className="ml-1 text-xs text-red-700">{state.message}</span>}</form>;
}
