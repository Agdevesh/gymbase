import { describe, expect, it } from "vitest";
import { DAY, assignInput, planInput, prorataCredit, renewalStart, unfreezeDates } from "./memberships";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("planInput", () => {
  it("converts rupees to paise and reads the active toggle", () => {
    const r = planInput.parse({ name: "Monthly", type: "MONTHLY", durationDays: "30", pricePaise: "1,500.50", ptSessions: "", active: "on" });
    expect(r.pricePaise).toBe(150050);
    expect(r.ptSessions).toBeNull();
    expect(r.active).toBe(true);
  });
  it("rejects negative prices", () => {
    expect(planInput.safeParse({ name: "X", type: "PT", durationDays: "30", pricePaise: "-5", ptSessions: "12" }).success).toBe(false);
  });
});

describe("assignInput", () => {
  it("defaults discount to zero", () => {
    expect(assignInput.parse({ planId: "p", startDate: "2026-10-22", discountPaise: "" }).discountPaise).toBe(0);
  });
});

describe("unfreezeDates", () => {
  it("extends the end date by the frozen span, minimum one day", () => {
    const r = unfreezeDates({ frozenAt: d("2026-10-01"), endDate: d("2026-10-20"), frozenDays: 2 }, d("2026-10-11"));
    expect(r.endDate).toEqual(d("2026-10-30"));
    expect(r.frozenDays).toBe(12);
    expect(unfreezeDates({ frozenAt: d("2026-10-01"), endDate: d("2026-10-20"), frozenDays: 0 }, new Date(d("2026-10-01").getTime() + 3600_000)).frozenDays).toBe(1);
  });
});

describe("prorataCredit", () => {
  const m = { startDate: d("2026-10-01"), endDate: d("2026-10-31"), pricePaise: 300000, discountPaise: 0 };
  it("credits the unused share of the paid price", () => {
    expect(prorataCredit(m, d("2026-10-21"))).toBe(100000);
  });
  it("is zero after expiry and before start never exceeds the price", () => {
    expect(prorataCredit(m, d("2026-11-05"))).toBe(0);
    expect(prorataCredit(m, d("2026-09-01"))).toBe(300000);
  });
});

describe("renewalStart", () => {
  const today = d("2026-10-22");
  it("chains from an active membership's end date", () => {
    expect(renewalStart({ endDate: d("2026-11-05"), status: "ACTIVE" }, today)).toEqual(d("2026-11-05"));
  });
  it("starts today for lapsed, expired or missing memberships", () => {
    expect(renewalStart({ endDate: new Date(today.getTime() - DAY), status: "ACTIVE" }, today)).toEqual(today);
    expect(renewalStart({ endDate: d("2026-11-05"), status: "EXPIRED" }, today)).toEqual(today);
    expect(renewalStart(null, today)).toEqual(today);
  });
});
