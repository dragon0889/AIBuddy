import { createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.ts";
import { audit } from "../lib/audit.ts";
import { parse } from "../lib/errors.ts";
import { requireAdmin, requireParent } from "../lib/session.ts";

export interface PilotParticipant {
  pid: string; level: number; prePct: number | null; postPct: number | null;
  misconceptionBeliefPre: number | null; misconceptionBeliefPost: number | null;
  lessonsStarted: number; lessonsCompleted: number; minutesTotal: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Chỉ số thành công của pilot (ADD-11). Hàm thuần để kiểm thử. Ngưỡng là đề xuất, cần chuyên gia xác nhận. */
export function computePilotMetrics(rows: PilotParticipant[], feedback: number[]) {
  const paired = rows.filter((r) => r.prePct !== null && r.postPct !== null);
  const pre = mean(paired.map((r) => r.prePct!)), post = mean(paired.map((r) => r.postPct!));
  const mis = rows.filter((r) => r.misconceptionBeliefPre !== null && r.misconceptionBeliefPost !== null);
  const misPre = mean(mis.map((r) => r.misconceptionBeliefPre!)), misPost = mean(mis.map((r) => r.misconceptionBeliefPost!));
  const started = rows.reduce((a, r) => a + r.lessonsStarted, 0), done = rows.reduce((a, r) => a + r.lessonsCompleted, 0);
  const ease = mean(feedback);
  const relGain = pre && post !== null && pre > 0 ? (post - pre) / pre : null;
  const misDrop = misPre && misPost !== null && misPre > 0 ? (misPre - misPost) / misPre : null;
  const completion = started > 0 ? done / started : null;
  return {
    participants: rows.length, pairedPrePost: paired.length, pairedMisconception: mis.length,
    scores: { prePct: pre, postPct: post, absoluteGainPctPoints: pre !== null && post !== null ? post - pre : null, relativeGain: relGain },
    misconceptionBelief: { pre: misPre, post: misPost, relativeReduction: misDrop },
    lessonCompletionRate: completion,
    parentEaseOfUse: { n: feedback.length, mean: ease },
    targets: {
      relativeGainAtLeast20pct: relGain === null ? null : relGain >= 0.2,
      misconceptionReductionAtLeast30pct: misDrop === null ? null : misDrop >= 0.3,
      completionAtLeast70pct: completion === null ? null : completion >= 0.7,
      easeAtLeast4of5: ease === null ? null : ease >= 4,
    },
    caveat: "Mẫu pilot nhỏ, không phải thử nghiệm đối chứng; các ngưỡng là đề xuất cần xác nhận. Không dùng để kết luận nhân quả.",
  };
}

export function pilotRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/v1/feedback", async (req, reply) => {
    const a = requireParent(req);
    const b = parse(z.object({ ease: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }), req.body);
    await ctx.db.query("INSERT INTO parent_feedback(id, parent_ref, ease, comment, created_at) VALUES ($1,$2,$3,$4,$5)", [randomUUID(), ctx.hasher.ref(a.userId), b.ease, b.comment ?? null, ctx.now()]);
    reply.code(201);
    return { ok: true };
  });

  // Xuất dữ liệu pilot đã ẩn danh: mã người tham gia là băm có muối, không chứa PII; chỉ tổng hợp điểm/bài/thời gian.
  app.get("/api/v1/admin/pilot-export", async (req) => {
    const a = requireAdmin(req);
    const rows = (await ctx.db.query<{ id: string; level: number }>("SELECT id, level FROM children WHERE status='ACTIVE'")).rows;
    const out: PilotParticipant[] = [];
    for (const c of rows) {
      const pid = createHmac("sha256", "pilot-export").update(ctx.hasher.ref(c.id)).digest("hex").slice(0, 16);
      const res = (await ctx.db.query<{ kind: string; score: number; max_score: number }>("SELECT kind, score, max_score FROM assessment_results WHERE child_id=$1 ORDER BY created_at", [c.id])).rows;
      const pct = (kind: string, pick: "first" | "last") => { const x = res.filter((r) => r.kind === kind); const r = pick === "first" ? x[0] : x.at(-1); return r ? (100 * r.score) / r.max_score : null; };
      // "tin quan niệm sai" = 1 − tỉ lệ bác bỏ đúng
      const belief = (pick: "first" | "last") => { const p = pct("misconception", pick); return p === null ? null : 100 - p; };
      const mis = res.filter((r) => r.kind === "misconception").length;
      const lp = (await ctx.db.query<{ status: string }>("SELECT status FROM lesson_progress WHERE child_id=$1", [c.id])).rows;
      const secs = (await ctx.db.query<{ n: number }>("SELECT COALESCE(SUM(seconds),0)::int AS n FROM usage_days WHERE child_id=$1", [c.id])).rows[0]!.n;
      out.push({
        pid, level: c.level, prePct: pct("pre", "first"), postPct: pct("post", "last"),
        misconceptionBeliefPre: belief("first"), misconceptionBeliefPost: mis >= 2 ? belief("last") : null,
        lessonsStarted: lp.length, lessonsCompleted: lp.filter((x) => x.status === "completed").length, minutesTotal: Math.round(secs / 60),
      });
    }
    const fb = (await ctx.db.query<{ ease: number }>("SELECT ease FROM parent_feedback")).rows.map((r) => r.ease);
    await audit(ctx, ctx.hasher.ref(a.userId), "pilot.export");
    return { participants: out, metrics: computePilotMetrics(out, fb) };
  });
}
