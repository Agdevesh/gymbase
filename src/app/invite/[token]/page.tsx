import { db } from "@/lib/db";
import { AcceptInviteForm } from "@/components/staff-forms";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.invite.findUnique({ where: { token }, include: { gym: { select: { name: true } } } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">Join GYMBASE</h1>
      {valid ? <AcceptInviteForm token={token} email={invite.email} gymName={invite.gym.name} /> : <p className="rounded bg-red-50 p-3 text-sm text-red-700">This invite link is invalid, used or expired. Ask the gym owner for a new one.</p>}
    </main>
  );
}
