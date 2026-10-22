import type { Role } from "@prisma/client";
import { can, type Permission } from "@/lib/rbac";
import type { IconName } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: IconName; permission?: Permission; roles?: Role[] };
export type NavGroup = { label: string; items: NavItem[] };

// One place that knows every screen; the sidebar, drawer and bottom tabs all read from it.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/members", label: "Members", icon: "members", permission: "members:read" },
      { href: "/leads", label: "Inquiries", icon: "leads", permission: "leads:write" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/payments", label: "Payments", icon: "payments", permission: "payments:write" },
      { href: "/defaulters", label: "Dues", icon: "defaulters", permission: "payments:write" },
      { href: "/payments/upi", label: "UPI desk", icon: "upi", permission: "payments:write" },
      { href: "/expenses", label: "Expenses", icon: "expenses", permission: "payments:write" },
      { href: "/reports", label: "Reports", icon: "reports", permission: "reports:read" },
    ],
  },
  {
    label: "Gym",
    items: [
      { href: "/plans", label: "Plans", icon: "plans", permission: "members:read" },
      { href: "/classes", label: "Classes", icon: "classes" },
      { href: "/staff", label: "Staff & PT", icon: "staff" },
      { href: "/lockers", label: "Lockers", icon: "lockers", permission: "members:read" },
      { href: "/reminders", label: "Reminders", icon: "reminders", permission: "members:write" },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/settings", label: "Settings", icon: "settings", permission: "gym:manage" },
      { href: "/billing", label: "GYMBASE plan", icon: "billing", permission: "gym:manage" },
      { href: "/account", label: "My account", icon: "account" },
      { href: "/install", label: "Get the app", icon: "app" },
    ],
  },
];

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => (!i.permission || can(role, i.permission)) && (!i.roles || i.roles.includes(role))) })).filter((g) => g.items.length > 0);
}

// Bottom tab bar on phones: four most-used screens + "More".
export const TAB_HREFS = ["/dashboard", "/members", "/payments", "/defaulters"];

// Longest matching href wins, so /payments/upi highlights "UPI desk" and not "Payments".
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const h of hrefs) if ((pathname === h || pathname.startsWith(h + "/")) && (!best || h.length > best.length)) best = h;
  return best;
}
