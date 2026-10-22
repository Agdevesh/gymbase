import { describe, expect, it } from "vitest";
import { expenseInput, monthRange, renewalRate, sumBy, visitHistogram } from "./reports";

describe("reports", () => {
  it("parses an expense", () => {
    expect(expenseInput.safeParse({ category: "RENT", amountPaise: "25,000", paidAt: "2026-10-01", method: "BANK", vendor: "", notes: "" }).data).toMatchObject({ amountPaise: 2500000, vendor: null });
    expect(expenseInput.safeParse({ category: "FOOD", amountPaise: "1", paidAt: "2026-10-01", method: "CASH", vendor: "", notes: "" }).success).toBe(false);
  });
  it("computes month ranges and neighbours", () => {
    const r = monthRange("2026-12");
    expect([r.prev, r.next, r.end.getFullYear()]).toEqual(["2026-11", "2027-01", 2027]);
    expect(monthRange("junk").key).toMatch(/^\d{4}-\d{2}$/);
  });
  it("sums and sorts by key", () => expect(sumBy([{ k: "a", v: 1 }, { k: "b", v: 5 }, { k: "a", v: 2 }], (r) => r.k, (r) => r.v)).toEqual([["b", 5], ["a", 3]]));
  it("builds visit histograms", () => {
    const h = visitHistogram([new Date("2026-10-19T06:30:00"), new Date("2026-10-19T06:45:00"), new Date("2026-10-20T18:00:00")]);
    expect(h.hours[6]).toBe(2); expect(h.hours[18]).toBe(1); expect(h.days[1]).toBe(2);
  });
  it("renewal rate", () => { expect(renewalRate([])).toBeNull(); expect(renewalRate([{ renewed: true }, { renewed: false }, { renewed: true }])).toBe(67); });
});
