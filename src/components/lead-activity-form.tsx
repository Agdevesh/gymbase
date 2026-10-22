"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/server/members";
import { logActivity } from "@/server/leads";
import { LEAD_STATUSES, STATUS_LABELS, toLocalInput } from "@/lib/leads";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(11, 0, 0, 0); return toLocalInput(d); };

export function LeadActivityForm({ leadId, status }: { leadId: string; status: string }) {
  const [state, action, pending] = useActionState(logActivity.bind(null, leadId), undefined);
  const [stage, setStage] = useState(status);
  const [follow, setFollow] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && !state.errors && !state.message) { ref.current?.reset(); setFollow(""); } }, [state]);
  const err = state?.errors?.note ?? state?.errors?.status ?? state?.message;
  return (
    <form ref={ref} action={action} className="space-y-2">
      <textarea name="note" rows={2} placeholder="What happened? (Ctrl+Enter to save)" className={inputClass}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }} />
      <div className="grid gap-2 sm:grid-cols-3">
        <select name="status" value={stage} onChange={(e) => setStage(e.target.value)} className={inputClass} aria-label="Stage">
          {LEAD_STATUSES.filter((s) => s !== "CONVERTED").map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {stage === "LOST" ? <input name="lostReason" placeholder="Why lost?" className={inputClass} /> : (
          <input name="followUpAt" type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} className={inputClass} aria-label="Next follow-up" />
        )}
        <div className="flex gap-1 text-xs">
          {stage !== "LOST" && [1, 2, 7].map((n) => <button key={n} type="button" onClick={() => setFollow(inDays(n))} className={`${secondaryButtonClass} px-2 py-1 text-xs`}>+{n}d</button>)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Log follow-up"}</button>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </form>
  );
}
