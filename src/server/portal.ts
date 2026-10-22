"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberLoginEmail, newPin, pinMessage, waLink } from "@/lib/portal";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/tenant";
import type { FormState } from "@/server/members";
import { baseUrl } from "@/lib/base-url";

export type AccessState = (FormState & { pin?: string; wa?: string }) | undefined;

// Creates (or re-pins) the member's login. The PIN is shown once to reception, with a WhatsApp link to send it.
export async function enableMemberAccess(memberId: string): Promise<AccessState> {
  const { gymId, userId } = await requireTenant("members:write");
  const m = await db.member.findFirst({ where: { id: memberId, gymId }, include: { user: true, gym: { select: { name: true, slug: true } } } });
  if (!m) return { message: "Member not found" };
  const pin = newPin();
  const passwordHash = await hash(pin, 10);
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  if (m.user) await db.user.update({ where: { id: m.user.id }, data: { passwordHash, active: true, phone: m.phone } });
  else {
    const user = await db.user.create({ data: { gymId, email: memberLoginEmail(m.code, m.gym.slug), name, passwordHash, role: "MEMBER", phone: m.phone } });
    await db.member.update({ where: { id: m.id }, data: { userId: user.id } });
  }
  await audit(gymId, userId, m.user ? "member.pin_reset" : "member.access_enabled", "member", m.id, `${m.user ? "Reset PIN for" : "Enabled app login for"} ${name}`);
  revalidatePath(`/members/${memberId}`);
  return { pin, wa: waLink(m.phone, pinMessage(m.gym.name, m.firstName, m.gym.slug, m.phone, pin, baseUrl())) };
}

export async function disableMemberAccess(memberId: string) {
  const { gymId, userId } = await requireTenant("members:write");
  const m = await db.member.findFirst({ where: { id: memberId, gymId }, select: { userId: true, firstName: true } });
  if (!m?.userId) return;
  await db.user.update({ where: { id: m.userId }, data: { active: false } });
  await audit(gymId, userId, "member.access_disabled", "member", memberId, `Disabled app login for ${m.firstName}`);
  revalidatePath(`/members/${memberId}`);
}

// Portal pages start here: a staff login is sent to the dashboard, a member gets their own record.
export async function requireMember() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MEMBER") redirect("/dashboard");
  const member = await db.member.findUnique({ where: { userId: session.user.id }, include: { gym: true } });
  if (!member) redirect("/login");
  return { member, gym: member.gym, userId: session.user.id };
}

export async function changePin(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireMember();
  const current = String(formData.get("current") ?? ""), pin = String(formData.get("password") ?? ""), confirm = String(formData.get("confirm") ?? "");
  if (!/^\d{4,8}$/.test(pin)) return { errors: { password: "PIN must be 4 to 8 digits" } };
  if (pin !== confirm) return { errors: { confirm: "PINs do not match" } };
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await compare(current, user.passwordHash))) return { errors: { current: "Current PIN is wrong" } };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hash(pin, 10) } });
  return { message: "PIN changed." };
}
