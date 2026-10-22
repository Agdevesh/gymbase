"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/server/members";
import { signupGym, startCheckout } from "@/server/saas";
import { slugify } from "@/lib/saas";
import { Field, buttonClass, inputClass } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupGym, undefined);
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      {state?.message && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{state.message}</p>}
      <Field label="Gym name" error={e.gymName}><input name="gymName" required autoFocus className={inputClass} onChange={(ev) => { if (!touched) setSlug(slugify(ev.target.value)); }} /></Field>
      <Field label="Gym code" error={e.slug} hint="Staff type this at login, e.g. iron-temple"><input name="slug" value={slug} onChange={(ev) => { setTouched(true); setSlug(ev.target.value); }} required className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name" error={e.ownerName}><input name="ownerName" required className={inputClass} /></Field>
        <Field label="Phone" error={e.phone}><input name="phone" type="tel" className={inputClass} /></Field>
      </div>
      <Field label="Email (your login)" error={e.email}><input name="email" type="email" required className={inputClass} /></Field>
      <Field label="Password" error={e.password} hint="At least 8 characters"><input name="password" type="password" required minLength={8} className={inputClass} /></Field>
      <button disabled={pending} className={`${buttonClass} w-full justify-center py-3`}>{pending ? "Creating your gym…" : "Start 14-day free trial"}</button>
      <p className="text-center text-xs text-slate-500">No card needed. Already have a gym? <a href="/login" className="font-medium text-brand-700 hover:underline">Sign in</a></p>
    </form>
  );
}

export function ChoosePlanButton({ code, label, current }: { code: string; label: string; current: boolean }) {
  const [state, action, pending] = useActionState(startCheckout.bind(null, code), undefined);
  return (
    <form action={action} className="mt-3">
      <button disabled={pending || current} className={`${current ? "cursor-default rounded border px-4 py-2 text-sm text-slate-500" : buttonClass} w-full justify-center`}>{current ? "Current plan" : pending ? "Opening checkout…" : label}</button>
      {state?.message && <p className="mt-2 text-xs text-amber-800">{state.message}</p>}
    </form>
  );
}
