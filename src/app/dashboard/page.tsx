import Link from "next/link";
import { db } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { requireTenant } from "@/server/tenant";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { gymId, role } = await requireTenant();
  const { denied } = await searchParams;
  const [gym, members, staff] = await Promise.all([
    db.gym.findUniqueOrThrow({ where: { id: gymId }, include: { subscription: true } }),
    db.member.count({ where: { gymId } }),
    db.user.count({ where: { gymId, role: { not: "MEMBER" } } }),
  ]);
  return (
    <main className="mx-auto max-w-3xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{gym.name}</h1>
          <p className="text-sm text-neutral-500">
            Signed in as {role.toLowerCase()} · plan {gym.subscription?.planCode} ({gym.subscription?.status.toLowerCase()})
          </p>
        </div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="rounded border px-3 py-1 text-sm">Sign out</button>
        </form>
      </header>
      {denied && <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-900">Your {role.toLowerCase()} login does not have access to that screen ({denied}). Ask the owner if you need it.</p>}
      <dl className="grid grid-cols-2 gap-4">
        <div className="rounded border bg-white p-4"><dt className="text-sm text-neutral-500">Members</dt><dd className="text-2xl font-semibold">{members}</dd></div>
        <div className="rounded border bg-white p-4"><dt className="text-sm text-neutral-500">Staff</dt><dd className="text-2xl font-semibold">{staff}</dd></div>
      </dl>
      <nav className="mt-6 flex gap-3 text-sm">
        <Link href="/members" className="rounded border bg-white px-3 py-2 hover:bg-neutral-100">Members →</Link>
      </nav>
    </main>
  );
}
