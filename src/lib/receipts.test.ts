import { describe, expect, it } from "vitest";
import { newReceiptToken, receiptMessage } from "./receipts";

describe("receipts", () => {
  it("makes a 32-hex token", () => expect(newReceiptToken()).toMatch(/^[a-f0-9]{32}$/));
  it("writes the WhatsApp text", () => {
    expect(receiptMessage({ gymName: "Iron Gym", memberName: "Asha", number: "INV-2026-0001", paidPaise: 150000, duePaise: 50000, url: "https://x/r/abc", method: "UPI" })).toBe("Hi Asha, thanks for your payment of Rs 1,500 by UPI at Iron Gym.\nReceipt INV-2026-0001: https://x/r/abc\nBalance due: Rs 500.");
  });
});
