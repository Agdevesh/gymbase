"use client";

import { useActionState, useEffect, useRef } from "react";
import { addExpense } from "@/server/expenses";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/payments";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/reports";
import { Field, buttonClass, inputClass } from "@/components/ui";

export function ExpenseForm() {
  const [state, action, pending] = useActionState(addExpense, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && !state.errors && !state.message) ref.current?.reset(); }, [state]);
  const e = state?.errors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-2">
      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Category" error={e.category}><select name="category" className={inputClass}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></Field>
        <Field label="Amount (₹)" error={e.amountPaise}><input name="amountPaise" inputMode="decimal" required className={inputClass} /></Field>
        <Field label="Date" error={e.paidAt}><input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={inputClass} /></Field>
        <Field label="Paid by" error={e.method}><select name="method" className={inputClass}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}</select></Field>
        <Field label="Paid to" error={e.vendor}><input name="vendor" placeholder="Landlord, electrician…" className={inputClass} /></Field>
        <Field label="Notes" error={e.notes}><input name="notes" className={inputClass} /></Field>
        <div className="col-span-2"><Field label="Bill / receipt (optional)" error={e.receipt}><input name="receipt" type="file" accept="image/*,application/pdf" className="text-sm" /></Field></div>
      </div>
      <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Add expense"}</button>
    </form>
  );
}
