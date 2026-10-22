"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/server/members";
import { bookMember, saveClass } from "@/server/classes";
import { WEEKDAYS } from "@/lib/classes";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export type ClassValues = { id: string; name: string; trainerId: string | null; weekdays: number[]; startTime: string; durationMin: number; capacity: number; notes: string | null; active: boolean };

export function ClassForm({ trainers, initial }: { trainers: { id: string; name: string }[]; initial?: ClassValues }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => { const r = await saveClass(initial?.id ?? null, prev, fd); if (r && !r.errors && !r.message) setOpen(false); return r; }, undefined);
  const e = state?.errors ?? {};
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={initial ? "text-xs underline" : buttonClass}>{initial ? "Edit" : "+ New class"}</button>;
  return (
    <form action={action} className="mt-2 space-y-3 rounded border bg-neutral-50 p-3">
      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Class name" error={e.name}><input name="name" defaultValue={initial?.name} placeholder="Zumba, Yoga, HIIT…" required className={inputClass} /></Field>
        <Field label="Trainer" error={e.trainerId}><select name="trainerId" defaultValue={initial?.trainerId ?? ""} className={inputClass}><option value="">—</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Starts at" error={e.startTime}><input name="startTime" type="time" defaultValue={initial?.startTime ?? "07:00"} required className={inputClass} /></Field>
        <Field label="Duration (min)" error={e.durationMin}><input name="durationMin" type="number" min={10} defaultValue={initial?.durationMin ?? 60} className={inputClass} /></Field>
        <Field label="Capacity" error={e.capacity}><input name="capacity" type="number" min={1} defaultValue={initial?.capacity ?? 20} className={inputClass} /></Field>
        <Field label="Notes" error={e.notes}><input name="notes" defaultValue={initial?.notes ?? ""} placeholder="Bring a mat" className={inputClass} /></Field>
      </div>
      <Field label="Days" error={e.weekdays}>
        <div className="flex flex-wrap gap-2 text-sm">{WEEKDAYS.map((d, i) => <label key={d} className="flex items-center gap-1 rounded border bg-white px-2 py-1"><input type="checkbox" name="weekdays" value={i} defaultChecked={initial ? initial.weekdays.includes(i) : i >= 1 && i <= 6} /> {d}</label>)}</div>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="hidden" name="active" value="off" /><input type="checkbox" name="active" value="on" defaultChecked={initial?.active ?? true} /> Active (shown on the timetable and bookable)</label>
      <div className="flex gap-2"><button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save class"}</button><button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Cancel</button></div>
    </form>
  );
}

export function BookMemberForm({ classId, dayKey, members }: { classId: string; dayKey: string; members: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(bookMember.bind(null, classId, dayKey), undefined);
  const [memberId, setMemberId] = useState("");
  return (
    <form action={action} className="flex flex-wrap items-start gap-2 text-sm">
      <input list="class-members" placeholder="Member code or name" required className={`${inputClass} w-64`} onChange={(ev) => setMemberId(members.find((m) => m.label === ev.target.value)?.id ?? "")} />
      <input type="hidden" name="memberId" value={memberId} />
      <datalist id="class-members">{members.map((m) => <option key={m.id} value={m.label} />)}</datalist>
      <button disabled={pending} className={buttonClass}>{pending ? "…" : "Book"}</button>
      {(state?.errors?.memberId || state?.message) && <p className="w-full text-xs text-red-600">{state.errors?.memberId ?? state.message}</p>}
    </form>
  );
}
