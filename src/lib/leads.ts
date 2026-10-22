import { z } from "zod";
import { normalizePhone } from "@/lib/members";

export const LEAD_SOURCES = ["WALK_IN", "PHONE", "WHATSAPP", "INSTAGRAM", "WEB", "REFERRAL", "SOCIAL", "OTHER"] as const;
export type LeadSourceKey = (typeof LEAD_SOURCES)[number];
export const SOURCE_LABELS: Record<LeadSourceKey, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", WEB: "Website", REFERRAL: "Referral", SOCIAL: "Other social", OTHER: "Other",
};

export const LEAD_STATUSES = ["NEW", "CONTACTED", "TRIAL", "NEGOTIATING", "CONVERTED", "LOST"] as const;
export type LeadStatusKey = (typeof LEAD_STATUSES)[number];
export const STATUS_LABELS: Record<LeadStatusKey, string> = {
  NEW: "New", CONTACTED: "Contacted", TRIAL: "Trial", NEGOTIATING: "Negotiating", CONVERTED: "Converted", LOST: "Lost",
};
export const OPEN_STATUSES: LeadStatusKey[] = ["NEW", "CONTACTED", "TRIAL", "NEGOTIATING"];

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const optionalDateTime = z.union([
  z.literal("").transform(() => null),
  z.string().transform((v, ctx) => { const d = new Date(v); if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", message: "Enter a valid date" }); return d; }),
]);

export const leadInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: z.string().transform((v, ctx) => { const p = normalizePhone(v); if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid phone number" }); return p ?? ""; }),
  email: z.union([z.literal("").transform(() => null), z.string().trim().toLowerCase().email("Enter a valid email")]),
  source: z.enum(LEAD_SOURCES),
  interestedIn: optionalText(80),
  followUpAt: optionalDateTime,
  notes: optionalText(2000),
});
export type LeadInput = z.infer<typeof leadInput>;
export const leadFields = Object.keys(leadInput.shape) as (keyof LeadInput)[];

// One form logs what happened, moves the stage and books the next follow-up.
export const activityInput = z.object({
  note: z.string().trim().max(2000),
  status: z.union([z.literal(""), z.enum(LEAD_STATUSES)]),
  followUpAt: optionalDateTime,
  lostReason: optionalText(200),
}).refine((v) => v.note || v.status || v.followUpAt, { message: "Add a note, change the stage or set a follow-up", path: ["note"] });

export const sourceFilter = z.enum(LEAD_SOURCES).optional().catch(undefined);
export const statusFilter = z.union([z.enum(LEAD_STATUSES), z.literal("OPEN"), z.literal("DUE")]).catch("OPEN");

export type FollowUpBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "NONE";
export function followUpBucket(at: Date | null, now: Date): FollowUpBucket {
  if (!at) return "NONE";
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (at < startOfToday) return "OVERDUE";
  if (at < endOfToday) return "TODAY";
  return "UPCOMING";
}

export function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

// datetime-local value in the gym's local clock (server runs in UTC on Vercel, so pass the tz offset explicitly).
export const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
