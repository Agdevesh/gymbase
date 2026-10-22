import { z } from "zod";

// A member who has not checked out is counted as "in gym" for this long, then the cron closes the visit.
export const IN_GYM_WINDOW_HOURS = 4;
export const STALE_VISIT_HOURS = 6;
export const DEFAULT_VISIT_MINUTES = 90;

export const isQrToken = (s: string) => /^[0-9a-f]{32}$/.test(s.trim());

export const qrPayload = (token: string) => `GB:${token}`;
export const tokenFromScan = (raw: string) => {
  const s = raw.trim();
  const m = /^(?:GB:|.*\/checkin\/scan\/)?([0-9a-f]{32})$/i.exec(s);
  return m ? m[1].toLowerCase() : null;
};

export type Gate = { allowed: true } | { allowed: false; reason: "NO_PLAN" | "EXPIRED" | "FROZEN" | "CANCELLED" };

// Reception sees this before the check-in is written; expired or frozen members are blocked.
export function entryGate(membership: { status: string; endDate: Date } | null | undefined, now: Date): Gate {
  if (!membership) return { allowed: false, reason: "NO_PLAN" };
  if (membership.status === "FROZEN") return { allowed: false, reason: "FROZEN" };
  if (membership.status === "CANCELLED") return { allowed: false, reason: "CANCELLED" };
  if (membership.status === "EXPIRED" || membership.endDate < now) return { allowed: false, reason: "EXPIRED" };
  return { allowed: true };
}

export const GATE_MESSAGES: Record<Exclude<Gate, { allowed: true }>["reason"], string> = {
  NO_PLAN: "No membership. Start a plan before check-in.",
  EXPIRED: "Membership expired. Renew to check in.",
  FROZEN: "Membership is frozen. Unfreeze to check in.",
  CANCELLED: "Membership cancelled. Start a new plan.",
};

export const inGymSince = (now: Date) => new Date(now.getTime() - IN_GYM_WINDOW_HOURS * 3600_000);

export const searchInput = z.string().trim().max(80);

export const dayRange = (dateStr: string | undefined, now: Date) => {
  const d = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: d, end: new Date(d.getTime() + 86400_000), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
};
