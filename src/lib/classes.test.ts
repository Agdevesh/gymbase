import { describe, expect, it } from "vitest";
import { classInput, fmtTime, occurrences, runsOn, seatsLeft } from "./classes";

describe("classes", () => {
  it("validates a class", () => {
    expect(classInput.safeParse({ name: "Zumba", trainerId: "", weekdays: ["1", "3"], startTime: "07:00", durationMin: "45", capacity: "20", notes: "", active: "on" }).data).toMatchObject({ weekdays: [1, 3], trainerId: null, active: true });
    expect(classInput.safeParse({ name: "Zumba", trainerId: "", weekdays: [], startTime: "7", durationMin: "45", capacity: "20", notes: "", active: "on" }).success).toBe(false);
  });
  it("expands weekly classes into dated sessions", () => {
    const cls = [{ id: "a", weekdays: [1, 3], startTime: "07:00", durationMin: 60 }, { id: "b", weekdays: [1], startTime: "06:00", durationMin: 60 }];
    const occ = occurrences(cls, new Date("2026-10-19T15:00:00"), 3); // Mon..Wed
    expect(occ.map((o) => `${o.cls.id}@${o.dayKey}`)).toEqual(["b@2026-10-19", "a@2026-10-19", "a@2026-10-21"]);
    expect(runsOn(cls[0], "2026-10-20")).toBe(false);
  });
  it("formats time and seats", () => { expect(fmtTime("07:30")).toBe("7:30 am"); expect(fmtTime("18:00")).toBe("6 pm"); expect(seatsLeft(10, 12)).toBe(0); });
});
