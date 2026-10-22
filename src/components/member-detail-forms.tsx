"use client";

import { useActionState, useEffect, useRef } from "react";
import { addDocument, addNote, type FormState } from "@/server/members";
import { buttonClass, inputClass } from "@/components/ui";

function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.errors && !state.message) ref.current?.reset();
  }, [state]);
  return ref;
}

export function NoteForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(addNote.bind(null, memberId), undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2 sm:flex-row">
      <textarea name="body" rows={2} placeholder="Add a note (Ctrl+Enter to save)" required className={inputClass}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }} />
      <button disabled={pending} className={`${buttonClass} self-start`}>{pending ? "Saving…" : "Add note"}</button>
      {(state?.errors?.body || state?.message) && <p className="text-xs text-red-600">{state.errors?.body ?? state.message}</p>}
    </form>
  );
}

export function DocumentForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(addDocument.bind(null, memberId), undefined);
  const ref = useResetOnSuccess(state);
  const err = state?.errors?.label ?? state?.errors?.file ?? state?.message;
  return (
    <form ref={ref} action={action} encType="multipart/form-data" className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
      <input name="label" placeholder="Label (Aadhaar, medical cert…)" required className={inputClass} />
      <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="text-sm" />
      <button disabled={pending} className={`${buttonClass} shrink-0`}>{pending ? "Uploading…" : "Upload"}</button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </form>
  );
}
