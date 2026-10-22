import { z } from "zod";

const num = (max: number) => z.string().trim().transform((v, ctx) => {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > max) { ctx.addIssue({ code: "custom", message: `Enter a number up to ${max}` }); return z.NEVER; }
  return Math.round(n * 10) / 10;
});

export const measurementInput = z.object({
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").transform((v) => new Date(`${v}T12:00:00`)),
  weightKg: num(400), heightCm: num(250), bodyFatPct: num(80), chestCm: num(250), waistCm: num(250), hipsCm: num(250), armCm: num(100), thighCm: num(150),
  notes: z.string().trim().max(300).transform((v) => v || null),
}).refine((m) => m.weightKg || m.heightCm || m.bodyFatPct || m.chestCm || m.waistCm || m.hipsCm || m.armCm || m.thighCm, { path: ["weightKg"], message: "Enter at least one measurement" });
export type MeasurementInput = z.infer<typeof measurementInput>;
export const MEASURE_FIELDS = [["weightKg", "Weight", "kg"], ["heightCm", "Height", "cm"], ["bodyFatPct", "Body fat", "%"], ["chestCm", "Chest", "cm"], ["waistCm", "Waist", "cm"], ["hipsCm", "Hips", "cm"], ["armCm", "Arm", "cm"], ["thighCm", "Thigh", "cm"]] as const;
export type MeasureKey = (typeof MEASURE_FIELDS)[number][0];

export const bmi = (weightKg: number | null | undefined, heightCm: number | null | undefined) => (weightKg && heightCm ? Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10 : null);
export const bmiLabel = (b: number) => (b < 18.5 ? "Underweight" : b < 25 ? "Normal" : b < 30 ? "Overweight" : "Obese");

// Latest value of a field, and the change since the previous reading that had it.
export function trend(rows: Record<MeasureKey, number | null>[], key: MeasureKey) {
  const have = rows.filter((r) => r[key] != null);
  if (!have.length) return null;
  const latest = have[0][key] as number, prev = have[1]?.[key] ?? null;
  return { latest, delta: prev == null ? null : Math.round((latest - prev) * 10) / 10 };
}

export const PLAN_TYPES = ["DIET", "WORKOUT"] as const;
export const planInput = z.object({
  type: z.enum(PLAN_TYPES),
  title: z.string().trim().min(1, "Give the plan a title").max(80),
  body: z.string().trim().min(1, "Write the plan").max(8000),
});

export const DIET_TEMPLATE = `Morning (7 am): warm water, 5 soaked almonds
Breakfast (9 am): 2 eggs / paneer bhurji + 2 roti or poha
Mid-morning (11 am): fruit + buttermilk
Lunch (1 pm): dal, sabzi, 2 roti or rice, salad, curd
Evening (5 pm): sprouts chaat / roasted chana + tea without sugar
Post-workout: whey or 200 ml milk + banana
Dinner (8.30 pm): grilled chicken / paneer + sabzi + 1 roti
Avoid: fried snacks, sweets, cold drinks. 3 litres water.`;
export const WORKOUT_TEMPLATE = `Mon: Chest + Triceps - bench press 4x10, incline DB press 3x12, pushdowns 3x15
Tue: Back + Biceps - lat pulldown 4x10, rows 3x12, curls 3x15
Wed: Legs - squats 4x10, leg press 3x12, lunges 3x12, calves 4x15
Thu: Shoulders + Abs - OHP 4x10, lateral raise 3x15, planks 3x45s
Fri: Cardio 30 min + core
Sat: Full body light / functional
Sun: Rest
Warm up 10 min before every session.`;

export const lockerRangeInput = z.object({
  from: z.coerce.number().int().min(1).max(9999),
  to: z.coerce.number().int().min(1).max(9999),
  feePaise: z.string().trim().transform((v) => Math.round(Number(v || 0) * 100)).refine((n) => n >= 0 && n <= 10_000_000, "Fee looks wrong"),
}).refine((r) => r.to >= r.from && r.to - r.from < 500, { path: ["to"], message: "Up to 500 lockers at a time" });

export const lockerAssignInput = z.object({
  memberId: z.string().min(1, "Pick a member"),
  months: z.coerce.number().int().min(1).max(24),
  feePaise: z.string().trim().transform((v) => Math.round(Number(v || 0) * 100)).refine((n) => n >= 0 && n <= 10_000_000, "Fee looks wrong"),
});
export const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
