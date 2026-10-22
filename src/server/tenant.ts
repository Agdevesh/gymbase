import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
  }
}

// Every server action and page starts here, so gymId can never be forgotten.
export async function requireTenant(permission?: Permission) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id: userId, gymId, role } = session.user;
  if (permission && !can(role, permission)) throw new ForbiddenError(permission);
  return { userId, gymId, role };
}
