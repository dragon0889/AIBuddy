import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lesson } from "./schema.ts";

const dir = join(__dirname, "../../../content/lessons");

describe("content/lessons", () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    it(`${f} is valid`, () => {
      const r = lesson.safeParse(JSON.parse(readFileSync(join(dir, f), "utf8")));
      expect(r.success ? [] : r.error.issues).toEqual([]);
    });
  }
});

describe("lesson rules", () => {
  const ok = JSON.parse(readFileSync(join(dir, readdirSync(dir)[0]!), "utf8"));
  it("rejects outcome from another level", () => {
    expect(lesson.safeParse({ ...ok, outcomes: ["RESP.3.1"] }).success).toBe(false);
  });
  it("requires a parent guide", () => {
    const { parentGuide: _, ...rest } = ok;
    expect(lesson.safeParse(rest).success).toBe(false);
  });
});
