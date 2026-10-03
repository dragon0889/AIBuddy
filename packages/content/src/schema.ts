import { z } from "zod";

/** Văn bản đa ngôn ngữ; `vi` bắt buộc (ngôn ngữ mặc định). */
const i18n = z.object({ vi: z.string().min(1), en: z.string().optional() });

/** Mã outcome: PER|REP|LRN|INT|SOC|RESP . cấp(1-3) . số, ví dụ RESP.2.1 */
export const outcomeId = z.string().regex(/^(PER|REP|LRN|INT|SOC|RESP)\.[1-3]\.\d+$/);

const base = { id: z.string().min(1) };

const story = z.object({ ...base, type: z.literal("story"), mascot: z.string().optional(), text: i18n });
const choice = z.object({
  ...base,
  type: z.literal("choice"),
  prompt: i18n,
  options: z.array(z.object({ text: i18n, correct: z.boolean(), feedback: i18n.optional() })).min(2),
});
const dragDrop = z.object({
  ...base,
  type: z.literal("drag_drop"),
  prompt: i18n,
  items: z.array(z.object({ label: i18n, target: z.string() })).min(2),
  targets: z.array(z.object({ id: z.string(), label: i18n })).min(2),
});
const shortText = z.object({ ...base, type: z.literal("short_text"), prompt: i18n, acceptable: z.array(z.string()).optional() });
const spotAiMistake = z.object({
  ...base,
  type: z.literal("spot_ai_mistake"),
  aiAnswer: i18n,
  facts: z.array(i18n).min(1),
  wrongParts: z.array(z.string()).min(1),
  feedback: i18n,
});
const discussion = z.object({
  ...base,
  type: z.literal("discussion"),
  prompt: i18n,
  /** Gợi ý cho phụ huynh (ADD-07). */
  parentTips: i18n,
});
const unplugged = z.object({ ...base, type: z.literal("unplugged"), instructions: i18n, materials: z.array(i18n).default([]) });
const mlTask = z.object({ ...base, type: z.literal("ml_task"), project: z.string().regex(/^PRJ-\d{2}$/), labels: z.array(i18n).min(2) });
const blockTask = z.object({ ...base, type: z.literal("block_task"), goal: i18n });

export const step = z.discriminatedUnion("type", [
  story, choice, dragDrop, shortText, spotAiMistake, discussion, unplugged, mlTask, blockTask,
]);

export const pillar = z.enum(["perception", "representation", "learning", "interaction", "societal", "responsible_ai"]);

export const lesson = z
  .object({
    id: z.string().regex(/^L[1-3]-[A-Z]+-\d{2}$/),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    pillar,
    outcomes: z.array(outcomeId).min(1),
    title: i18n,
    minutes: z.number().int().min(3).max(45),
    steps: z.array(step).min(1),
    /** ADD-07: mỗi bài phải có hướng dẫn cho phụ huynh. */
    parentGuide: z.object({ talkAbout: z.array(i18n).min(1), activity: i18n }),
    /** ADD-09: Level 1 không yêu cầu webcam/mic nếu không có xác nhận của phụ huynh. */
    requiresCamera: z.boolean().default(false),
  })
  .superRefine((l, ctx) => {
    const ids = new Set<string>();
    for (const s of l.steps) {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", message: `duplicate step id ${s.id}` });
      ids.add(s.id);
    }
    if (l.id[1] !== String(l.level)) ctx.addIssue({ code: "custom", message: "lesson id level prefix must match level" });
    for (const o of l.outcomes) {
      if (o.split(".")[1] !== String(l.level)) ctx.addIssue({ code: "custom", message: `outcome ${o} does not match level ${l.level}` });
    }
    if (l.level === 1 && l.steps.some((s) => s.type === "short_text" || s.type === "block_task"))
      ctx.addIssue({ code: "custom", message: "Level 1 lessons must be unplugged / touch based (no typing or coding)" });
  });

export type Lesson = z.infer<typeof lesson>;
export type Step = z.infer<typeof step>;

const bloom = z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]);

export const outcome = z.object({
  id: outcomeId,
  pillar,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  statement: i18n,
  bloom,
  evidence: z.string().min(1),
}).refine((o) => o.id.split(".")[1] === String(o.level), { message: "outcome id level must match level" });

export const outcomeCatalog = z.object({ version: z.string(), status: z.string(), outcomes: z.array(outcome).min(1) });

export const rubric = z.object({
  version: z.string(),
  id: z.string(),
  title: i18n,
  levels: z.array(z.object({ score: z.number().int(), name: i18n })).length(4),
  criteria: z.array(z.object({ id: z.string(), name: i18n, descriptors: z.record(z.string(), i18n) })).min(1),
}).superRefine((r, ctx) => {
  for (const c of r.criteria) for (const l of r.levels) {
    if (!c.descriptors[String(l.score)]) ctx.addIssue({ code: "custom", message: `criterion ${c.id} missing descriptor for score ${l.score}` });
  }
});

export type Outcome = z.infer<typeof outcome>;

/** Bài đánh giá (pre/post/micro/misconception) – ADD-04. */
export const assessment = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["pre", "post", "micro", "misconception"]),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: i18n,
  items: z.array(z.object({
    id: z.string(),
    pillar,
    outcome: outcomeId.optional(),
    prompt: i18n,
    options: z.array(z.object({ text: i18n, correct: z.boolean() })).min(2),
    /** Cho khảo sát hiểu sai: mô tả quan niệm sai mà đáp án sai đại diện. */
    misconception: z.string().optional(),
  })).min(1),
}).superRefine((a, ctx) => {
  const ids = new Set<string>();
  for (const it of a.items) {
    if (ids.has(it.id)) ctx.addIssue({ code: "custom", message: `duplicate item id ${it.id}` });
    ids.add(it.id);
    if (!it.options.some((o) => o.correct)) ctx.addIssue({ code: "custom", message: `item ${it.id} has no correct option` });
  }
});
export type Assessment = z.infer<typeof assessment>;
