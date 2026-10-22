import { z } from "zod";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY = 86400_000;

export const classInput = z.object({
  name: z.string().trim().min(1, "Give the class a name").max(60),
  trainerId: z.string().transform((v) => v || null),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  durationMin: z.coerce.number().int().min(10).max(300),
  capacity: z.coerce.number().int().min(1).max(500),
  notes: z.string().trim().max(200).transform((v) => v || null),
  active: z.enum(["on", "off"]).transform((v) => v === "on"),
});
export type ClassInput = z.infer<typeof classInput>;

export type ClassLike = { id: string; weekdays: number[]; startTime: string; durationMin: number };
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const localDate = (key: string) => new Date(`${key}T00:00:00`);
// Postgres @db.Date columns compare as UTC midnight, so store the key as UTC.
export const dbDate = (key: string) => new Date(`${key}T00:00:00Z`);
export const startsAt = (dayKey: string, startTime: string) => new Date(`${dayKey}T${startTime}:00`);

// Every session of the given classes from `from` for `days` days, in time order.
export function occurrences<T extends ClassLike>(classes: T[], from: Date, days: number) {
  const out: { cls: T; dayKey: string; at: Date }[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY), key = dateKey(d);
    for (const cls of classes) if (cls.weekdays.includes(d.getDay())) out.push({ cls, dayKey: key, at: startsAt(key, cls.startTime) });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const runsOn = (cls: ClassLike, dayKey: string) => cls.weekdays.includes(localDate(dayKey).getDay());
export const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${ap}`; };
export const seatsLeft = (capacity: number, booked: number) => Math.max(0, capacity - booked);
export const BOOK_AHEAD_DAYS = 7;
