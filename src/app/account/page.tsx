import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { changePassword } from "@/server/settings";
import { AppShell } from "@/components/app-shell";
import { PasswordForm } from "@/components/settings-forms";

export default async function AccountPage() {
  const { userId } = await requireTenant(undefined, { skipSubscriptionCheck: true });
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, role: true, gym: { select: { slug: true } } } });
  return (
    <AppShell title="My account">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm mb-4 p-4 text-sm"><div className="font-medium">{u.name}</div><div className="text-slate-500">{u.email} · {ROLE_LABELS[u.role]} · gym code {u.gym.slug}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm max-w-sm p-4"><h2 className="mb-3 font-semibold text-slate-900">Change password</h2><PasswordForm action={changePassword} needsCurrent /></section>
    </AppShell>
  );
}
