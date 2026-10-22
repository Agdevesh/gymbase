import { describe, expect, it } from "vitest";
import { daysLeft, memberLoginEmail, newPin, waLink } from "./portal";

describe("portal", () => {
  it("makes a 6 digit pin", () => expect(newPin()).toMatch(/^\d{6}$/));
  it("derives a stable synthetic email", () => expect(memberLoginEmail("GB-0007", "demo")).toBe("gb-0007@demo.member"));
  it("builds wa.me links", () => expect(waLink("+91 98765 43210", "hi there")).toBe("https://wa.me/919876543210?text=hi%20there"));
  it("counts days left", () => expect(daysLeft(new Date("2026-01-11"), new Date("2026-01-01"))).toBe(10));
});
