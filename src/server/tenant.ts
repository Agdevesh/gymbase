import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { WRITE_PERMISSIONS, subscriptionState } from "@/lib/saas";

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
  }
}

// Every server action and page starts here, so gymId can never be forgotten.
export async function requireTenant(permission?: Permission, opts: { skipSubscriptionCheck?: boolean } = {}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id: userId, gymId, role } = session.user;
  // Member logins only ever see the portal.
  if (role === "MEMBER") redirect("/me");
  // Staff who open a screen outside their role land on the dashboard with a notice instead of an error page.
  if (permission && !can(role, permission)) redirect(`/dashboard?denied=${permission}`);
  // A gym whose GYMBASE trial or subscription has lapsed can still read everything, but every write goes to /billing.
  if (permission && WRITE_PERMISSIONS.has(permission) && !opts.skipSubscriptionCheck) {
    const sub = await db.subscription.findUnique({ where: { gymId }, select: { status: true, trialEndsAt: true, renewsAt: true, cancelAtPeriodEnd: true } });
    if (subscriptionState(sub, new Date()).locked) redirect("/billing?locked=1");
  }
  return { userId, gymId, role };
}

// Member cap from the gym's GYMBASE plan; returns an error message when adding one more would exceed it.
export async function memberLimitError(gymId: string): Promise<string | null> {
  const [sub, count] = await Promise.all([db.subscription.findUnique({ where: { gymId }, select: { memberLimit: true } }), db.member.count({ where: { gymId } })]);
  return sub && count >= sub.memberLimit ? `Your GYMBASE plan allows ${sub.memberLimit} members. Upgrade under GYMBASE plan to add more.` : null;
}
