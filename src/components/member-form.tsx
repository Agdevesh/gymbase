"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/members";
import { Avatar, ButtonLink, Field, buttonClass, inputClass } from "@/components/ui";

export type MemberFormValues = {
  firstName: string; lastName: string | null; phone: string; email: string | null; gender: string | null;
  dob: Date | null; address: string | null; emergencyName: string | null; emergencyPhone: string | null; usualTime: string | null; notes: string | null; photoUrl: string | null;
};

export function MemberForm({ action, initial, cancelHref }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: MemberFormValues; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  const v = initial;
  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      {state?.message && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={e.firstName}><input name="firstName" defaultValue={v?.firstName} required autoFocus className={inputClass} /></Field>
        <Field label="Last name" error={e.lastName}><input name="lastName" defaultValue={v?.lastName ?? ""} className={inputClass} /></Field>
        <Field label="Phone" error={e.phone} hint="10-digit Indian number or +country code"><input name="phone" type="tel" inputMode="tel" defaultValue={v?.phone} required className={inputClass} /></Field>
        <Field label="Email" error={e.email}><input name="email" type="email" defaultValue={v?.email ?? ""} className={inputClass} /></Field>
        <Field label="Gender" error={e.gender}>
          <select name="gender" defaultValue={v?.gender ?? ""} className={inputClass}>
            <option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Date of birth" error={e.dob}><input name="dob" type="date" defaultValue={v?.dob ? v.dob.toISOString().slice(0, 10) : ""} className={inputClass} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Usual gym time" error={e.usualTime} hint="e.g. Morning 6-8, Evening 7-9">
          <input name="usualTime" list="usual-times" defaultValue={v?.usualTime ?? ""} className={inputClass} />
          <datalist id="usual-times"><option value="Morning 6-8" /><option value="Morning 8-10" /><option value="Afternoon 12-3" /><option value="Evening 5-7" /><option value="Evening 7-9" /><option value="Night 9-11" /></datalist>
        </Field>
      </div>
      <Field label="Address" error={e.address}><textarea name="address" rows={2} defaultValue={v?.address ?? ""} className={inputClass} /></Field>
      <fieldset className="grid gap-4 rounded border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">Emergency contact</legend>
        <Field label="Name" error={e.emergencyName}><input name="emergencyName" defaultValue={v?.emergencyName ?? ""} className={inputClass} /></Field>
        <Field label="Phone" error={e.emergencyPhone}><input name="emergencyPhone" type="tel" inputMode="tel" defaultValue={v?.emergencyPhone ?? ""} className={inputClass} /></Field>
      </fieldset>
      <div className="flex items-start gap-4">
        {v && <Avatar name={v.firstName} photoUrl={v.photoUrl} size={64} />}
        <div className="flex-1 space-y-2">
          <Field label="Photo" error={e.photo} hint="JPG, PNG or WebP up to 2 MB"><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" /></Field>
          {v?.photoUrl && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removePhoto" /> Remove current photo</label>}
        </div>
      </div>
      <Field label="Notes" error={e.notes} hint="Health conditions, goals, anything reception should know"><textarea name="notes" rows={3} defaultValue={v?.notes ?? ""} className={inputClass} /></Field>
      <div className="flex gap-2">
        <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : v ? "Save changes" : "Add member"}</button>
        <ButtonLink href={cancelHref} secondary>Cancel</ButtonLink>
      </div>
    </form>
  );
}
