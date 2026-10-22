import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkInByToken } from "@/server/checkin";
import { requireTenant } from "@/server/tenant";
import { AppShell } from "@/components/app-shell";
import { Avatar, ButtonLink, buttonClass } from "@/components/ui";

// Opened by scanning a member's QR with a logged-in phone. GET shows the member; the button records the visit.
export default async function ScanPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ r?: string }> }) {
  const { gymId } = await requireTenant("checkin:write");
  const { token } = await params;
  const { r } = await searchParams;
  const m = await db.member.findFirst({ where: { gymId, qrToken: token }, select: { id: true, firstName: true, lastName: true, photoUrl: true, code: true } });
  const name = m ? [m.firstName, m.lastName].filter(Boolean).join(" ") : "Unknown";
  async function act() {
    "use server";
    const res = await checkInByToken(token);
    redirect(`/checkin/scan/${token}?r=${encodeURIComponent(res.ok ? (res.already ? "already" : "ok") : res.message)}`);
  }
  return (
    <AppShell title="QR check-in" back={{ href: "/checkin", label: "Check-in desk" }}>
      <section className="rounded border bg-white p-6 text-center">
        {!m ? <p className="text-red-700">QR code not recognised for this gym.</p> : (
          <>
            <div className="flex justify-center"><Avatar name={name} photoUrl={m.photoUrl} size={96} /></div>
            <h2 className="mt-3 text-2xl font-semibold">{name}</h2>
            <p className="text-neutral-500">{m.code}</p>
            {r === "ok" && <p className="mt-4 rounded bg-green-100 p-3 text-lg text-green-900">✓ Checked in</p>}
            {r === "already" && <p className="mt-4 rounded bg-green-100 p-3 text-lg text-green-900">Already in the gym</p>}
            {r && r !== "ok" && r !== "already" && <p className="mt-4 rounded bg-red-100 p-3 text-lg text-red-900">✕ {r}</p>}
            {!r && <form action={act} className="mt-4"><button className={`${buttonClass} w-full justify-center py-3 text-lg`} autoFocus>Check in</button></form>}
            <div className="mt-4"><ButtonLink href={`/members/${m.id}`} secondary>Open profile</ButtonLink></div>
          </>
        )}
      </section>
    </AppShell>
  );
}
