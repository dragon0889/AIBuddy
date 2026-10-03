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

describe("assessments and acceptance criteria", () => {
  const cat = outcomeCatalog.parse(read("outcomes/outcomes.json"));
  const known = new Set(cat.outcomes.map((o) => o.id));
  const lessons = readdirSync(join(root, "lessons")).filter((f) => f.endsWith(".json")).map((f) => lesson.parse(read(`lessons/${f}`)));

  it("assessments are valid and reference known outcomes", async () => {
    const { assessment } = await import("./schema.ts");
    const files = readdirSync(join(root, "assessments")).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) {
      const a = assessment.parse(read(`assessments/${f}`));
      for (const it of a.items) if (it.outcome) expect(known.has(it.outcome), `${f}:${it.id}`).toBe(true);
    }
  });

  it("ADD-01: at least 1/3 of lessons per level in MVP levels are responsible_ai", () => {
    for (const level of [1, 2]) {
      const ls = lessons.filter((l) => l.level === level);
      const share = ls.filter((l) => l.pillar === "responsible_ai").length / ls.length;
      expect(share, `level ${level}`).toBeGreaterThanOrEqual(1 / 3);
    }
  });

  it("ADD-02: at least 6 'spot the AI mistake' lessons at level 2", () => {
    const n = lessons.filter((l) => l.level === 2 && l.steps.some((s) => s.type === "spot_ai_mistake")).length;
    expect(n).toBeGreaterThanOrEqual(6);
  });

  it("ADD-09: Level 1 lessons needing the camera are explicitly flagged", () => {
    for (const l of lessons.filter((x) => x.level === 1 && x.steps.some((s) => s.type === "ml_task"))) expect(l.requiresCamera).toBe(true);
  });
});
