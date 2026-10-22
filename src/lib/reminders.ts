import { z } from "zod";

export const REMINDER_TYPES = ["RENEWAL", "DUES", "BIRTHDAY", "LEAD_FOLLOWUP", "PT_SESSION"] as const;
export type ReminderTypeKey = (typeof REMINDER_TYPES)[number];
export const CHANNELS = ["WHATSAPP", "SMS", "EMAIL"] as const;
export type ChannelKey = (typeof CHANNELS)[number];

export const TYPE_LABELS: Record<ReminderTypeKey | "CUSTOM", string> = { RENEWAL: "Renewal", DUES: "Dues", BIRTHDAY: "Birthday", LEAD_FOLLOWUP: "Lead follow-up", PT_SESSION: "PT session", CUSTOM: "Custom" };
export const CHANNEL_LABELS: Record<ChannelKey, string> = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" };

// Placeholders: {name} {gym} {plan} {endDate} {amount} {days} {time} {trainer}
export const RULE_DEFAULTS: Record<ReminderTypeKey, { channel: ChannelKey; daysBefore: number; template: string; help: string }> = {
  RENEWAL: { channel: "WHATSAPP", daysBefore: 3, template: "Hi {name}, your {plan} plan at {gym} ends on {endDate}. Renew before it expires to keep your access. Reply here or visit reception.", help: "Days before the plan ends" },
  DUES: { channel: "WHATSAPP", daysBefore: 3, template: "Hi {name}, {amount} is pending at {gym} for {days} days. Please clear it at reception or by UPI. Thank you!", help: "Days after the due date, repeated every N days" },
  BIRTHDAY: { channel: "WHATSAPP", daysBefore: 0, template: "Happy birthday {name}! 🎂 Team {gym} wishes you a strong year ahead. Treat yourself to a great workout today.", help: "Sent on the day" },
  LEAD_FOLLOWUP: { channel: "WHATSAPP", daysBefore: 0, template: "Hi {name}, this is {gym}. Following up on your inquiry about {plan}. Want to come in for a free trial this week?", help: "Sent on the follow-up date" },
  PT_SESSION: { channel: "WHATSAPP", daysBefore: 1, template: "Hi {name}, reminder: your PT session with {trainer} at {gym} is on {endDate} at {time}. See you there!", help: "Days before the session (0 = same morning)" },
};

export const ruleInput = z.object({
  channel: z.enum(CHANNELS),
  enabled: z.string().optional().transform((v) => v === "on"),
  daysBefore: z.coerce.number().int().min(0).max(60),
  template: z.string().trim().min(1, "Template is empty").max(1000),
});

export const customInput = z.object({
  channel: z.enum(CHANNELS),
  body: z.string().trim().min(1, "Message is empty").max(1000),
});

export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] ?? "").toString());
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dedupeKey = (type: string, targetId: string, day: Date) => `${type}:${targetId}:${dayKey(day)}`;

export const isBirthdayToday = (dob: Date | null, now: Date) => !!dob && dob.getUTCMonth() === now.getMonth() && dob.getUTCDate() === now.getDate();

// Reminders go out at 10:00 local time of the day they belong to.
export const sendTimeFor = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0, 0);

export const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fmtPaise = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

export const waLink = (phone: string, body: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}`;

export const statusFilter = z.enum(["PENDING", "SENT", "FAILED", "CANCELLED"]).catch("PENDING");
