"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/server/members";
import { addLockers, addMeasurement, assignLocker, savePlan } from "@/server/fitness";
import { DIET_TEMPLATE, MEASURE_FIELDS, WORKOUT_TEMPLATE } from "@/lib/fitness";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && !state.errors && !state.message) ref.current?.reset(); }, [state]);
  return ref;
}

export function MeasurementForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(addMeasurement.bind(null, memberId), undefined);
  const ref = useResetOnSuccess(state);
  const e = state?.errors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Field label="Date" error={e.at}><input name="at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={`${inputClass} px-2 py-1 text-sm`} /></Field>
        {MEASURE_FIELDS.map(([k, label, unit]) => <Field key={k} label={`${label} (${unit})`} error={e[k]}><input name={k} inputMode="decimal" className={`${inputClass} px-2 py-1 text-sm`} /></Field>)}
        <Field label="Notes"><input name="notes" className={`${inputClass} px-2 py-1 text-sm`} /></Field>
      </div>
      <div className="flex items-center gap-2"><button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Record"}</button>{state?.message && <span className="text-xs text-red-600">{state.message}</span>}</div>
    </form>
  );
}

export function PlanEditor({ memberId, plan }: { memberId: string; plan?: { id: string; type: "DIET" | "WORKOUT"; title: string; body: string } }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"DIET" | "WORKOUT">(plan?.type ?? "DIET");
  const [body, setBody] = useState(plan?.body ?? "");
  const [state, action, pending] = useActionState(savePlan.bind(null, memberId, plan?.id ?? null), undefined);
  useEffect(() => { if (state && !state.errors && !state.message) { setOpen(false); if (!plan) setBody(""); } }, [state, plan]);
  const e = state?.errors ?? {};
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={plan ? "text-xs underline" : secondaryButtonClass}>{plan ? "Edit" : "+ New diet / workout plan"}</button>;
  return (
    <form action={action} className="mt-2 space-y-2 rounded border bg-neutral-50 p-3">
      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Type" error={e.type}><select name="type" value={type} onChange={(ev) => setType(ev.target.value as "DIET" | "WORKOUT")} className={inputClass} disabled={!!plan}><option value="DIET">Diet</option><option value="WORKOUT">Workout</option></select>{plan && <input type="hidden" name="type" value={plan.type} />}</Field>
        <div className="sm:col-span-2"><Field label="Title" error={e.title}><input name="title" defaultValue={plan?.title ?? (type === "DIET" ? "Diet plan" : "Workout plan")} required className={inputClass} /></Field></div>
      </div>
      <Field label="Plan" error={e.body} hint="Plain text; the member sees this in their app"><textarea name="body" rows={10} value={body} onChange={(ev) => setBody(ev.target.value)} required className={`${inputClass} font-mono text-sm`} /></Field>
      {!body && <button type="button" onClick={() => setBody(type === "DIET" ? DIET_TEMPLATE : WORKOUT_TEMPLATE)} className="text-xs underline">Start from a template</button>}
      <div className="flex gap-2"><button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save plan"}</button><button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Cancel</button></div>
    </form>
  );
}

export function AddLockersForm() {
  const [state, action, pending] = useActionState(addLockers, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="From no." error={e.from}><input name="from" type="number" min={1} defaultValue={1} className={`${inputClass} w-24`} /></Field>
      <Field label="To no." error={e.to}><input name="to" type="number" min={1} defaultValue={20} className={`${inputClass} w-24`} /></Field>
      <Field label="Monthly fee (₹)" error={e.feePaise}><input name="feePaise" inputMode="decimal" defaultValue={0} className={`${inputClass} w-28`} /></Field>
      <button disabled={pending} className={buttonClass}>{pending ? "…" : "Add lockers"}</button>
      {state?.message && <span className="text-sm text-green-800">{state.message}</span>}
    </form>
  );
}

export function AssignLockerForm({ lockerId, feePaise, members }: { lockerId: string; feePaise: number; members: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(assignLocker.bind(null, lockerId), undefined);
  const [months, setMonths] = useState(1);
  const [memberId, setMemberId] = useState("");
  const e = state?.errors ?? {};
  return (
    <form action={action} className="mt-1 space-y-1 text-sm">
      <input list="locker-members" placeholder="Member code or name" required className={`${inputClass} px-2 py-1 text-sm`} onChange={(ev) => setMemberId(members.find((m) => m.label === ev.target.value)?.id ?? "")} />
      <input type="hidden" name="memberId" value={memberId} />
      <datalist id="locker-members">{members.map((m) => <option key={m.id} value={m.label} />)}</datalist>
      <div className="flex gap-1">
        <input name="months" type="number" min={1} max={24} value={months} onChange={(ev) => setMonths(Number(ev.target.value) || 1)} className={`${inputClass} w-16 px-2 py-1 text-sm`} aria-label="Months" />
        <input name="feePaise" inputMode="decimal" defaultValue={(feePaise * months) / 100} key={months} className={`${inputClass} w-24 px-2 py-1 text-sm`} aria-label="Fee" />
        <button disabled={pending} className={`${buttonClass} px-2 py-1`}>{pending ? "…" : "Assign"}</button>
      </div>
      {(e.memberId || e.months || e.feePaise || state?.message) && <p className="text-xs text-red-600">{e.memberId ?? e.months ?? e.feePaise ?? state?.message}</p>}
    </form>
  );
}
