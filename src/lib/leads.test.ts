import { describe, expect, it } from "vitest";
import { activityInput, followUpBucket, leadInput, splitName, statusFilter } from "./leads";

describe("leadInput", () => {
  it("normalises phone and accepts new sources", () => {
    const r = leadInput.parse({ name: "Kiran", phone: "98765 43210", email: "", source: "WHATSAPP", interestedIn: "", followUpAt: "", notes: "" });
    expect(r.phone).toBe("+919876543210");
    expect(r.source).toBe("WHATSAPP");
    expect(r.followUpAt).toBeNull();
  });
});

describe("activityInput", () => {
  it("needs at least one of note, status or follow-up", () => {
    expect(activityInput.safeParse({ note: "", status: "", followUpAt: "", lostReason: "" }).success).toBe(false);
    expect(activityInput.safeParse({ note: "", status: "TRIAL", followUpAt: "", lostReason: "" }).success).toBe(true);
  });
});

describe("followUpBucket", () => {
  const now = new Date(2026, 9, 22, 14, 0);
  it("buckets by local day", () => {
    expect(followUpBucket(new Date(2026, 9, 21, 23, 59), now)).toBe("OVERDUE");
    expect(followUpBucket(new Date(2026, 9, 22, 9, 0), now)).toBe("TODAY");
    expect(followUpBucket(new Date(2026, 9, 23, 0, 0), now)).toBe("UPCOMING");
    expect(followUpBucket(null, now)).toBe("NONE");
  });
});

describe("helpers", () => {
  it("splits names and defaults the status filter", () => {
    expect(splitName("  Kiran  Kumar Patel ")).toEqual({ firstName: "Kiran", lastName: "Kumar Patel" });
    expect(splitName("Kiran")).toEqual({ firstName: "Kiran", lastName: null });
    expect(statusFilter.parse("bogus")).toBe("OPEN");
    expect(statusFilter.parse("LOST")).toBe("LOST");
  });
});
