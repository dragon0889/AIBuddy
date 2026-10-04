import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computePilotMetrics, type PilotParticipant } from "../src/modules/pilot.ts";
import { totp } from "../src/lib/crypto.ts";
import { createAdmin } from "../src/modules/admin.ts";
import { Client, activateChild, makeCtx, registerParent, type Harness } from "./helpers.ts";

const P = (o: Partial<PilotParticipant>): PilotParticipant => ({ pid: "x", level: 2, prePct: null, postPct: null, misconceptionBeliefPre: null, misconceptionBeliefPost: null, lessonsStarted: 0, lessonsCompleted: 0, minutesTotal: 0, ...o });

describe("computePilotMetrics", () => {
  it("computes gains, reductions, completion and ease against targets", () => {
    const m = computePilotMetrics([
      P({ prePct: 40, postPct: 60, misconceptionBeliefPre: 60, misconceptionBeliefPost: 30, lessonsStarted: 5, lessonsCompleted: 4 }),
      P({ prePct: 50, postPct: 70, misconceptionBeliefPre: 40, misconceptionBeliefPost: 30, lessonsStarted: 5, lessonsCompleted: 4 }),
      P({ prePct: null, postPct: 90 }), // chưa làm pre → không ghép cặp
    ], [5, 4, 4]);
    expect(m.pairedPrePost).toBe(2);
    expect(m.scores.absoluteGainPctPoints).toBeCloseTo(20);
    expect(m.scores.relativeGain).toBeCloseTo(20 / 45);
    expect(m.misconceptionBelief.relativeReduction).toBeCloseTo((50 - 30) / 50);
    expect(m.lessonCompletionRate).toBeCloseTo(0.8);
    expect(m.targets).toEqual({ relativeGainAtLeast20pct: true, misconceptionReductionAtLeast30pct: true, completionAtLeast70pct: true, easeAtLeast4of5: true });
  });
  it("returns nulls (not false) when there is no data", () => {
    const m = computePilotMetrics([], []);
    expect(Object.values(m.targets).every((v) => v === null)).toBe(true);
  });
});

let h: Harness;
beforeAll(async () => { h = await makeCtx(); });
afterAll(async () => { await h.db.close(); });

describe("pilot export + feedback", () => {
  it("exports de-identified data for admins only", async () => {
    const p = await registerParent(h, "pilot1@example.com");
    const kid = await activateChild(h, p.client, "pilot1@example.com", 9);
    await p.client.post("/api/v1/auth/profile-switch", { childId: kid, pin: "1234" });
    const pre = h.ctx.content.assessment("pre-l2")!, post = h.ctx.content.assessment("post-l2")!;
    const right = (a: typeof pre) => Object.fromEntries(a.items.map((it) => [it.id, it.options.findIndex((o) => o.correct)]));
    const wrong = (a: typeof pre) => Object.fromEntries(a.items.map((it) => [it.id, it.options.findIndex((o) => !o.correct)]));
    await p.client.post("/api/v1/child/assessments/pre-l2/submit", { answers: wrong(pre) });
    await p.client.post("/api/v1/child/assessments/post-l2/submit", { answers: right(post) });
    expect((await p.client.post("/api/v1/feedback", { ease: 5 })).status).toBe(201);
    expect((await p.client.post("/api/v1/feedback", { ease: 9 })).status).toBe(400);
    expect((await p.client.get("/api/v1/admin/pilot-export")).status).toBe(403);

    const a = await createAdmin(h.ctx, "pilot-admin@example.com", "a-very-long-admin-password");
    const c = new Client(h.app);
    await c.post("/api/v1/auth/login", { email: "pilot-admin@example.com", password: "a-very-long-admin-password", totp: totp(a.totpSecret, h.clock.t.getTime()) });
    const r = (await c.get("/api/v1/admin/pilot-export")).json;
    expect(r.participants).toHaveLength(1);
    expect(r.participants[0].prePct).toBe(0);
    expect(r.participants[0].postPct).toBe(100);
    expect(r.metrics.parentEaseOfUse.mean).toBe(5);
    expect(JSON.stringify(r)).not.toMatch(/example\.com|Bé Na|pilot1/);
    expect(r.participants[0].pid).toMatch(/^[0-9a-f]{16}$/);
  });
});
