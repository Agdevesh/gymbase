import { describe, expect, it } from "vitest";
import { bucketByDay, conversionRate, signedTotal } from "./dashboard";

describe("dashboard helpers", () => {
  const now = new Date(2026, 9, 22, 15);
  it("buckets payments by local day with refunds negative", () => {
    const b = bucketByDay([
      { paidAt: new Date(2026, 9, 22, 9), amountPaise: 1000, kind: "PAYMENT" },
      { paidAt: new Date(2026, 9, 22, 23), amountPaise: 300, kind: "REFUND" },
      { paidAt: new Date(2026, 9, 16, 1), amountPaise: 500, kind: "PAYMENT" },
      { paidAt: new Date(2026, 9, 15, 23), amountPaise: 999, kind: "PAYMENT" },
    ], now, 7);
    expect(b).toHaveLength(7);
    expect(b[6].total).toBe(700);
    expect(b[0].total).toBe(500);
    expect(b[0].date).toEqual(new Date(2026, 9, 16));
  });
  it("computes conversion and signed totals", () => {
    expect(conversionRate(3, 12)).toBe(25);
    expect(conversionRate(0, 0)).toBe(0);
    expect(signedTotal([{ amountPaise: 500, kind: "PAYMENT" }, { amountPaise: 200, kind: "REFUND" }])).toBe(300);
  });
});
