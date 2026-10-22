"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/members";
import { LEAD_SOURCES, SOURCE_LABELS, toLocalInput } from "@/lib/leads";
import { ButtonLink, Field, buttonClass, inputClass } from "@/components/ui";

export type LeadFormValues = { name: string; phone: string; email: string | null; source: string; interestedIn: string | null; followUpAt: Date | null; notes: string | null };

export function LeadForm({ action, initial, plans, cancelHref }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: LeadFormValues; plans: string[]; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  const v = initial;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(11, 0, 0, 0);
  return (
    <form action={formAction} className="space-y-4">
      {state?.message && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={e.name}><input name="name" defaultValue={v?.name} required autoFocus className={inputClass} /></Field>
        <Field label="Phone" error={e.phone}><input name="phone" type="tel" inputMode="tel" defaultValue={v?.phone} required className={inputClass} /></Field>
        <Field label="Source" error={e.source}>
          <select name="source" defaultValue={v?.source ?? "WALK_IN"} className={inputClass}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}</select>
        </Field>
        <Field label="Interested in" error={e.interestedIn}>
          <input name="interestedIn" list="plan-names" defaultValue={v?.interestedIn ?? ""} className={inputClass} />
          <datalist id="plan-names">{plans.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Email" error={e.email}><input name="email" type="email" defaultValue={v?.email ?? ""} className={inputClass} /></Field>
        <Field label="Follow up on" error={e.followUpAt}><input name="followUpAt" type="datetime-local" defaultValue={toLocalInput(v?.followUpAt ?? tomorrow)} className={inputClass} /></Field>
      </div>
      <Field label="Notes" error={e.notes}><textarea name="notes" rows={3} defaultValue={v?.notes ?? ""} className={inputClass} /></Field>
      <div className="flex gap-2">
        <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : initial ? "Save" : "Add lead"}</button>
        <ButtonLink href={cancelHref} secondary>Cancel</ButtonLink>
      </div>
    </form>
  );
}
