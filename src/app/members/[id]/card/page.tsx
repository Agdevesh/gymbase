import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { qrPayload } from "@/lib/checkin";
import { requireTenant } from "@/server/tenant";
import { ButtonLink } from "@/components/ui";

// Printable membership card with the member's QR. Reception prints it or the member saves a screenshot.
export default async function MemberCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId } = await requireTenant("members:read");
  const { id } = await params;
  const [m, gym] = await Promise.all([
    db.member.findFirst({ where: { id, gymId }, select: { firstName: true, lastName: true, code: true, qrToken: true, phone: true } }),
    db.gym.findUniqueOrThrow({ where: { id: gymId }, select: { name: true } }),
  ]);
  if (!m) notFound();
  const svg = await QRCode.toString(qrPayload(m.qrToken), { type: "svg", margin: 1, width: 240 });
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  return (
    <main className="mx-auto max-w-sm p-4 text-center">
      <div className="rounded-xl border bg-white p-6 shadow-sm print:shadow-none">
        <p className="text-sm uppercase tracking-wide text-neutral-500">{gym.name}</p>
        <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
        <p className="font-mono text-neutral-500">{m.code}</p>
        <div className="mx-auto mt-4 w-60" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-2 text-xs text-neutral-500">Show this at reception to check in</p>
      </div>
      <div className="mt-4 flex justify-center gap-2 print:hidden">
        <ButtonLink href={`/members/${id}`} secondary>Back</ButtonLink>
        <a href="#" className="inline-flex items-center rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white" data-print>Print</a>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `document.querySelector('[data-print]').onclick=function(e){e.preventDefault();window.print()}` }} />
    </main>
  );
}
