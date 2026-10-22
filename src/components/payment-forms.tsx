"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/server/members";
import { addCharge, closeDay, collectPayment, refundPayment } from "@/server/payments";
import { METHOD_LABELS, PAYMENT_METHODS, paise } from "@/lib/payments";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const MethodSelect = ({ defaultValue = "CASH" }: { defaultValue?: string }) => (
  <select name="method" defaultValue={defaultValue} className={inputClass} aria-label="Method">{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}</select>
);

function useReset(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && !state.errors && !state.message) ref.current?.reset(); }, [state]);
  return ref;
}

export function CollectForm({ memberId, duePaise, invoiceId }: { memberId: string; duePaise: number; invoiceId?: string }) {
  const [state, action, pending] = useActionState(collectPayment.bind(null, memberId), undefined);
  const ref = useReset(state);
  const [method, setMethod] = useState("CASH");
  const e = state?.errors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-2 rounded border bg-neutral-50 p-3">
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Amount (₹)" error={e.amountPaise}><input name="amountPaise" inputMode="decimal" defaultValue={duePaise > 0 ? duePaise / 100 : ""} required autoFocus className={inputClass} /></Field>
        <Field label="Method"><select name="method" value={method} onChange={(ev) => setMethod(ev.target.value)} className={inputClass}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}</select></Field>
        <Field label={method === "CASH" ? "Note" : "Reference / txn id"} error={e.reference}><input name="reference" className={inputClass} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Collect payment"}</button>
        {duePaise > 0 && <span className="text-sm text-neutral-500">Outstanding {paise(duePaise)}</span>}
        {state?.message && <span className="text-xs text-red-600">{state.message}</span>}
        {state && !state.errors && !state.message && <span className="text-sm text-green-700">Recorded ✓</span>}
        {state?.wa && <a href={state.wa} target="_blank" rel="noreferrer" className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700">Send receipt on WhatsApp</a>}
      </div>
    </form>
  );
}

export function ChargeForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(addCharge.bind(null, memberId), undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
      <Field label="Other charge" error={e.description}><input name="description" placeholder="Registration fee, locker, supplements…" className={inputClass} /></Field>
      <Field label="Amount (₹)" error={e.amountPaise}><input name="amountPaise" inputMode="decimal" className={inputClass} /></Field>
      <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="gst" value="on" defaultChecked /> GST</label>
      <button disabled={pending} className={`${secondaryButtonClass} shrink-0`}>{pending ? "…" : "Add charge"}</button>
      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}

export function RefundForm({ paymentId, maxPaise }: { paymentId: string; maxPaise: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(refundPayment.bind(null, paymentId), undefined);
  useEffect(() => { if (state && !state.errors && !state.message) setOpen(false); }, [state]);
  const e = state?.errors ?? {};
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-red-700 underline">Refund</button>;
  return (
    <form action={action} className="mt-2 grid gap-2 rounded border bg-red-50 p-2 sm:grid-cols-4">
      <Field label="Refund (₹)" error={e.amountPaise}><input name="amountPaise" inputMode="decimal" defaultValue={maxPaise / 100} autoFocus className={inputClass} /></Field>
      <Field label="Via"><MethodSelect /></Field>
      <Field label="Reason" error={e.reason}><input name="reason" required className={inputClass} /></Field>
      <div className="flex items-end gap-2"><button disabled={pending} className={`${buttonClass} bg-red-700 hover:bg-red-600`}>Refund</button><button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Back</button></div>
      {state?.message && <p className="text-xs text-red-600 sm:col-span-4">{state.message}</p>}
    </form>
  );
}

export function ClosingForm({ date, expectedPaise }: { date: string; expectedPaise: number }) {
  const [state, action, pending] = useActionState(closeDay, undefined);
  const [counted, setCounted] = useState("");
  const diff = counted ? Math.round(Number(counted.replace(/[,\s₹]/g, "")) * 100) - expectedPaise : null;
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-2 rounded border bg-neutral-50 p-3">
      <input type="hidden" name="date" value={date} />
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Cash expected"><input value={paise(expectedPaise)} readOnly className={`${inputClass} bg-neutral-100`} /></Field>
        <Field label="Cash counted (₹)" error={e.countedPaise}><input name="countedPaise" inputMode="decimal" value={counted} onChange={(ev) => setCounted(ev.target.value)} required className={inputClass} /></Field>
        <Field label="Notes"><input name="notes" className={inputClass} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={buttonClass}>{pending ? "Closing…" : "Close the day"}</button>
        {diff !== null && Number.isFinite(diff) && <span className={`text-sm ${diff === 0 ? "text-green-700" : "text-red-700"}`}>{diff === 0 ? "Tallies" : `${diff > 0 ? "Excess" : "Short"} ${paise(Math.abs(diff))}`}</span>}
        {state?.message && <span className="text-xs text-red-600">{state.message}</span>}
      </div>
    </form>
  );
}
