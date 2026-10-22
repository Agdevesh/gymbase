import { describe, expect, it } from "vitest";
import { entryGate, tokenFromScan } from "./checkin";

const now = new Date("2026-10-22T10:00:00Z");
const tok = "0123456789abcdef0123456789abcdef";

describe("entryGate", () => {
  it("allows active members", () => expect(entryGate({ status: "ACTIVE", endDate: new Date("2026-11-01") }, now)).toEqual({ allowed: true }));
  it("blocks lapsed-but-not-yet-swept memberships", () => expect(entryGate({ status: "ACTIVE", endDate: new Date("2026-10-01") }, now)).toEqual({ allowed: false, reason: "EXPIRED" }));
  it("blocks frozen, cancelled and missing", () => {
    expect(entryGate({ status: "FROZEN", endDate: new Date("2026-11-01") }, now).allowed).toBe(false);
    expect(entryGate({ status: "CANCELLED", endDate: new Date("2026-11-01") }, now).allowed).toBe(false);
    expect(entryGate(null, now)).toEqual({ allowed: false, reason: "NO_PLAN" });
  });
});

describe("tokenFromScan", () => {
  it("reads bare tokens, GB: payloads and scan URLs", () => {
    expect(tokenFromScan(tok)).toBe(tok);
    expect(tokenFromScan(`GB:${tok.toUpperCase()}`)).toBe(tok);
    expect(tokenFromScan(`https://gym.example/checkin/scan/${tok}`)).toBe(tok);
    expect(tokenFromScan("Neha")).toBeNull();
  });
});
