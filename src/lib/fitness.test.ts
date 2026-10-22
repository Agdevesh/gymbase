import { describe, expect, it } from "vitest";
import { addMonths, bmi, bmiLabel, lockerRangeInput, measurementInput, trend } from "./fitness";

describe("fitness", () => {
  it("computes BMI", () => { expect(bmi(70, 175)).toBe(22.9); expect(bmiLabel(22.9)).toBe("Normal"); expect(bmi(null, 175)).toBeNull(); });
  it("requires at least one measurement", () => {
    const base = { at: "2026-10-22", weightKg: "", heightCm: "", bodyFatPct: "", chestCm: "", waistCm: "", hipsCm: "", armCm: "", thighCm: "", notes: "" };
    expect(measurementInput.safeParse(base).success).toBe(false);
    expect(measurementInput.safeParse({ ...base, weightKg: "72.55" }).data?.weightKg).toBe(72.6);
  });
  it("finds trends across gaps", () => {
    const rows = [{ weightKg: 70 }, { weightKg: null }, { weightKg: 72 }].map((r) => ({ weightKg: r.weightKg, heightCm: null, bodyFatPct: null, chestCm: null, waistCm: null, hipsCm: null, armCm: null, thighCm: null }));
    expect(trend(rows, "weightKg")).toEqual({ latest: 70, delta: -2 });
    expect(trend(rows, "waistCm")).toBeNull();
  });
  it("limits locker ranges", () => {
    expect(lockerRangeInput.safeParse({ from: "1", to: "20", feePaise: "200" }).data).toEqual({ from: 1, to: 20, feePaise: 20000 });
    expect(lockerRangeInput.safeParse({ from: "10", to: "5", feePaise: "" }).success).toBe(false);
  });
  it("adds months", () => expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).getMonth()).toBe(2));
});
