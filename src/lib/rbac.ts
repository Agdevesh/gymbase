import type { Role } from "@prisma/client";

// Permissions are coarse on purpose; modules add finer checks where they need them.
export type Permission =
  | "gym:manage"
  | "staff:manage"
  | "members:write"
  | "members:read"
  | "checkin:write"
  | "leads:write"
  | "payments:write"
  | "payments:refund"
  | "reports:read";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [
    "gym:manage",
    "staff:manage",
    "members:write",
    "members:read",
    "checkin:write",
    "leads:write",
    "payments:write",
    "payments:refund",
    "reports:read",
  ],
  RECEPTION: ["members:write", "members:read", "checkin:write", "leads:write", "payments:write"],
  TRAINER: ["members:read", "checkin:write"],
  MEMBER: [],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
