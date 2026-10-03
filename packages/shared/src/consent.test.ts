import { describe, expect, it } from "vitest";
import { ageInYears, createChildProfile, transition } from "./index.js";

describe("ageInYears", () => {
  it("is conservative until the birth month has passed", () => {
    expect(ageInYears(2018, 6, new Date(Date.UTC(2025, 5, 15)))).toBe(6);
    expect(ageInYears(2018, 6, new Date(Date.UTC(2025, 6, 1)))).toBe(7);
  });
});

describe("dual consent", () => {
  it("child aged 7+ needs both guardian and child", () => {
    let s = createChildProfile(9);
    expect(s.status).toBe("PENDING_PARENT_CONSENT");
    s = transition(s, { type: "GUARDIAN_VERIFIED" });
    expect(s.status).toBe("PENDING_PARENT_CONSENT");
    s = transition(s, { type: "CHILD_AGREED" });
    expect(s.status).toBe("ACTIVE");
  });
  it("child under 7 needs the guardian only", () => {
    const s = transition(createChildProfile(6), { type: "GUARDIAN_VERIFIED" });
    expect(s.status).toBe("ACTIVE");
  });
  it("expires and can be erased", () => {
    const s = transition(createChildProfile(10), { type: "TIMEOUT" });
    expect(s.status).toBe("EXPIRED");
    expect(transition(s, { type: "ERASURE_DONE" }).status).toBe("ERASED");
  });
  it("withdrawal leads to erasure", () => {
    let s = transition(createChildProfile(6), { type: "GUARDIAN_VERIFIED" });
    s = transition(s, { type: "WITHDRAW" });
    expect(s.status).toBe("ERASURE_REQUESTED");
    expect(transition(s, { type: "ERASURE_DONE" }).status).toBe("ERASED");
  });
  it("rejects invalid transitions", () => {
    expect(() => transition(createChildProfile(10), { type: "ERASURE_DONE" })).toThrow();
    const active = transition(createChildProfile(6), { type: "GUARDIAN_VERIFIED" });
    expect(() => transition(active, { type: "CHILD_AGREED" })).toThrow();
  });
});
