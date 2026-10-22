import { z } from "zod";
import { normalizePhone } from "@/lib/members";

export const STAFF_ROLES = ["RECEPTION", "TRAINER", "OWNER"] as const;
export const ROLE_LABELS: Record<string, string> = { OWNER: "Owner", RECEPTION: "Reception", TRAINER: "Trainer", MEMBER: "Member" };

export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["RECEPTION", "TRAINER"]),
});

export const acceptInput = z.object({
  name: z.string().trim().min(1, "Your name is required").max(80),
  phone: z.string().transform((v, ctx) => { if (!v.trim()) return null; const p = normalizePhone(v); if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid phone" }); return p; }),
  password: z.string().min(8, "At least 8 characters").max(100),
});

const rupees = z.string().transform((v, ctx) => {
  if (!v.trim()) return 0;
  const n = Number(v.replace(/[,\s₹]/g, ""));
  if (!Number.isFinite(n) || n < 0) { ctx.addIssue({ code: "custom", message: "Enter an amount in rupees" }); return 0; }
  return Math.round(n * 100);
});

export const ptAssignInput = z.object({
  trainerId: z.string().min(1, "Choose a trainer"),
  sessionsTotal: z.coerce.number().int("Whole sessions").min(1, "At least 1 session").max(500),
  feePaise: rupees,
  membershipId: z.string().optional().transform((v) => v || null),
  startDate: z.iso.date("Enter a valid date").transform((d) => new Date(`${d}T00:00:00Z`)),
});

export const commissionInput = z.object({
  userId: z.string().min(1, "Choose a staff member"),
  amountPaise: rupees.refine((n) => n > 0, "Enter an amount"),
  reason: z.string().trim().min(1, "Give a reason").max(120),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period like 2026-10"),
});

export const percentInput = z.coerce.number().int().min(0).max(100);

export const periodOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const commissionFor = (feePaise: number, percent: number) => Math.round((feePaise * percent) / 100);
export const sessionsLeft = (a: { sessionsTotal: number; sessionsUsed: number }) => Math.max(0, a.sessionsTotal - a.sessionsUsed);

export const localDay = (now: Date) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
export const hoursBetween = (a: Date, b: Date) => Math.round(((b.getTime() - a.getTime()) / 3600_000) * 10) / 10;
