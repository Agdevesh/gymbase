import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/server/tenant";
import { updateMember } from "@/server/members";
import { AppShell } from "@/components/ui";
import { MemberForm } from "@/components/member-form";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { gymId } = await requireTenant("members:write");
  const { id } = await params;
  const member = await db.member.findFirst({ where: { id, gymId } });
  if (!member) notFound();
  const action = updateMember.bind(null, member.id);
  return (
    <AppShell title={`Edit ${member.firstName}`} back={{ href: `/members/${member.id}`, label: "Profile" }}>
      <MemberForm action={action} initial={member} cancelHref={`/members/${member.id}`} />
    </AppShell>
  );
}
