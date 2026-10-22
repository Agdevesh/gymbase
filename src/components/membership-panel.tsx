"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/server/members";
import { assignPlan, cancelMembership, freezeMembership, unfreezeMembership } from "@/server/memberships";
import { paise, toDateInput } from "@/lib/memberships";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export type PlanOption = { id: string; name: string; pricePaise: number; durationDays: number };
export type CurrentMembership = { id: string; status: "ACTIVE" | "FROZEN"; endDate: Date; planName: string; credit: number } | null;

function AssignForm({ memberId, plans, mode, defaultStart, credit, onClose }: { memberId: string; plans: PlanOption[]; mode: "new" | "upgrade"; defaultStart: Date; credit: number; onClose: () => void }) {
  const [state, action, pending] = useActionState(assignPlan.bind(null, memberId, mode), undefined);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="mt-3 space-y-3 rounded border bg-neutral-50 p-3">
      {state?.message && <p className="text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Plan" error={e.planId}>
          <select name="planId" value={planId} onChange={(ev) => setPlanId(ev.target.value)} autoFocus className={inputClass}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {paise(p.pricePaise)} · {p.durationDays}d</option>)}
          </select>
        </Field>
        {mode === "new" ? (
          <Field label="Start date" error={e.startDate} hint="Renewals start when the current plan ends"><input name="startDate" type="date" defaultValue={toDateInput(defaultStart)} required className={inputClass} /></Field>
        ) : <input type="hidden" name="startDate" value={toDateInput(new Date())} />}
        <Field label="Extra discount (₹)" error={e.discountPaise} hint={mode === "upgrade" ? `Pro-rata credit ${paise(credit)} is applied automatically` : undefined}><input name="discountPaise" inputMode="decimal" placeholder="0" className={inputClass} /></Field>
      </div>
      {plan && <p className="text-sm text-neutral-600">Invoice: {paise(Math.max(0, plan.pricePaise - (mode === "upgrade" ? credit : 0)))} before GST and extra discount.</p>}
      <div className="flex gap-2">
        <button disabled={pending || !plan} className={buttonClass}>{pending ? "Saving…" : mode === "upgrade" ? "Upgrade" : "Start plan"}</button>
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
      </div>
    </form>
  );
}

export function MembershipPanel({ memberId, plans, current, renewFrom }: { memberId: string; plans: PlanOption[]; current: CurrentMembership; renewFrom: Date }) {
  const [open, setOpen] = useState<"new" | "upgrade" | "cancel" | null>(null);
  const close = () => setOpen(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {plans.length === 0 && <p className="text-sm text-neutral-500">No active plans. Create one under Plans first.</p>}
        {plans.length > 0 && (!current || current.status === "ACTIVE") && <button onClick={() => setOpen(open === "new" ? null : "new")} className={buttonClass}>{current ? "Renew" : "Start plan"}</button>}
        {current?.status === "ACTIVE" && plans.length > 0 && <button onClick={() => setOpen(open === "upgrade" ? null : "upgrade")} className={secondaryButtonClass}>Upgrade / change</button>}
        {current?.status === "ACTIVE" && <form action={freezeMembership.bind(null, memberId, current.id)}><button className={secondaryButtonClass}>Freeze</button></form>}
        {current?.status === "FROZEN" && <form action={unfreezeMembership.bind(null, memberId, current.id)}><button className={buttonClass}>Unfreeze</button></form>}
        {current && <button onClick={() => setOpen(open === "cancel" ? null : "cancel")} className={`${secondaryButtonClass} text-red-700`}>Cancel plan</button>}
      </div>
      {(open === "new" || open === "upgrade") && <AssignForm key={open} memberId={memberId} plans={plans} mode={open} defaultStart={renewFrom} credit={current?.credit ?? 0} onClose={close} />}
      {open === "cancel" && current && (
        <form action={cancelMembership.bind(null, memberId, current.id)} className="mt-3 flex flex-col gap-2 rounded border bg-neutral-50 p-3 sm:flex-row">
          <input name="reason" placeholder="Reason (optional)" autoFocus className={inputClass} />
          <button className={`${buttonClass} bg-red-700 hover:bg-red-600`}>Confirm cancel</button>
          <button type="button" onClick={close} className={secondaryButtonClass}>Back</button>
        </form>
      )}
    </div>
  );
}
