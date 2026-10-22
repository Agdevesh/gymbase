import { describe, expect, it } from "vitest";
import { dedupeKey, isBirthdayToday, renderTemplate, ruleInput, waLink } from "./reminders";

describe("renderTemplate", () => {
  it("fills placeholders and blanks unknown ones", () => {
    expect(renderTemplate("Hi {name}, {amount} due at {gym}. {nope}", { name: "Neha", amount: "₹500", gym: "Iron" })).toBe("Hi Neha, ₹500 due at Iron. ");
  });
});

describe("helpers", () => {
  it("dedupes per type, target and local day", () => {
    expect(dedupeKey("RENEWAL", "m1", new Date(2026, 9, 22, 23, 0))).toBe("RENEWAL:m1:2026-10-22");
  });
  it("matches birthdays by month and day (dob stored at UTC midnight)", () => {
    expect(isBirthdayToday(new Date("1994-10-22T00:00:00Z"), new Date(2026, 9, 22, 9))).toBe(true);
    expect(isBirthdayToday(new Date("1994-10-23T00:00:00Z"), new Date(2026, 9, 22, 9))).toBe(false);
    expect(isBirthdayToday(null, new Date())).toBe(false);
  });
  it("builds click-to-chat links and parses rules", () => {
    expect(waLink("+91 98765 43210", "Hi there")).toBe("https://wa.me/919876543210?text=Hi%20there");
    expect(ruleInput.parse({ channel: "SMS", daysBefore: "5", template: "x" })).toEqual({ channel: "SMS", enabled: false, daysBefore: 5, template: "x" });
  });
});
