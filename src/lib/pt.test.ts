import { describe, expect, it } from "vitest";
import { expandSlots, overlaps, slotInput } from "./pt";

describe("pt slots", () => {
  it("expands a weekly booking", () => {
    const s = slotInput.parse({ date: "2026-10-19", time: "07:00", durationMin: "60", repeatWeeks: "2", weekdays: ["1", "3"] }); // Mon
    expect(expandSlots(s).map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"]);
    expect(expandSlots({ ...s, weekdays: [], repeatWeeks: 1 })).toHaveLength(1);
  });
  it("detects overlaps", () => {
    const a = new Date("2026-10-19T07:00:00");
    expect(overlaps(a, 60, new Date("2026-10-19T07:30:00"), 60)).toBe(true);
    expect(overlaps(a, 60, new Date("2026-10-19T08:00:00"), 60)).toBe(false);
  });
});
