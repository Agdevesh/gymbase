"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/server/members";
import { saveRule, sendCustom } from "@/server/reminders";
import { CHANNELS, CHANNEL_LABELS, type ReminderTypeKey } from "@/lib/reminders";
import { Field, buttonClass, inputClass } from "@/components/ui";

export function RuleForm({ type, rule, help, configured }: { type: ReminderTypeKey; rule: { channel: string; enabled: boolean; daysBefore: number; template: string }; help: string; configured: Record<string, boolean> }) {
  const [state, action, pending] = useActionState(saveRule.bind(null, type), undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" value="on" defaultChecked={rule.enabled} /> Enabled</label>
        <Field label="Channel"><select name="channel" defaultValue={rule.channel} className={inputClass}>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}{configured[c] ? "" : " (manual)"}</option>)}</select></Field>
        {type !== "BIRTHDAY" && type !== "LEAD_FOLLOWUP" && <Field label={help} error={e.daysBefore}><input name="daysBefore" type="number" min={0} max={60} defaultValue={rule.daysBefore} className={inputClass} /></Field>}
      </div>
      <Field label="Message" error={e.template} hint="Placeholders: {name} {gym} {plan} {endDate} {amount} {days}"><textarea name="template" rows={3} defaultValue={rule.template} className={inputClass} /></Field>
      <div className="flex items-center gap-3"><button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save"}</button>{state && !state.errors && <span className="text-sm text-green-700">Saved ✓</span>}</div>
    </form>
  );
}

export function CustomMessageForm({ memberId, hasEmail }: { memberId: string; hasEmail: boolean }) {
  const [state, action, pending] = useActionState(sendCustom.bind(null, memberId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && !state.errors && !state.message) ref.current?.reset(); }, [state]);
  const err = state?.errors?.body ?? state?.errors?.channel ?? state?.message;
  return (
    <form ref={ref} action={action} className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row">
      <select name="channel" defaultValue="WHATSAPP" className={`${inputClass} sm:w-36`} aria-label="Channel">{CHANNELS.filter((c) => c !== "EMAIL" || hasEmail).map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}</select>
      <input name="body" placeholder="Send a message to this member" className={inputClass} />
      <button disabled={pending} className={`${buttonClass} shrink-0`}>{pending ? "Sending…" : "Send"}</button>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {state && !state.errors && !state.message && <p className="text-xs text-green-700">Queued, see Reminders</p>}
    </form>
  );
}
