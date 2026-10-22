import { describe, expect, it } from "vitest";
import { acceptInput, commissionFor, commissionInput, hoursBetween, periodOf, ptAssignInput, sessionsLeft } from "./staff";

describe("staff inputs", () => {
  it("accept needs an 8+ char password and optional phone", () => {
    expect(acceptInput.safeParse({ name: "Amit", phone: "", password: "short" }).success).toBe(false);
    expect(acceptInput.parse({ name: "Amit", phone: "98765 43210", password: "longenough" }).phone).toBe("+919876543210");
  });
  it("PT assignment converts fee to paise and allows no membership", () => {
    const r = ptAssignInput.parse({ trainerId: "t", sessionsTotal: "12", feePaise: "6,000", membershipId: "", startDate: "2026-10-22" });
    expect(r.feePaise).toBe(600000);
    expect(r.membershipId).toBeNull();
  });
  it("manual commission needs a positive amount and a period", () => {
    expect(commissionInput.safeParse({ userId: "u", amountPaise: "0", reason: "x", period: "2026-10" }).success).toBe(false);
    expect(commissionInput.safeParse({ userId: "u", amountPaise: "500", reason: "x", period: "Oct" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("computes commission, period, sessions and hours", () => {
    expect(commissionFor(600000, 20)).toBe(120000);
    expect(periodOf(new Date(2026, 9, 5))).toBe("2026-10");
    expect(sessionsLeft({ sessionsTotal: 12, sessionsUsed: 14 })).toBe(0);
    expect(hoursBetween(new Date("2026-10-22T06:00:00Z"), new Date("2026-10-22T14:30:00Z"))).toBe(8.5);
  });
});
