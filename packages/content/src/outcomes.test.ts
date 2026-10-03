import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lesson, outcomeCatalog, rubric } from "./schema.ts";

const root = join(__dirname, "../../../content");
const read = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("outcome catalog", () => {
  const cat = outcomeCatalog.parse(read("outcomes/outcomes.json"));
  it("has unique ids", () => {
    const ids = cat.outcomes.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers every pillar at every level", () => {
    for (const p of ["perception", "representation", "learning", "interaction", "societal", "responsible_ai"])
      for (const l of [1, 2, 3])
        expect(cat.outcomes.some((o) => o.pillar === p && o.level === l), `${p} L${l}`).toBe(true);
  });
  it("only has lessons referencing known outcomes, matching the outcome pillar", () => {
    const byId = new Map(cat.outcomes.map((o) => [o.id, o]));
    for (const f of readdirSync(join(root, "lessons")).filter((x) => x.endsWith(".json"))) {
      const l = lesson.parse(read(`lessons/${f}`));
      for (const id of l.outcomes) {
        expect(byId.has(id), `${f}: ${id}`).toBe(true);
        expect(byId.get(id)!.pillar, `${f}: ${id} pillar`).toBe(l.pillar);
      }
    }
  });
});

describe("rubric", () => {
  it("is valid and complete", () => {
    expect(rubric.safeParse(read("rubrics/project-rubric.json")).success).toBe(true);
  });
});
