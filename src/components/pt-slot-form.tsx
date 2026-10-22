"use client";

import { useActionState, useState } from "react";
import { scheduleSlots } from "@/server/ptslots";
import { WEEKDAYS } from "@/lib/classes";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export function PtSlotForm({ assignmentId, left }: { assignmentId: string; left: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: undefined | Awaited<ReturnType<typeof scheduleSlots>>, fd: FormData) => { const r = await scheduleSlots(assignmentId, prev, fd); if (r && !r.errors && !r.message) setOpen(false); return r; }, undefined);
  const [weeks, setWeeks] = useState(1);
  const e = state?.errors ?? {};
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${secondaryButtonClass} py-1 text-xs`} disabled={left <= 0}>+ Schedule slot</button>;
  return (
    <form action={action} className="mt-2 space-y-2 rounded border bg-neutral-50 p-3 text-sm">
      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="First session" error={e.date}><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={inputClass} /></Field>
        <Field label="Time" error={e.time}><input name="time" type="time" defaultValue="07:00" required className={inputClass} /></Field>
        <Field label="Minutes" error={e.durationMin}><input name="durationMin" type="number" min={15} step={15} defaultValue={60} className={inputClass} /></Field>
        <Field label="Repeat for weeks" error={e.repeatWeeks}><input name="repeatWeeks" type="number" min={1} max={12} value={weeks} onChange={(ev) => setWeeks(Number(ev.target.value) || 1)} className={inputClass} /></Field>
      </div>
      {weeks > 1 && <Field label="On these days (same time)" error={e.weekdays}><div className="flex flex-wrap gap-2">{WEEKDAYS.map((d, i) => <label key={d} className="flex items-center gap-1 rounded border bg-white px-2 py-1"><input type="checkbox" name="weekdays" value={i} /> {d}</label>)}</div></Field>}
      <p className="text-xs text-neutral-500">{left} unscheduled session{left === 1 ? "" : "s"} left on the plan.</p>
      <div className="flex gap-2"><button disabled={pending} className={buttonClass}>{pending ? "…" : "Book"}</button><button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Cancel</button></div>
    </form>
  );
}
