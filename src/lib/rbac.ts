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
  | "reports:read"
  | "fitness:write";

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
    "fitness:write",
  ],
  RECEPTION: ["members:write", "members:read", "checkin:write", "leads:write", "payments:write", "fitness:write"],
  TRAINER: ["members:read", "checkin:write", "fitness:write"],
  MEMBER: [],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
