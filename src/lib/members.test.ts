import { describe, expect, it } from "vitest";
import { checkUpload, fileIdFromUrl, fileUrl, formatMemberCode, memberInput, normalizePhone } from "./members";

const base = { firstName: "Asha", lastName: "", phone: "98765 43210", email: "", gender: "", dob: "", address: "", emergencyName: "", emergencyPhone: "", usualTime: "", notes: "" };

describe("normalizePhone", () => {
  it("adds the country code to local numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("098765-43210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("+14155550100");
  });
  it("rejects junk", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("memberInput", () => {
  it("turns blank optional fields into null", () => {
    const r = memberInput.parse(base);
    expect(r).toMatchObject({ firstName: "Asha", lastName: null, phone: "+919876543210", email: null, gender: null, dob: null, emergencyPhone: null });
  });
  it("parses dates and lowercases email", () => {
    const r = memberInput.parse({ ...base, email: "Asha@Example.COM", dob: "1995-04-12", gender: "FEMALE" });
    expect(r.email).toBe("asha@example.com");
    expect(r.dob?.toISOString()).toBe("1995-04-12T00:00:00.000Z");
  });
  it("reports field errors", () => {
    const r = memberInput.safeParse({ ...base, firstName: " ", phone: "123", emergencyPhone: "x" });
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["firstName", "phone", "emergencyPhone"]));
  });
});

describe("helpers", () => {
  it("formats member codes", () => expect(formatMemberCode(42)).toBe("GB-0042"));
  it("round-trips file urls", () => expect(fileIdFromUrl(fileUrl("abc123"))).toBe("abc123"));
  it("ignores foreign urls", () => expect(fileIdFromUrl("https://x.com/a.png")).toBeNull());
  it("checks uploads", () => {
    expect(checkUpload(new File(["x"], "a.png", { type: "image/png" }), "photo")).toBeNull();
    expect(checkUpload(new File(["x"], "a.pdf", { type: "application/pdf" }), "photo")).toMatch(/Unsupported/);
    expect(checkUpload(new File([new Uint8Array(3 * 1024 * 1024)], "a.png", { type: "image/png" }), "photo")).toMatch(/larger/);
    expect(checkUpload(null, "document")).toBe("Choose a file");
  });
});
