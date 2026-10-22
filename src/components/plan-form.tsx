"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/server/members";
import { DEFAULT_DURATION, PLAN_TYPES } from "@/lib/memberships";
import { ButtonLink, Field, buttonClass, inputClass } from "@/components/ui";

export type PlanFormValues = { name: string; type: string; durationDays: number; pricePaise: number; ptSessions: number | null; active: boolean };

const LABELS: Record<(typeof PLAN_TYPES)[number], string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-yearly", YEARLY: "Yearly", PT: "Personal training", CUSTOM: "Custom" };

export function PlanForm({ action, initial }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: PlanFormValues }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState(initial?.type ?? "MONTHLY");
  const [duration, setDuration] = useState(String(initial?.durationDays ?? DEFAULT_DURATION.MONTHLY));
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state?.message && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name" error={e.name}><input name="name" defaultValue={initial?.name} required autoFocus className={inputClass} /></Field>
        <Field label="Type" error={e.type}>
          <select name="type" value={type} className={inputClass} onChange={(ev) => { const t = ev.target.value as (typeof PLAN_TYPES)[number]; setType(t); if (!initial) setDuration(String(DEFAULT_DURATION[t])); }}>
            {PLAN_TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Duration (days)" error={e.durationDays}><input name="durationDays" type="number" min={1} value={duration} onChange={(ev) => setDuration(ev.target.value)} required className={inputClass} /></Field>
        <Field label="Price (₹)" error={e.pricePaise}><input name="pricePaise" inputMode="decimal" defaultValue={initial ? initial.pricePaise / 100 : ""} required className={inputClass} /></Field>
        {type === "PT" && <Field label="PT sessions" error={e.ptSessions}><input name="ptSessions" type="number" min={1} defaultValue={initial?.ptSessions ?? 12} className={inputClass} /></Field>}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="hidden" name="active" value="off" /><input type="checkbox" name="active" value="on" defaultChecked={initial?.active ?? true} /> Active (can be assigned to members)</label>
      <div className="flex gap-2">
        <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : initial ? "Save plan" : "Create plan"}</button>
        <ButtonLink href="/plans" secondary>Cancel</ButtonLink>
      </div>
    </form>
  );
}
