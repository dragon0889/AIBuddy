import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Assessment, Lesson, Step } from "@aibuddy/content";
import type { AppContext } from "../context.ts";
import { badRequest, forbidden, notFound, parse } from "../lib/errors.ts";
import { requireParent } from "../lib/session.ts";
import { activeChild, childSummary, ownedChild, remainingSeconds, todayKey, type ChildRow } from "./family.ts";

// ---------- Quy tắc điểm thưởng (ADD-05): thưởng QUÁ TRÌNH, không chỉ độ chính xác ----------
export const XP = { lesson_completed: 50, spot_mistake: 20, shared_activity: 10, model_trained: 40, model_improved: 80 } as const;
type XpReason = keyof typeof XP;

export const BADGES: Record<string, { vi: string; descVi: string }> = {
  first_lesson: { vi: "Bước đầu tiên", descVi: "Hoàn thành bài học đầu tiên" },
  ai_detective: { vi: "Thám tử kiểm chứng", descVi: "Tìm ra lỗi của AI 3 lần" },
  safe_knight: { vi: "Hiệp sĩ AI An toàn", descVi: "Hoàn thành 3 bài về dùng AI có trách nhiệm" },
  trainer: { vi: "Huấn luyện viên AI", descVi: "Huấn luyện mô hình đầu tiên" },
  data_gardener: { vi: "Người làm vườn dữ liệu", descVi: "Cải thiện mô hình bằng cách sửa dữ liệu" },
  l1_explorer: { vi: "Nhà thám hiểm nhỏ", descVi: "Hoàn thành mọi bài cấp 1 không cần camera" },
};

async function award(ctx: AppContext, childId: string, reason: XpReason, ref: string): Promise<number> {
  const r = await ctx.db.query(
    "INSERT INTO xp_events(id, child_id, reason, points, ref, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (child_id, reason, ref) DO NOTHING",
    [randomUUID(), childId, reason, XP[reason], ref, ctx.now()]);
  return r.rowCount > 0 ? XP[reason] : 0;
}

export async function totalXp(ctx: AppContext, childId: string): Promise<number> {
  return (await ctx.db.query<{ n: number }>("SELECT COALESCE(SUM(points),0)::int AS n FROM xp_events WHERE child_id=$1", [childId])).rows[0]!.n;
}

async function evaluateBadges(ctx: AppContext, c: ChildRow): Promise<string[]> {
  const done = (await ctx.db.query<{ lesson_id: string }>("SELECT lesson_id FROM lesson_progress WHERE child_id=$1 AND status='completed'", [c.id])).rows.map((r) => r.lesson_id);
  const doneLessons = done.map((id) => ctx.content.lesson(id)).filter((l): l is Lesson => !!l);
  const spots = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM xp_events WHERE child_id=$1 AND reason='spot_mistake'", [c.id])).rows[0]!.n;
  const proj = (await ctx.db.query<{ improved: boolean }>("SELECT improved_after_review AS improved FROM project_events WHERE child_id=$1", [c.id])).rows;
  const l1Required = ctx.content.lessons(1).filter((l) => !l.requiresCamera).map((l) => l.id);
  const earnedNow: Record<string, boolean> = {
    first_lesson: done.length >= 1,
    ai_detective: spots >= 3,
    safe_knight: doneLessons.filter((l) => l.pillar === "responsible_ai").length >= 3,
    trainer: proj.length >= 1,
    data_gardener: proj.some((p) => p.improved),
    l1_explorer: l1Required.length > 0 && l1Required.every((id) => done.includes(id)),
  };
  const fresh: string[] = [];
  for (const [id, ok] of Object.entries(earnedNow)) {
    if (!ok) continue;
    const r = await ctx.db.query("INSERT INTO user_badges(child_id, badge_id, earned_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [c.id, id, ctx.now()]);
    if (r.rowCount > 0) fresh.push(id);
  }
  return fresh;
}

const visible = (ctx: AppContext, c: ChildRow, id: string): Lesson => {
  const l = ctx.content.lesson(id);
  if (!l || l.level > c.level) throw notFound("lesson_not_found");
  return l;
};

/** Chấm bước ở server (không tin dữ liệu "correct" từ client → chống gian lận điểm). */
function gradeStep(step: Step, answer: unknown): { correct: boolean | null; feedback?: string } {
  switch (step.type) {
    case "choice": {
      const idx = z.object({ optionIndex: z.number().int().min(0) }).parse(answer).optionIndex;
      const opt = step.options[idx];
      if (!opt) throw badRequest("invalid_option");
      return { correct: opt.correct, feedback: opt.feedback?.vi };
    }
    case "spot_ai_mistake": {
      const marked = z.object({ marked: z.array(z.string()) }).parse(answer).marked;
      const ok = step.wrongParts.length === marked.length && step.wrongParts.every((w) => marked.includes(w));
      return { correct: ok, feedback: step.feedback.vi };
    }
    case "drag_drop": {
      const p = z.object({ placements: z.record(z.string(), z.string()) }).parse(answer).placements;
      const ok = step.items.every((it, i) => p[String(i)] === it.target);
      return { correct: ok };
    }
    default:
      return { correct: null };
  }
}

async function lessonStatuses(ctx: AppContext, childId: string) {
  const r = await ctx.db.query<{ lesson_id: string; status: string; step_index: number }>("SELECT lesson_id, status, step_index FROM lesson_progress WHERE child_id=$1", [childId]);
  return new Map(r.rows.map((x) => [x.lesson_id, x]));
}

interface ItemResult { id: string; pillar: string; outcome?: string; correct: boolean }

/** Gợi ý bài tiếp theo (FR-003 cơ bản): ưu tiên bài bổ trợ ở trụ cột yếu nhất theo kết quả gần nhất. */
export async function nextLesson(ctx: AppContext, c: ChildRow): Promise<{ lessonId: string | null; reason: "review_weak_pillar" | "sequential" | "all_done"; pillar?: string }> {
  const st = await lessonStatuses(ctx, c.id);
  const pending = ctx.content.lessons().filter((l) => l.level <= c.level && st.get(l.id)?.status !== "completed" && (!l.requiresCamera || c.camera_allowed));
  if (!pending.length) return { lessonId: null, reason: "all_done" };
  const rows = (await ctx.db.query<{ answers: ItemResult[] }>("SELECT answers FROM assessment_results WHERE child_id=$1 AND kind IN ('pre','micro') ORDER BY created_at DESC LIMIT 3", [c.id])).rows;
  const stat = new Map<string, { ok: number; n: number }>();
  for (const row of rows) for (const it of row.answers) { const s = stat.get(it.pillar) ?? { ok: 0, n: 0 }; s.n++; if (it.correct) s.ok++; stat.set(it.pillar, s); }
  const weak = [...stat].filter(([, s]) => s.n >= 2 && s.ok / s.n < 0.5).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
  if (weak) {
    const inWeak = pending.filter((l) => l.pillar === weak[0]).sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))[0];
    if (inWeak) return { lessonId: inWeak.id, reason: "review_weak_pillar", pillar: weak[0] };
  }
  return { lessonId: pending.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))[0]!.id, reason: "sequential" };
}

const stripAnswers = (a: Assessment) => ({
  id: a.id, kind: a.kind, level: a.level, title: a.title.vi,
  items: a.items.map((it) => ({ id: it.id, prompt: it.prompt.vi, options: it.options.map((o) => o.text.vi) })),
});

function assessmentFor(ctx: AppContext, c: ChildRow, id: string): Assessment {
  const a = ctx.content.assessment(id);
  if (!a || a.level > c.level) throw notFound("assessment_not_found");
  return a;
}

export function learningRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ---------------- Trẻ em ----------------
  app.get("/api/v1/child/me", async (req) => {
    const c = await activeChild(ctx, req);
    const badges = (await ctx.db.query<{ badge_id: string }>("SELECT badge_id FROM user_badges WHERE child_id=$1 ORDER BY earned_at", [c.id])).rows.map((b) => ({ id: b.badge_id, ...BADGES[b.badge_id] }));
    const completed = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM lesson_progress WHERE child_id=$1 AND status='completed'", [c.id])).rows[0]!.n;
    // Không có "streak" ở cấp 1 (ADD-05). Từ cấp 2 chỉ hiển thị số ngày đã học trong tuần – không phạt khi nghỉ.
    let daysThisWeek: number | undefined;
    if (c.level >= 2) {
      daysThisWeek = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM usage_days WHERE child_id=$1 AND day > $2::date - 7 AND seconds > 0", [c.id, todayKey(ctx)])).rows[0]!.n;
    }
    const sum = await childSummary(ctx, c);
    return { ...sum, xp: await totalXp(ctx, c.id), badges, lessonsCompleted: completed, daysThisWeek, remainingSeconds: await remainingSeconds(ctx, c.id) };
  });

  app.get("/api/v1/child/lessons", async (req) => {
    const c = await activeChild(ctx, req);
    const st = await lessonStatuses(ctx, c.id);
    return {
      lessons: ctx.content.lessons().filter((l) => l.level <= c.level).sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)).map((l) => ({
        id: l.id, level: l.level, pillar: l.pillar, title: l.title.vi, minutes: l.minutes, outcomes: l.outcomes, requiresCamera: l.requiresCamera,
        locked: l.requiresCamera && !c.camera_allowed, status: st.get(l.id)?.status ?? "new", stepIndex: st.get(l.id)?.step_index ?? 0,
      })),
    };
  });

  app.get("/api/v1/child/next", async (req) => nextLesson(ctx, await activeChild(ctx, req)));

  app.get("/api/v1/child/lessons/:id", async (req) => {
    const c = await activeChild(ctx, req);
    const l = visible(ctx, c, (req.params as { id: string }).id);
    if (l.requiresCamera && !c.camera_allowed) throw forbidden("camera_not_allowed");
    // Không gửi parentGuide cho trẻ (dành cho phụ huynh).
    const { parentGuide: _pg, ...rest } = l;
    return rest;
  });

  app.post("/api/v1/child/lessons/:id/steps", async (req) => {
    const c = await activeChild(ctx, req);
    const l = visible(ctx, c, (req.params as { id: string }).id);
    const body = parse(z.object({ stepId: z.string(), answer: z.unknown().optional() }), req.body);
    const idx = l.steps.findIndex((s) => s.id === body.stepId);
    if (idx < 0) throw badRequest("unknown_step");
    const step = l.steps[idx]!;
    let graded: { correct: boolean | null; feedback?: string };
    try { graded = gradeStep(step, body.answer ?? {}); } catch (e) { if (e instanceof z.ZodError) throw badRequest("invalid_answer"); throw e; }
    await ctx.db.query(
      `INSERT INTO step_results(id, child_id, lesson_id, step_id, kind, correct, attempts, created_at) VALUES ($1,$2,$3,$4,$5,$6,1,$7)
       ON CONFLICT (child_id, lesson_id, step_id) DO UPDATE SET attempts = step_results.attempts + 1, correct = COALESCE(step_results.correct OR EXCLUDED.correct, EXCLUDED.correct)`,
      [randomUUID(), c.id, l.id, step.id, step.type, graded.correct, ctx.now()]);
    await ctx.db.query(
      `INSERT INTO lesson_progress(child_id, lesson_id, status, step_index, updated_at) VALUES ($1,$2,'in_progress',$3,$4)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET step_index = GREATEST(lesson_progress.step_index, $3), updated_at=$4`,
      [c.id, l.id, idx + 1, ctx.now()]);
    let xp = 0;
    if (step.type === "spot_ai_mistake" && graded.correct) xp += await award(ctx, c.id, "spot_mistake", `${l.id}:${step.id}`);
    if ((step.type === "discussion" || step.type === "unplugged")) xp += await award(ctx, c.id, "shared_activity", `${l.id}:${step.id}`);
    const badges = await evaluateBadges(ctx, c);
    return { correct: graded.correct, feedback: graded.feedback, xpAwarded: xp, newBadges: badges };
  });

  app.post("/api/v1/child/lessons/:id/complete", async (req) => {
    const c = await activeChild(ctx, req);
    const l = visible(ctx, c, (req.params as { id: string }).id);
    const n = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM step_results WHERE child_id=$1 AND lesson_id=$2", [c.id, l.id])).rows[0]!.n;
    if (n < l.steps.length) throw badRequest("steps_incomplete");
    await ctx.db.query(
      `INSERT INTO lesson_progress(child_id, lesson_id, status, step_index, updated_at, completed_at) VALUES ($1,$2,'completed',$3,$4,$4)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET status='completed', step_index=$3, updated_at=$4, completed_at=COALESCE(lesson_progress.completed_at,$4)`,
      [c.id, l.id, l.steps.length, ctx.now()]);
    const xp = await award(ctx, c.id, "lesson_completed", l.id);
    const badges = await evaluateBadges(ctx, c);
    return { xpAwarded: xp, totalXp: await totalXp(ctx, c.id), newBadges: badges.map((id) => ({ id, ...BADGES[id] })), next: await nextLesson(ctx, c) };
  });

  // Kết quả dự án ML (chỉ số liệu – không có ảnh/âm thanh). Camera phải được phụ huynh cho phép (ADD-09).
  app.post("/api/v1/child/projects", async (req) => {
    const c = await activeChild(ctx, req);
    const b = parse(z.object({ project: z.string().regex(/^PRJ-\d{2}$/), accuracy: z.number().min(0).max(1), samples: z.number().int().min(2).max(500), improvedAfterReview: z.boolean().default(false) }), req.body);
    if (["PRJ-01", "PRJ-02"].includes(b.project) && !c.camera_allowed) throw forbidden("camera_not_allowed");
    await ctx.db.query("INSERT INTO project_events(id, child_id, project, accuracy, samples, improved_after_review, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [randomUUID(), c.id, b.project, b.accuracy, b.samples, b.improvedAfterReview, ctx.now()]);
    let xp = 0;
    if (b.samples >= 6) xp += await award(ctx, c.id, "model_trained", b.project);
    if (b.improvedAfterReview) xp += await award(ctx, c.id, "model_improved", b.project);
    const badges = await evaluateBadges(ctx, c);
    return { xpAwarded: xp, newBadges: badges.map((id) => ({ id, ...BADGES[id] })) };
  });

  // ---------------- Đánh giá ----------------
  app.get("/api/v1/child/assessments", async (req) => {
    const c = await activeChild(ctx, req);
    const taken = (await ctx.db.query<{ scope: string; kind: string; score: number; max_score: number }>(
      "SELECT DISTINCT ON (scope) scope, kind, score, max_score FROM assessment_results WHERE child_id=$1 ORDER BY scope, created_at DESC", [c.id])).rows;
    // Với mỗi loại chỉ giữ bài ở cấp cao nhất ≤ cấp của trẻ.
    const best = new Map<string, Assessment>();
    for (const a of ctx.content.assessments().filter((x) => x.level <= c.level)) {
      const key = `${a.kind}:${a.id.replace(/-l\d.*$/, "")}`;
      const cur = best.get(key);
      if (!cur || a.level > cur.level) best.set(key, a);
    }
    return { assessments: [...best.values()].map((a) => ({ id: a.id, kind: a.kind, title: a.title.vi, items: a.items.length, takenBefore: taken.some((t) => t.scope === a.id) })) };
  });

  app.get("/api/v1/child/assessments/:id", async (req) => {
    const c = await activeChild(ctx, req);
    return stripAnswers(assessmentFor(ctx, c, (req.params as { id: string }).id));
  });

  app.post("/api/v1/child/assessments/:id/submit", async (req) => {
    const c = await activeChild(ctx, req);
    const a = assessmentFor(ctx, c, (req.params as { id: string }).id);
    const { answers } = parse(z.object({ answers: z.record(z.string(), z.number().int().min(0)) }), req.body);
    const results: ItemResult[] = a.items.map((it) => {
      const choice = answers[it.id];
      return { id: it.id, pillar: it.pillar, outcome: it.outcome, correct: choice !== undefined && !!it.options[choice]?.correct };
    });
    const score = results.filter((r) => r.correct).length;
    await ctx.db.query("INSERT INTO assessment_results(id, child_id, kind, scope, score, max_score, answers, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [randomUUID(), c.id, a.kind, a.id, score, a.items.length, JSON.stringify(results), ctx.now()]);
    // Mini-quiz: phản hồi từng câu. Pre/post/khảo sát: chỉ tổng quát (tránh học vẹt đáp án).
    if (a.kind === "micro") return { score, max: a.items.length, items: results.map((r) => ({ id: r.id, correct: r.correct })) };
    return { score, max: a.items.length };
  });

  // ---------------- Phụ huynh ----------------
  app.get("/api/v1/parent-guide", async (req) => {
    requireParent(req);
    return ctx.content.parentGuide();
  });

  app.get("/api/v1/children/:id/weekly-summary", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    const today = todayKey(ctx);
    const usage = (await ctx.db.query<{ day: string; seconds: number }>("SELECT to_char(day,'YYYY-MM-DD') AS day, seconds FROM usage_days WHERE child_id=$1 AND day > $2::date - 7 ORDER BY day", [c.id, today])).rows;
    const since = new Date(ctx.now().getTime() - 7 * 86_400_000);
    const done = (await ctx.db.query<{ lesson_id: string; completed_at: Date }>("SELECT lesson_id, completed_at FROM lesson_progress WHERE child_id=$1 AND status='completed' ORDER BY completed_at", [c.id])).rows;
    const weekDone = done.filter((d) => new Date(d.completed_at) >= since);
    const covered = new Set(done.flatMap((d) => ctx.content.lesson(d.lesson_id)?.outcomes ?? []));
    const outcomes = ctx.content.outcomes().filter((o) => o.level <= c.level).map((o) => ({ id: o.id, pillar: o.pillar, statement: o.statement.vi, practiced: covered.has(o.id) }));
    const xpWeek = (await ctx.db.query<{ n: number }>("SELECT COALESCE(SUM(points),0)::int AS n FROM xp_events WHERE child_id=$1 AND created_at >= $2", [c.id, since])).rows[0]!.n;
    const assess = (await ctx.db.query<{ kind: string; scope: string; score: number; max_score: number; created_at: Date }>(
      "SELECT kind, scope, score, max_score, created_at FROM assessment_results WHERE child_id=$1 ORDER BY created_at", [c.id])).rows;
    const projects = (await ctx.db.query<{ project: string; accuracy: number; samples: number; improved_after_review: boolean }>("SELECT project, accuracy, samples, improved_after_review FROM project_events WHERE child_id=$1 ORDER BY created_at DESC LIMIT 10", [c.id])).rows;
    return {
      child: await childSummary(ctx, c),
      minutesPerDay: usage.map((u) => ({ day: u.day, minutes: Math.round(u.seconds / 60) })),
      lessonsThisWeek: weekDone.map((d) => ({ id: d.lesson_id, title: ctx.content.lesson(d.lesson_id)?.title.vi ?? d.lesson_id })),
      xpThisWeek: xpWeek,
      outcomes: { practiced: outcomes.filter((o) => o.practiced).length, total: outcomes.length, items: outcomes },
      assessments: assess.map((r) => ({ kind: r.kind, scope: r.scope, score: r.score, max: r.max_score, at: r.created_at })),
      projects: projects.map((p) => ({ project: p.project, accuracy: p.accuracy, samples: p.samples, improvedAfterReview: p.improved_after_review })),
    };
  });

  app.get("/api/v1/children/:id/co-learning", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    const done = (await ctx.db.query<{ lesson_id: string }>("SELECT lesson_id FROM lesson_progress WHERE child_id=$1 AND status='completed' ORDER BY completed_at DESC LIMIT 3", [c.id])).rows;
    const guide = (l: Lesson) => ({ lessonId: l.id, title: l.title.vi, talkAbout: l.parentGuide.talkAbout.map((x) => x.vi), activity: l.parentGuide.activity.vi });
    const next = await nextLesson(ctx, c);
    const nextLessonObj = next.lessonId ? ctx.content.lesson(next.lessonId) : undefined;
    return {
      recent: done.map((d) => ctx.content.lesson(d.lesson_id)).filter((l): l is Lesson => !!l).map(guide),
      upNext: nextLessonObj ? { ...guide(nextLessonObj), reason: next.reason } : null,
    };
  });
}
