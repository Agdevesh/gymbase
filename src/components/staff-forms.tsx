"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/server/members";
import { acceptInvite, addCommission, assignPt, inviteStaff, logPtSession, type InviteState } from "@/server/staff";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteStaff, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.link) ref.current?.reset(); }, [state]);
  const e = state?.errors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" placeholder="staff@email.com" required className={inputClass} />
        <select name="role" defaultValue="RECEPTION" className={`${inputClass} sm:w-40`}><option value="RECEPTION">Reception</option><option value="TRAINER">Trainer</option></select>
        <button disabled={pending} className={`${buttonClass} shrink-0`}>{pending ? "…" : "Invite"}</button>
      </div>
      {(e.email || state?.message) && <p className="text-xs text-red-600">{e.email ?? state?.message}</p>}
      {state?.link && <p className="rounded bg-green-50 p-2 text-sm text-green-900">Invite created. Share this link (valid 7 days): <a href={state.link} className="break-all underline">{state.link}</a></p>}
    </form>
  );
}

export function AcceptInviteForm({ token, email, gymName }: { token: string; email: string; gymName: string }) {
  const [state, action, pending] = useActionState(acceptInvite.bind(null, token), undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      {state?.message && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.message}</p>}
      <p className="text-sm text-neutral-600">Joining <strong>{gymName}</strong> as {email}</p>
      <Field label="Your name" error={e.name}><input name="name" required autoFocus className={inputClass} /></Field>
      <Field label="Phone (optional)" error={e.phone}><input name="phone" type="tel" className={inputClass} /></Field>
      <Field label="Choose a password" error={e.password} hint="At least 8 characters"><input name="password" type="password" required minLength={8} className={inputClass} /></Field>
      <button disabled={pending} className={`${buttonClass} w-full justify-center`}>{pending ? "Creating…" : "Create my login"}</button>
    </form>
  );
}

export type TrainerOption = { id: string; name: string; commissionPercent: number };
export type PtMembershipOption = { id: string; label: string; ptSessions: number | null; pricePaise: number };

export function AssignPtForm({ memberId, trainers, memberships }: { memberId: string; trainers: TrainerOption[]; memberships: PtMembershipOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(assignPt.bind(null, memberId), undefined);
  const [msId, setMsId] = useState(memberships[0]?.id ?? "");
  const ms = memberships.find((m) => m.id === msId);
  useEffect(() => { if (state && !state.errors && !state.message) setOpen(false); }, [state]);
  const e = state?.errors ?? {};
  if (!open) return <button onClick={() => setOpen(true)} className={buttonClass}>Assign trainer</button>;
  return (
    <form action={action} className="space-y-2 rounded border bg-neutral-50 p-3">
      {state?.message && <p className="text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Trainer" error={e.trainerId}><select name="trainerId" className={inputClass} autoFocus>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.commissionPercent ? ` (${t.commissionPercent}% commission)` : ""}</option>)}</select></Field>
        <Field label="PT plan" error={e.membershipId} hint="Links the fee to the membership invoice">
          <select name="membershipId" value={msId} onChange={(ev) => setMsId(ev.target.value)} className={inputClass}><option value="">None / separate fee</option>{memberships.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </Field>
        <Field label="Sessions" error={e.sessionsTotal}><input key={msId} name="sessionsTotal" type="number" min={1} defaultValue={ms?.ptSessions ?? 12} required className={inputClass} /></Field>
        <Field label="Fee (₹)" error={e.feePaise} hint="Commission is calculated on this"><input key={msId + "fee"} name="feePaise" inputMode="decimal" defaultValue={ms ? ms.pricePaise / 100 : ""} className={inputClass} /></Field>
        <Field label="Start date" error={e.startDate}><input name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={inputClass} /></Field>
      </div>
      <div className="flex gap-2"><button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Assign"}</button><button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Cancel</button></div>
    </form>
  );
}

export function LogSessionForm({ assignmentId }: { assignmentId: string }) {
  return (
    <form action={logPtSession.bind(null, assignmentId)} className="flex gap-1">
      <input name="notes" placeholder="Session notes (optional)" className={`${inputClass} py-1 text-sm`} />
      <button className={`${buttonClass} shrink-0 py-1`}>Log session</button>
    </form>
  );
}

export function CommissionForm({ staff, period }: { staff: { id: string; name: string }[]; period: string }) {
  const [state, action, pending] = useActionState(addCommission, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && !state.errors && !state.message) ref.current?.reset(); }, [state]);
  const e = state?.errors ?? {};
  const err = e.userId ?? e.amountPaise ?? e.reason ?? e.period ?? state?.message;
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2 rounded border bg-neutral-50 p-3 sm:flex-row sm:items-center">
      <select name="userId" className={inputClass} aria-label="Staff">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <input name="amountPaise" inputMode="decimal" placeholder="Amount ₹" className={`${inputClass} sm:w-32`} />
      <input name="reason" placeholder="Reason (sales incentive, bonus…)" className={inputClass} />
      <input name="period" type="month" defaultValue={period} className={`${inputClass} sm:w-40`} />
      <button disabled={pending} className={`${buttonClass} shrink-0`}>{pending ? "…" : "Add"}</button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </form>
  );
}
