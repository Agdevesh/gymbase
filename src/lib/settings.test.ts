import { describe, expect, it } from "vitest";
import { holidayOn, settingsInput, toCsv, upiLink } from "./settings";

describe("settings", () => {
  it("validates GSTIN and UPI id", () => {
    expect(settingsInput.safeParse({ name: "Iron Gym", gstPercent: "18", gstin: "27aabcu9603r1zm", upiId: "irongym@okaxis", holidays: "2026-10-20 Diwali\n\n2026-11-01", phone: "", whatsapp: "", email: "", address: "", receiptNote: "", openTime: "06:00", closeTime: "22:30", weeklyOff: "" }).data).toMatchObject({ gstin: "27AABCU9603R1ZM", holidays: ["2026-10-20 Diwali", "2026-11-01"], openTime: "06:00" });
    expect(settingsInput.safeParse({ name: "X", gstPercent: "0", gstin: "", upiId: "bad id", holidays: "", openTime: "25:00", closeTime: "", weeklyOff: "", phone: "", whatsapp: "", email: "", address: "", receiptNote: "" }).success).toBe(false);
  });
  it("builds a UPI link with amount", () => {
    expect(upiLink("gym@upi", "Iron Gym", 150000, "INV-1")).toBe("upi://pay?pa=gym%40upi&pn=Iron+Gym&cu=INR&am=1500.00&tn=INV-1");
  });
  it("finds a holiday label", () => {
    expect(holidayOn(["2026-10-20 Diwali", "2026-11-01"], "2026-10-20")).toBe("Diwali");
    expect(holidayOn(["2026-11-01"], "2026-11-01")).toBe("Holiday");
    expect(holidayOn([], "2026-11-01")).toBeNull();
  });
  it("quotes CSV cells", () => {
    expect(toCsv(["a", "b"], [["x,y", 'q"r'], [null, new Date("2026-01-02T10:00:00Z")]])).toBe('﻿a,b\r\n"x,y","q""r"\r\n,2026-01-02');
  });
});
