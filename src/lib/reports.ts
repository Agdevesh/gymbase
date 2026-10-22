import { z } from "zod";
import { PAYMENT_METHODS, rupees } from "@/lib/payments";

export const EXPENSE_CATEGORIES = ["RENT", "SALARY", "ELECTRICITY", "EQUIPMENT", "MAINTENANCE", "MARKETING", "SUPPLIES", "OTHER"] as const;
export const CATEGORY_LABELS: Record<(typeof EXPENSE_CATEGORIES)[number], string> = { RENT: "Rent", SALARY: "Salaries", ELECTRICITY: "Electricity & water", EQUIPMENT: "Equipment", MAINTENANCE: "Maintenance & repairs", MARKETING: "Marketing", SUPPLIES: "Supplies & supplements", OTHER: "Other" };

export const expenseInput = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amountPaise: rupees,
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").transform((v) => new Date(`${v}T12:00:00`)),
  method: z.enum(PAYMENT_METHODS),
  vendor: z.string().trim().max(80).transform((v) => v || null),
  notes: z.string().trim().max(300).transform((v) => v || null),
});

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export function monthRange(key: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  const y = m ? Number(m[1]) : new Date().getFullYear(), mo = m ? Number(m[2]) - 1 : new Date().getMonth();
  const start = new Date(y, mo, 1), end = new Date(y, mo + 1, 1);
  return { start, end, key: monthKey(start), label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), prev: monthKey(new Date(y, mo - 1, 1)), next: monthKey(end) };
}

export function sumBy<T, K extends string>(rows: T[], key: (r: T) => K, amount: (r: T) => number) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + amount(r);
  return Object.entries(out).sort((a, b) => b[1] - a[1]) as [K, number][];
}

// Visits per hour of day (0-23) and per weekday (0-6) for peak-hour planning.
export function visitHistogram(times: Date[]) {
  const hours = Array.from({ length: 24 }, () => 0), days = Array.from({ length: 7 }, () => 0);
  for (const t of times) { hours[t.getHours()]++; days[t.getDay()]++; }
  return { hours, days };
}

// Of the memberships that ended in the period, how many were renewed (chained via renewedTo).
export function renewalRate(ended: { renewed: boolean }[]) {
  if (!ended.length) return null;
  return Math.round((ended.filter((e) => e.renewed).length / ended.length) * 100);
}

export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
