import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/staff";
import { requireTenant } from "@/server/tenant";
import { changePassword } from "@/server/settings";
import { AppShell } from "@/components/ui";
import { PasswordForm } from "@/components/settings-forms";

export default async function AccountPage() {
  const { userId } = await requireTenant(undefined, { skipSubscriptionCheck: true });
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, role: true, gym: { select: { slug: true } } } });
  return (
    <AppShell title="My account">
      <section className="mb-4 rounded border bg-white p-4 text-sm"><div className="font-medium">{u.name}</div><div className="text-neutral-500">{u.email} · {ROLE_LABELS[u.role]} · gym code {u.gym.slug}</div></section>
      <section className="max-w-sm rounded border bg-white p-4"><h2 className="mb-3 font-medium">Change password</h2><PasswordForm action={changePassword} needsCurrent /></section>
    </AppShell>
  );
}
