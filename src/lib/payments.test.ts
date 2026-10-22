import { describe, expect, it } from "vitest";
import { allocatePayment, closingInput, collectInput, daysSince, outstanding, paise } from "./payments";

const invs = [{ id: "a", totalPaise: 10000, paidPaise: 4000 }, { id: "b", totalPaise: 5000, paidPaise: 0 }, { id: "c", totalPaise: 1000, paidPaise: 1000 }];

describe("allocatePayment", () => {
  it("fills oldest invoice first and splits across invoices", () => {
    expect(allocatePayment(8000, invs)).toEqual([{ invoiceId: "a", amountPaise: 6000 }, { invoiceId: "b", amountPaise: 2000 }]);
  });
  it("accepts partial payments and rejects overpayment", () => {
    expect(allocatePayment(1000, invs)).toEqual([{ invoiceId: "a", amountPaise: 1000 }]);
    expect(allocatePayment(20000, invs)).toBeNull();
  });
});

describe("inputs", () => {
  it("parses rupees with separators and rejects zero", () => {
    expect(collectInput.parse({ amountPaise: "1,500.50", method: "UPI", reference: "txn1" }).amountPaise).toBe(150050);
    expect(collectInput.safeParse({ amountPaise: "0", method: "CASH", reference: "" }).success).toBe(false);
  });
  it("closing needs a non-negative count", () => {
    expect(closingInput.parse({ date: "2026-10-22", countedPaise: "0", notes: "" }).countedPaise).toBe(0);
    expect(closingInput.safeParse({ date: "2026-10-22", countedPaise: "abc", notes: "" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("sums outstanding, counts days, formats paise", () => {
    expect(outstanding(invs)).toBe(11000);
    expect(daysSince(new Date("2026-10-01"), new Date("2026-10-22T10:00:00Z"))).toBe(21);
    expect(paise(150050)).toBe("₹1,500.50");
    expect(paise(1200000)).toBe("₹12,000");
  });
});
