import { describe, expect, it } from "vitest";
import { can } from "./rbac";

describe("can", () => {
  it("lets owners manage the gym", () => {
    expect(can("OWNER", "gym:manage")).toBe(true);
  });
  it("keeps reception out of refunds and staff management", () => {
    expect(can("RECEPTION", "payments:write")).toBe(true);
    expect(can("RECEPTION", "payments:refund")).toBe(false);
    expect(can("RECEPTION", "staff:manage")).toBe(false);
  });
  it("lets trainers record progress but not money", () => {
    expect(can("TRAINER", "fitness:write")).toBe(true);
    expect(can("TRAINER", "payments:write")).toBe(false);
  });
  it("gives members no staff permissions", () => {
    expect(can("MEMBER", "members:read")).toBe(false);
  });
});
