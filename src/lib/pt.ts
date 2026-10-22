import { z } from "zod";

export const slotInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time"),
  durationMin: z.coerce.number().int().min(15).max(180),
  repeatWeeks: z.coerce.number().int().min(1).max(12).catch(1),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
});
export type SlotInput = z.infer<typeof slotInput>;

export const slotStart = (date: string, time: string) => new Date(`${date}T${time}:00`);
const DAY = 86400_000;

// Expands one booking into dated slots: the chosen date, then the same time on the chosen weekdays for N weeks.
export function expandSlots(input: SlotInput) {
  const first = slotStart(input.date, input.time);
  const days = new Set(input.weekdays.length ? input.weekdays : [first.getDay()]);
  const out: Date[] = [];
  for (let i = 0; i < input.repeatWeeks * 7; i++) {
    const d = new Date(first.getTime() + i * DAY);
    if (i === 0 || days.has(d.getDay())) out.push(d);
  }
  return out;
}

export const overlaps = (aStart: Date, aMin: number, bStart: Date, bMin: number) => aStart < new Date(bStart.getTime() + bMin * 60_000) && bStart < new Date(aStart.getTime() + aMin * 60_000);

export const fmtSlot = (d: Date) => d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtTimeOnly = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
