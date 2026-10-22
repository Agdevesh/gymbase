"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/members";
import type { ResetState } from "@/server/settings";
import { Field, buttonClass, inputClass } from "@/components/ui";

export type SettingsValues = { name: string; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; gstin: string | null; gstPercent: number; upiId: string | null; receiptNote: string | null; openTime: string | null; closeTime: string | null; weeklyOff: string | null; holidays: string[]; logoUrl: string | null; autoSuspendEnabled: boolean; autoSuspendDays: number };

export function SettingsForm({ action, initial }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial: SettingsValues }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  const msg = state?.message;
  return (
    <form action={formAction} className="space-y-6">
      {msg && <p className={`rounded-lg p-2 text-sm ${msg === "Saved." ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg}</p>}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Gym profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gym name" error={e.name}><input name="name" defaultValue={initial.name} required className={inputClass} /></Field>
          <Field label="Phone" error={e.phone}><input name="phone" defaultValue={initial.phone ?? ""} className={inputClass} /></Field>
          <Field label="WhatsApp number" error={e.whatsapp} hint="Shown to members for queries"><input name="whatsapp" defaultValue={initial.whatsapp ?? ""} className={inputClass} /></Field>
          <Field label="Email" error={e.email}><input name="email" defaultValue={initial.email ?? ""} className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field label="Address" error={e.address}><textarea name="address" rows={2} defaultValue={initial.address ?? ""} className={inputClass} /></Field></div>
          <Field label="Logo" error={e.logo} hint="JPG/PNG/WebP up to 2 MB, printed on invoices">
            <div className="flex items-center gap-3">
              {initial.logoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={initial.logoUrl} alt="logo" className="h-12 w-12 rounded-lg object-contain" />}
              <input name="logo" type="file" accept="image/*" className="text-sm" />
            </div>
            {initial.logoUrl && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="removeLogo" value="on" /> Remove logo</label>}
          </Field>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Billing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GSTIN" error={e.gstin} hint="Leave blank if not registered"><input name="gstin" defaultValue={initial.gstin ?? ""} className={inputClass} /></Field>
          <Field label="GST % on new invoices" error={e.gstPercent}><input name="gstPercent" type="number" min={0} max={28} defaultValue={initial.gstPercent} className={inputClass} /></Field>
          <Field label="UPI ID" error={e.upiId} hint="Members get a Pay-by-UPI link for dues, e.g. gymname@okaxis"><input name="upiId" defaultValue={initial.upiId ?? ""} className={inputClass} /></Field>
          <Field label="Receipt footer" error={e.receiptNote} hint="Printed at the bottom of invoices"><input name="receiptNote" defaultValue={initial.receiptNote ?? ""} className={inputClass} /></Field>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="mb-1 font-semibold text-slate-900">Unpaid dues</h2>
        <p className="mb-3 text-sm text-slate-500">When a member's dues stay unpaid this long, their membership is suspended automatically (no check-in) and restored the moment they pay. Staff can also restore it from the profile.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auto-suspend" error={e.autoSuspendEnabled}><select name="autoSuspendEnabled" defaultValue={initial.autoSuspendEnabled ? "on" : "off"} className={inputClass}><option value="on">On (recommended)</option><option value="off">Off</option></select></Field>
          <Field label="After how many days unpaid" error={e.autoSuspendDays}><input name="autoSuspendDays" type="number" min={1} max={90} defaultValue={initial.autoSuspendDays} className={inputClass} /></Field>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Timings & holidays</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Opens at" error={e.openTime}><input name="openTime" type="time" defaultValue={initial.openTime ?? ""} className={inputClass} /></Field>
          <Field label="Closes at" error={e.closeTime}><input name="closeTime" type="time" defaultValue={initial.closeTime ?? ""} className={inputClass} /></Field>
          <Field label="Weekly off" error={e.weeklyOff}><input name="weeklyOff" placeholder="e.g. Sunday" defaultValue={initial.weeklyOff ?? ""} className={inputClass} /></Field>
        </div>
        <div className="mt-4"><Field label="Holidays (one per line: date then name)" error={e.holidays} hint="e.g. 2026-10-20 Diwali. Reception sees a holiday banner on those days."><textarea name="holidays" rows={4} defaultValue={initial.holidays.join("\n")} className={`${inputClass} font-mono text-sm`} /></Field></div>
      </section>
      <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

export function PasswordForm({ action, needsCurrent, submitLabel = "Change password", minLength = 8 }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; needsCurrent: boolean; submitLabel?: string; minLength?: number }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  if (state?.message === "done") return <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Password set. <a href="/login" className="font-medium text-brand-700 hover:underline">Sign in</a></p>;
  return (
    <form action={formAction} className="space-y-3">
      {state?.message && <p className={`rounded-lg p-2 text-sm ${/changed\.$/.test(state.message) ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{state.message}</p>}
      {needsCurrent && <Field label={minLength < 8 ? "Current PIN" : "Current password"} error={e.current}><input name="current" type="password" required className={inputClass} /></Field>}
      <Field label={minLength < 8 ? "New PIN (4-8 digits)" : "New password"} error={e.password}><input name="password" type="password" minLength={minLength} inputMode={minLength < 8 ? "numeric" : undefined} required className={inputClass} /></Field>
      <Field label={minLength < 8 ? "Confirm new PIN" : "Confirm new password"} error={e.confirm}><input name="confirm" type="password" required className={inputClass} /></Field>
      <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

export function ResetLinkButton({ action, name }: { action: () => Promise<ResetState>; name: string }) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  return (
    <form action={formAction} className="inline">
      <button disabled={pending} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 px-2 py-1 text-xs">{pending ? "…" : "Reset password"}</button>
      {state?.link && <span className="ml-2 block text-xs text-slate-600">Share this link with {name} (valid 2 h): <input readOnly value={state.link} onFocus={(ev) => ev.currentTarget.select()} className="rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs hover:bg-slate-50 mt-1 w-full px-1 py-0.5 text-xs" /></span>}
      {state?.message && <span className="ml-2 text-xs text-red-700">{state.message}</span>}
    </form>
  );
}

export function ForgotForm({ action }: { action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {state?.message && <p className="rounded-lg bg-slate-100 p-2 text-sm">{state.message}</p>}
      <Field label="Gym code" error={state?.errors?.gym}><input name="gym" required className={inputClass} /></Field>
      <Field label="Email" error={state?.errors?.email}><input name="email" type="email" required className={inputClass} /></Field>
      <button disabled={pending} className={`${buttonClass} w-full justify-center`}>{pending ? "…" : "Send reset link"}</button>
    </form>
  );
}
