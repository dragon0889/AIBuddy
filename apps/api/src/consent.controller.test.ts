import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ConsentController } from "./consent.controller.ts";

const c = new ConsentController();
const year = new Date().getUTCFullYear();

describe("ConsentController.preview", () => {
  it("child of 6 becomes ACTIVE after guardian only", () => {
    const s = c.preview({ birthYear: year - 6, birthMonth: 1, events: ["GUARDIAN_VERIFIED"] });
    expect(s.status).toBe("ACTIVE");
  });
  it("rejects invalid input and invalid transitions", () => {
    expect(() => c.preview({ birthYear: NaN, birthMonth: 1 })).toThrow();
    expect(() => c.preview({ birthYear: year - 9, birthMonth: 1, events: ["ERASURE_DONE"] })).toThrow();
  });
});
