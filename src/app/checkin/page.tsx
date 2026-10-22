import Link from "next/link";
import { db } from "@/lib/db";
import { inGymSince } from "@/lib/checkin";
import { requireTenant } from "@/server/tenant";
import { checkOut } from "@/server/checkin";
import { AppShell, Avatar } from "@/components/ui";
import { CheckinDesk } from "@/components/checkin-desk";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const { gymId } = await requireTenant("checkin:write");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [inGym, todayCount] = await Promise.all([
    db.checkIn.findMany({
      where: { gymId, checkedOutAt: null, checkedInAt: { gte: inGymSince(now) } },
      orderBy: { checkedInAt: "desc" },
      include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true, code: true } } },
    }),
    db.checkIn.count({ where: { gymId, checkedInAt: { gte: todayStart } } }),
  ]);
  return (
    <AppShell title="Check-in" actions={<span className="text-sm text-neutral-500">{todayCount} today</span>}>
      <section className="rounded border bg-white p-4"><CheckinDesk /></section>
      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="mb-2 flex items-center justify-between font-medium">In gym now <span className="rounded-full bg-green-100 px-3 py-0.5 text-lg text-green-800">{inGym.length}</span></h2>
        {inGym.length === 0 ? <p className="text-sm text-neutral-500">Nobody checked in right now.</p> : (
          <ul className="divide-y">
            {inGym.map((c) => {
              const name = [c.member.firstName, c.member.lastName].filter(Boolean).join(" ");
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <Avatar name={name} photoUrl={c.member.photoUrl} size={32} />
                  <Link href={`/members/${c.member.id}`} className="flex-1 truncate">{name} <span className="text-neutral-400">{c.member.code}</span></Link>
                  <span className="text-sm text-neutral-500">{c.checkedInAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <form action={checkOut.bind(null, c.id)}><button className="rounded border px-2 py-1 text-sm hover:bg-neutral-100">Check out</button></form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
