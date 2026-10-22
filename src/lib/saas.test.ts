import { describe, expect, it } from "vitest";
import { SAAS_PLANS, limitLabel, slugify, subscriptionState, trialEnd } from "./saas";

const now = new Date("2026-10-22T10:00:00Z");
const d = (days: number) => new Date(now.getTime() + days * 86400_000);

describe("subscriptionState", () => {
  it("trial counts down then locks", () => {
    expect(subscriptionState({ status: "TRIAL", trialEndsAt: d(5), renewsAt: null, cancelAtPeriodEnd: false }, now)).toMatchObject({ locked: false, daysLeft: 5 });
    expect(subscriptionState({ status: "TRIAL", trialEndsAt: d(-1), renewsAt: null, cancelAtPeriodEnd: false }, now).locked).toBe(true);
  });
  it("active stays open, cancelling locks at period end, past due gets 7 days grace", () => {
    expect(subscriptionState({ status: "ACTIVE", trialEndsAt: d(-30), renewsAt: d(20), cancelAtPeriodEnd: false }, now)).toMatchObject({ locked: false, label: "active" });
    expect(subscriptionState({ status: "ACTIVE", trialEndsAt: d(-30), renewsAt: d(-1), cancelAtPeriodEnd: true }, now).locked).toBe(true);
    expect(subscriptionState({ status: "PAST_DUE", trialEndsAt: d(-30), renewsAt: d(-3), cancelAtPeriodEnd: false }, now)).toMatchObject({ locked: false, daysLeft: 4 });
    expect(subscriptionState({ status: "PAST_DUE", trialEndsAt: d(-30), renewsAt: d(-8), cancelAtPeriodEnd: false }, now).locked).toBe(true);
    expect(subscriptionState({ status: "CANCELLED", trialEndsAt: d(-30), renewsAt: null, cancelAtPeriodEnd: false }, now).locked).toBe(true);
    expect(subscriptionState(null, now).locked).toBe(true);
  });
});

describe("helpers", () => {
  it("slugifies, labels limits and computes trial end", () => {
    expect(slugify("  Iron Temple Fitness! ")).toBe("iron-temple-fitness");
    expect(limitLabel(SAAS_PLANS.pro.memberLimit)).toBe("Unlimited");
    expect(limitLabel(500)).toBe("500");
    expect(trialEnd(now)).toEqual(d(14));
  });
});
