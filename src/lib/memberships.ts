import { z } from "zod";

export const DAY = 24 * 3600 * 1000;

export const PLAN_TYPES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "PT", "CUSTOM"] as const;
export const DEFAULT_DURATION: Record<(typeof PLAN_TYPES)[number], number> = {
  MONTHLY: 30, QUARTERLY: 90, HALF_YEARLY: 180, YEARLY: 365, PT: 30, CUSTOM: 30,
};

// Rupees typed by the owner ("1,500" or "1500.50") to integer paise.
const rupeesToPaise = z.string().transform((v, ctx) => {
  const n = Number(v.replace(/[,\s₹]/g, ""));
  if (!Number.isFinite(n) || n < 0) { ctx.addIssue({ code: "custom", message: "Enter an amount in rupees" }); return 0; }
  return Math.round(n * 100);
});

const isoDate = z.iso.date("Enter a valid date").transform((d) => new Date(`${d}T00:00:00Z`));

export const planInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.enum(PLAN_TYPES),
  durationDays: z.coerce.number().int("Whole days only").min(1, "At least 1 day").max(3660),
  pricePaise: rupeesToPaise,
  ptSessions: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(500)]),
  active: z.string().optional().transform((v) => v !== "off"),
});
export type PlanInput = z.infer<typeof planInput>;

export const assignInput = z.object({
  planId: z.string().min(1, "Choose a plan"),
  startDate: isoDate,
  discountPaise: z.union([z.literal("").transform(() => 0), rupeesToPaise]),
});

export const cancelInput = z.object({ reason: z.string().trim().max(200).transform((v) => v || null) });

export const endDateFor = (start: Date, durationDays: number) => new Date(start.getTime() + durationDays * DAY);

export const daysBetween = (a: Date, b: Date) => Math.max(0, Math.ceil((b.getTime() - a.getTime()) / DAY));

// A frozen membership keeps its remaining days; when it resumes, the end date moves by the frozen span.
export function unfreezeDates(m: { frozenAt: Date; endDate: Date; frozenDays: number }, now: Date) {
  const days = Math.max(1, daysBetween(m.frozenAt, now));
  return { endDate: new Date(m.endDate.getTime() + days * DAY), frozenDays: m.frozenDays + days };
}

// Unused value of a membership when the member upgrades mid-way, used as a discount on the new plan.
export function prorataCredit(m: { startDate: Date; endDate: Date; pricePaise: number; discountPaise: number }, now: Date) {
  const total = daysBetween(m.startDate, m.endDate);
  const remaining = Math.min(total, daysBetween(now, m.endDate));
  if (total === 0 || remaining <= 0) return 0;
  return Math.floor(((m.pricePaise - m.discountPaise) * remaining) / total);
}

export const gstOn = (subtotalPaise: number, percent: number) => Math.round((subtotalPaise * percent) / 100);

export const formatInvoiceNumber = (seq: number, year: number) => `INV-${year}-${String(seq).padStart(4, "0")}`;

// Renewals start when the current membership ends, or today if it has already lapsed.
export function renewalStart(current: { endDate: Date; status: string } | null | undefined, today: Date) {
  if (!current || current.status !== "ACTIVE") return today;
  return current.endDate > today ? current.endDate : today;
}

export const paise = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
