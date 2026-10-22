import { describe, expect, it } from "vitest";
import { daysOverdue, dueBucket, duesReminderText, suspendCutoff } from "./dues";

const now = new Date(2026, 9, 22, 15, 0);
describe("dues", () => {
  it("buckets by due day, falling back to issue date", () => {
    expect(dueBucket({ dueDate: new Date(2026, 9, 22, 1), issuedAt: now }, now)).toBe("today");
    expect(dueBucket({ dueDate: new Date(2026, 9, 21), issuedAt: now }, now)).toBe("overdue");
    expect(dueBucket({ dueDate: null, issuedAt: new Date(2026, 9, 25) }, now)).toBe("upcoming");
  });
  it("counts whole days overdue", () => {
    expect(daysOverdue({ dueDate: new Date(2026, 9, 22), issuedAt: now }, now)).toBe(0);
    expect(daysOverdue({ dueDate: new Date(2026, 9, 7, 23), issuedAt: now }, now)).toBe(15);
  });
  it("cutoff is N days before today, so 14 days means the 15th day suspends", () => {
    const cutoff = suspendCutoff(now, 14);
    expect(cutoff).toEqual(new Date(2026, 9, 8));
    expect(new Date(2026, 9, 8, 10) < cutoff).toBe(false);
    expect(new Date(2026, 9, 7, 23) < cutoff).toBe(true);
  });
  it("writes a WhatsApp reminder with UPI id", () => {
    expect(duesReminderText("Arjun", "Iron Temple", 88500, 3, "iron@okaxis")).toContain("overdue by 3 days. Pay on UPI: iron@okaxis");
    expect(duesReminderText("Arjun", "Iron Temple", 88500, 0, null)).toContain("due today");
  });
});
