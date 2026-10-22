import { describe, expect, it } from "vitest";
import { alertFromBody, matchAlert, newRequestCode, parseBankAlert, upiPayUri, utrInput } from "./upi";

describe("upiPayUri", () => {
  it("locks the amount and carries the code in note and reference", () => {
    const u = new URL(upiPayUri({ upiId: "gym@okaxis", payee: "Iron Gym", amountPaise: 70000, code: "GBABC234", note: "INV-1" }));
    expect(u.searchParams.get("am")).toBe("700.00");
    expect(u.searchParams.get("tr")).toBe("GBABC234");
    expect(u.searchParams.get("tn")).toBe("GBABC234 INV-1");
    expect(u.searchParams.get("cu")).toBe("INR");
  });
  it("codes avoid confusable letters", () => {
    for (let i = 0; i < 50; i++) expect(newRequestCode()).toMatch(/^GB[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe("parseBankAlert", () => {
  it("reads common Indian bank credit SMS", () => {
    expect(parseBankAlert("Rs.700.00 credited to A/c XX1234 on 22-10-26 by UPI Ref No 629812345678 from rahul@okicici. Avl Bal Rs 15,230.50 -SBI")).toEqual({ amountPaise: 70000, utr: "629812345678", payerVpa: "rahul@okicici" });
    expect(parseBankAlert("Your a/c XX9876 is credited with INR 1,200.00 on 22-Oct-26 by a/c linked to VPA priya.s@ybl (UPI Ref no 328811223344). Available balance: INR 90,000.00")).toEqual({ amountPaise: 120000, utr: "328811223344", payerVpa: "priya.s@ybl" });
    expect(parseBankAlert("You have received Rs 500 from Amit Kumar (UPI ID: amit@fam) UPI Ref: 123456789012")).toMatchObject({ amountPaise: 50000, utr: "123456789012", payerVpa: "amit@fam" });
    expect(parseBankAlert("₹ 700 received from 98765xxxxx. Ref 412345678901. GPay")).toMatchObject({ amountPaise: 70000, utr: "412345678901" });
  });
  it("ignores debits, OTPs and balance lines", () => {
    expect(parseBankAlert("Rs 700.00 debited from A/c XX1234 for UPI to zomato@ybl. Ref 629812345678")).toBeNull();
    expect(parseBankAlert("Your OTP for Rs 700 transaction is 123456. Do not share.")).toBeNull();
    expect(parseBankAlert("Avl Bal Rs 700.00 in A/c XX1234")).toBeNull();
    expect(parseBankAlert("Rs 10 debited for SMS charges. Rs 700 credited earlier")).toBeNull();
  });
  it("never takes the balance as the amount", () => {
    expect(parseBankAlert("A/c credited by Rs 700 Ref 629812345678. Bal: Rs 99,999")?.amountPaise).toBe(70000);
  });
});

describe("matchAlert", () => {
  const p = (id: string, amountPaise: number, code: string) => ({ id, amountPaise, code, createdAt: new Date() });
  it("matches by exact amount only", () => {
    expect(matchAlert({ amountPaise: 60000, text: "" }, [p("a", 70000, "GBAAAAAA")])).toBeNull();
    expect(matchAlert({ amountPaise: 70000, text: "" }, [p("a", 70000, "GBAAAAAA")])).toEqual({ request: expect.objectContaining({ id: "a" }) });
  });
  it("uses the code when two requests have the same amount, else asks staff", () => {
    const list = [p("a", 70000, "GBAAAAAA"), p("b", 70000, "GBBBBBBB")];
    expect(matchAlert({ amountPaise: 70000, text: "UPI 700 note GBBBBBBB" }, list)).toEqual({ request: expect.objectContaining({ id: "b" }) });
    expect(matchAlert({ amountPaise: 70000, text: "UPI 700" }, list)).toEqual({ ambiguous: list });
  });
});

describe("utrInput / alertFromBody", () => {
  it("normalises typed UTRs", () => {
    expect(utrInput(" 6298 1234 5678 ")).toBe("629812345678");
    expect(utrInput("abc")).toBeNull();
  });
  it("accepts forwarder payloads", () => {
    expect(alertFromBody({ from: "AX-SBIINB", text: "Rs 700 credited" }, "application/json")).toEqual({ text: "Rs 700 credited", sender: "AX-SBIINB" });
    expect(alertFromBody("Rs 700 credited", "text/plain")).toEqual({ text: "Rs 700 credited", sender: null });
    expect(alertFromBody({ foo: 1 }, "application/json")).toBeNull();
  });
});
