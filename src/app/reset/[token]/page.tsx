import { db } from "@/lib/db";
import { completeReset } from "@/server/settings";
import { PasswordForm } from "@/components/settings-forms";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await db.passwordReset.findUnique({ where: { token }, include: { user: { select: { name: true, email: true, gym: { select: { name: true } } } } } });
  const valid = reset && !reset.usedAt && reset.expiresAt > new Date();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Set a new password</h1>
      {valid ? <><p className="mb-4 text-sm text-neutral-500">{reset.user.name} · {reset.user.email} · {reset.user.gym.name}</p><PasswordForm action={completeReset.bind(null, token)} needsCurrent={false} submitLabel="Set password" /></> : <p className="rounded bg-red-50 p-3 text-sm text-red-700">This reset link is invalid or has expired. <a href="/forgot" className="underline">Request a new one</a>.</p>}
    </main>
  );
}
