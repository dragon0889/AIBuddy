import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Lesson } from "@aibuddy/content";
import { Client, activateChild, makeCtx, registerParent, type Harness } from "./helpers.ts";

let h: Harness;
beforeAll(async () => { h = await makeCtx(); });
afterAll(async () => { await h.db.close(); });

let n = 0;
async function childSession(age: number) {
  const email = `learn${++n}@example.com`;
  const p = await registerParent(h, email);
  const childId = await activateChild(h, p.client, email, age);
  const r = await p.client.post("/api/v1/auth/profile-switch", { childId, pin: "1234" });
  expect(r.status).toBe(200);
  return { ...p, childId, email };
}

/** Trả lời đúng mọi bước của bài học (dùng đáp án trong kho nội dung). */
async function playLesson(c: Client, l: Lesson, opts: { wrongSpot?: boolean } = {}) {
  const results: any[] = [];
  for (const s of l.steps) {
    let answer: unknown = {};
    if (s.type === "choice") answer = { optionIndex: s.options.findIndex((o) => o.correct) };
    if (s.type === "spot_ai_mistake") answer = { marked: opts.wrongSpot ? ["không đúng"] : s.wrongParts };
    if (s.type === "drag_drop") answer = { placements: Object.fromEntries(s.items.map((it, i) => [String(i), it.target])) };
    results.push((await c.post(`/api/v1/child/lessons/${l.id}/steps`, { stepId: s.id, answer })).json);
  }
  return results;
}

describe("lesson catalogue visibility", () => {
  it("L2 child sees L1+L2, not L3; camera lessons are locked until the parent allows the camera", async () => {
    const { client } = await childSession(9);
    const list = (await client.get("/api/v1/child/lessons")).json.lessons as any[];
    expect(list.some((l) => l.level === 1)).toBe(true);
    expect(list.some((l) => l.level === 2)).toBe(true);
    expect(list.some((l) => l.level === 3)).toBe(false);
    const cam = list.find((l) => l.requiresCamera);
    expect(cam.locked).toBe(true);
    expect((await client.get(`/api/v1/child/lessons/${cam.id}`)).status).toBe(403);
    expect((await client.get("/api/v1/child/lessons/L3-RESP-01")).status).toBe(404);
    const open = await client.get("/api/v1/child/lessons/L2-RESP-01");
    expect(open.status).toBe(200);
    expect(open.json.parentGuide).toBeUndefined(); // dành cho phụ huynh
  });

  it("requires a child session (parent cookie alone is not enough)", async () => {
    const email = `learn${++n}@example.com`;
    const p = await registerParent(h, email);
    expect((await p.client.get("/api/v1/child/lessons")).status).toBe(401);
  });
});

describe("grading, XP and badges (ADD-05)", () => {
  it("grades on the server and rewards process once (idempotent)", async () => {
    const { client } = await childSession(9);
    const l = h.ctx.content.lesson("L2-RESP-05")!;
    const wrong = await client.post(`/api/v1/child/lessons/${l.id}/steps`, { stepId: "s2", answer: { marked: ["Huế"] } });
    expect(wrong.json.correct).toBe(false);
    expect(wrong.json.xpAwarded).toBe(0);
    const right = await client.post(`/api/v1/child/lessons/${l.id}/steps`, { stepId: "s2", answer: { marked: l.steps[1] && (l.steps[1] as any).wrongParts } });
    expect(right.json.correct).toBe(true);
    expect(right.json.xpAwarded).toBe(20);
    const again = await client.post(`/api/v1/child/lessons/${l.id}/steps`, { stepId: "s2", answer: { marked: (l.steps[1] as any).wrongParts } });
    expect(again.json.xpAwarded).toBe(0);
    // client không thể tự khai "correct": trường lạ bị bỏ qua, chấm theo dữ liệu thật
    const cheat = await client.post(`/api/v1/child/lessons/${l.id}/steps`, { stepId: "s3", answer: { optionIndex: 2, correct: true } });
    expect(cheat.json.correct).toBe(false);
  });

  it("cannot complete a lesson with unfinished steps; completing awards 50 XP once and the first badge", async () => {
    const { client } = await childSession(9);
    const l = h.ctx.content.lesson("L2-RESP-02")!;
    expect((await client.post(`/api/v1/child/lessons/${l.id}/complete`)).status).toBe(400);
    await playLesson(client, l);
    const done = await client.post(`/api/v1/child/lessons/${l.id}/complete`);
    expect(done.json.xpAwarded).toBe(50);
    expect(done.json.newBadges.map((b: any) => b.id)).toContain("first_lesson");
    expect((await client.post(`/api/v1/child/lessons/${l.id}/complete`)).json.xpAwarded).toBe(0);
    const me = (await client.get("/api/v1/child/me")).json;
    expect(me.xp).toBeGreaterThanOrEqual(50);
    expect(me.lessonsCompleted).toBe(1);
  });

  it("awards 'AI detective' after 3 found mistakes and 'safe knight' after 3 responsible-AI lessons", async () => {
    const { client } = await childSession(9);
    for (const id of ["L2-RESP-05", "L2-RESP-06", "L2-RESP-07"]) {
      await playLesson(client, h.ctx.content.lesson(id)!);
      await client.post(`/api/v1/child/lessons/${id}/complete`);
    }
    const me = (await client.get("/api/v1/child/me")).json;
    const ids = me.badges.map((b: any) => b.id);
    expect(ids).toContain("ai_detective");
    expect(ids).toContain("safe_knight");
  });

  it("no streak/weekly-days at level 1; weekly days only from level 2", async () => {
    const l1 = await childSession(6);
    const l2 = await childSession(9);
    expect((await l1.client.get("/api/v1/child/me")).json.daysThisWeek).toBeUndefined();
    await l2.client.post("/api/v1/child/heartbeat", { seconds: 30 });
    expect((await l2.client.get("/api/v1/child/me")).json.daysThisWeek).toBe(1);
  });
});

describe("ML project results (camera permission)", () => {
  it("is refused until the parent allows the camera, rewards training and review", async () => {
    const s = await childSession(9);
    const body = { project: "PRJ-02", accuracy: 0.6, samples: 30, improvedAfterReview: false };
    expect((await s.client.post("/api/v1/child/projects", body)).status).toBe(403);
    await s.client.put(`/api/v1/children/${s.childId}/settings`, { cameraAllowed: true });
    const a = await s.client.post("/api/v1/child/projects", body);
    expect(a.json.xpAwarded).toBe(40);
    expect(a.json.newBadges.map((b: any) => b.id)).toContain("trainer");
    const b = await s.client.post("/api/v1/child/projects", { ...body, accuracy: 0.9, improvedAfterReview: true });
    expect(b.json.xpAwarded).toBe(80);
    expect(b.json.newBadges.map((x: any) => x.id)).toContain("data_gardener");
    expect((await s.client.post("/api/v1/child/projects", { ...body, samples: 1 })).status).toBe(400);
    // chỉ lưu số liệu, không có cột dữ liệu ảnh/âm thanh
    const cols = (await h.db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='project_events'")).rows.map((r) => r.column_name);
    expect(cols.sort()).toEqual(["accuracy", "child_id", "created_at", "id", "improved_after_review", "project", "samples"]);
  });
});

describe("assessments (ADD-04) and next lesson (FR-003)", () => {
  it("hides correct answers, scores on the server, micro-quiz gives per-item feedback", async () => {
    const { client } = await childSession(9);
    const list = (await client.get("/api/v1/child/assessments")).json.assessments as any[];
    expect(list.map((a) => a.id)).toEqual(expect.arrayContaining(["pre-l2", "post-l2", "micro-l2-resp", "misconception-l2"]));
    const a = (await client.get("/api/v1/child/assessments/pre-l2")).json;
    expect(JSON.stringify(a)).not.toMatch(/correct/);
    const src = h.ctx.content.assessment("micro-l2-resp")!;
    const answers = Object.fromEntries(src.items.map((it) => [it.id, it.options.findIndex((o) => o.correct)]));
    const r = await client.post("/api/v1/child/assessments/micro-l2-resp/submit", { answers });
    expect(r.json.score).toBe(src.items.length);
    expect(r.json.items).toHaveLength(src.items.length);
    const pre = await client.post("/api/v1/child/assessments/pre-l2/submit", { answers: {} });
    expect(pre.json.score).toBe(0);
    expect(pre.json.items).toBeUndefined();
    expect((await client.get("/api/v1/child/assessments/post-l3")).status).toBe(404);
  });

  it("recommends a review lesson in the weakest pillar after a weak pre-test", async () => {
    const { client } = await childSession(9);
    const src = h.ctx.content.assessment("pre-l2")!;
    // trả lời sai toàn bộ câu về responsible_ai, đúng phần còn lại
    const answers = Object.fromEntries(src.items.map((it) => [it.id, it.pillar === "responsible_ai" ? it.options.findIndex((o) => !o.correct) : it.options.findIndex((o) => o.correct)]));
    await client.post("/api/v1/child/assessments/pre-l2/submit", { answers });
    const next = (await client.get("/api/v1/child/next")).json;
    expect(next.reason).toBe("review_weak_pillar");
    expect(next.pillar).toBe("responsible_ai");
    expect(h.ctx.content.lesson(next.lessonId)!.pillar).toBe("responsible_ai");
  });

  it("misconception survey counts statements correctly rejected", async () => {
    const { client } = await childSession(9);
    const src = h.ctx.content.assessment("misconception-l2")!;
    const believes = Object.fromEntries(src.items.map((it) => [it.id, it.options.findIndex((o) => !o.correct)]));
    const r = await client.post("/api/v1/child/assessments/misconception-l2/submit", { answers: believes });
    expect(r.json.score).toBe(0);
    expect(r.json.max).toBe(src.items.length);
  });
});

describe("parent reports", () => {
  it("weekly summary and co-learning guide reflect progress; other parents get 404", async () => {
    const s = await childSession(9);
    await playLesson(s.client, h.ctx.content.lesson("L2-RESP-02")!);
    await s.client.post("/api/v1/child/lessons/L2-RESP-02/complete");
    await s.client.post("/api/v1/child/heartbeat", { seconds: 60 });
    const w = (await s.client.get(`/api/v1/children/${s.childId}/weekly-summary`)).json;
    expect(w.lessonsThisWeek.map((x: any) => x.id)).toContain("L2-RESP-02");
    expect(w.outcomes.practiced).toBeGreaterThanOrEqual(1);
    expect(w.minutesPerDay.some((d: any) => d.minutes >= 1)).toBe(true);
    const co = (await s.client.get(`/api/v1/children/${s.childId}/co-learning`)).json;
    expect(co.recent[0].lessonId).toBe("L2-RESP-02");
    expect(co.recent[0].talkAbout.length).toBeGreaterThan(0);
    expect(co.upNext.activity).toBeTruthy();
    expect((await s.client.get("/api/v1/parent-guide")).json.sections.length).toBeGreaterThan(3);
    const other = await registerParent(h, `learn${++n}@example.com`);
    expect((await other.client.get(`/api/v1/children/${s.childId}/weekly-summary`)).status).toBe(404);
    expect((await other.client.get(`/api/v1/children/${s.childId}/co-learning`)).status).toBe(404);
  });
});
