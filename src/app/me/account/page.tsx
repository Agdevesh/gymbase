import { changePin } from "@/server/portal";
import { requireMember } from "@/server/portal";
import { MemberShell } from "@/components/member-shell";
import { PasswordForm } from "@/components/settings-forms";

export default async function PortalAccount() {
  const { member: m, gym } = await requireMember();
  return (
    <MemberShell gymName={gym.name} title="Account">
      <section className="rounded-lg border bg-white p-4 text-sm"><div className="font-medium">{[m.firstName, m.lastName].filter(Boolean).join(" ")}</div><div className="text-neutral-500">{m.phone} · {m.code}{m.email && ` · ${m.email}`}</div><p className="mt-2 text-xs text-neutral-500">To change your phone or details, ask reception.</p></section>
      <section className="mt-3 rounded-lg border bg-white p-4"><h2 className="mb-2 font-medium">Change PIN</h2><PasswordForm action={changePin} needsCurrent submitLabel="Change PIN" minLength={4} /></section>
    </MemberShell>
  );
}
