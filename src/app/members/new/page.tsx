import { requireTenant } from "@/server/tenant";
import { createMember } from "@/server/members";
import { AppShell } from "@/components/ui";
import { MemberForm } from "@/components/member-form";

export default async function NewMemberPage() {
  await requireTenant("members:write");
  return (
    <AppShell title="Add member" back={{ href: "/members", label: "Members" }}>
      <MemberForm action={createMember} cancelHref="/members" />
    </AppShell>
  );
}
