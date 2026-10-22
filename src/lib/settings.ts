import { z } from "zod";

const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").or(z.literal("")).transform((v) => v || null);
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);

export const settingsInput = z.object({
  name: z.string().trim().min(2, "Gym name is required").max(80),
  phone: opt(20),
  whatsapp: opt(20),
  email: z.string().trim().toLowerCase().max(120).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Enter a valid email").transform((v) => v || null),
  address: opt(300),
  gstin: z.string().trim().toUpperCase().max(15).refine((v) => !v || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), "GSTIN is 15 characters").transform((v) => v || null),
  gstPercent: z.coerce.number().int().min(0).max(28),
  upiId: z.string().trim().max(60).refine((v) => !v || /^[\w.\-]+@[\w]+$/.test(v), "Looks like name@bank").transform((v) => v || null),
  receiptNote: opt(300),
  openTime: time,
  closeTime: time,
  weeklyOff: opt(20),
  autoSuspendEnabled: z.string().transform((v) => v === "on"),
  autoSuspendDays: z.coerce.number().int().min(1, "At least 1 day").max(90, "At most 90 days"),
  holidays: z.string().transform((v) => v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 100)),
});
export type SettingsInput = z.infer<typeof settingsInput>;
export const settingsFields = Object.keys(settingsInput.shape) as (keyof SettingsInput)[];

// UPI deep link; every Indian UPI app opens it. Amount is optional so the link also works for "pay anything".
export function upiLink(upiId: string, payee: string, amountPaise?: number, note?: string) {
  const q = new URLSearchParams({ pa: upiId, pn: payee.slice(0, 50), cu: "INR" });
  if (amountPaise && amountPaise > 0) q.set("am", (amountPaise / 100).toFixed(2));
  if (note) q.set("tn", note.slice(0, 50));
  return `upi://pay?${q.toString()}`;
}

// Holiday lines are "YYYY-MM-DD optional label"; returns today's label or null.
export function holidayOn(holidays: string[], day: string) {
  const line = holidays.find((h) => h.startsWith(day));
  return line ? line.slice(10).trim() || "Holiday" : null;
}

export const passwordInput = z.object({
  password: z.string().min(8, "At least 8 characters").max(100),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const changePasswordInput = z.object({ current: z.string().min(1, "Enter your current password") }).and(passwordInput);

// CSV with Excel-friendly quoting; values with commas, quotes or newlines are quoted.
export function toCsv(headers: string[], rows: (string | number | null | undefined | Date)[][]) {
  const cell = (v: string | number | null | undefined | Date) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
