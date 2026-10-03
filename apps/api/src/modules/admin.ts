import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lesson } from "@aibuddy/content";
import type { AppContext } from "../context.ts";
import { audit } from "../lib/audit.ts";
import { hashSecret, newTotpSecret } from "../lib/crypto.ts";
import { badRequest, forbidden, notFound, parse } from "../lib/errors.ts";
import { requireAdmin } from "../lib/session.ts";
import { runMaintenance } from "./erasure.ts";

/** Tạo tài khoản Admin (chỉ qua CLI/seed, không có API đăng ký). Trả secret TOTP để quét vào ứng dụng xác thực. */
export async function createAdmin(ctx: AppContext, email: string, password: string): Promise<{ id: string; totpSecret: string; otpauthUri: string }> {
  if (password.length < 12) throw new Error("admin password must be at least 12 characters");
  const id = randomUUID();
  const secret = newTotpSecret();
  const norm = email.trim().toLowerCase();
  if ((await ctx.db.query("SELECT 1 FROM users WHERE email_hash=$1", [ctx.hasher.ref(norm)])).rows.length) throw new Error("email in use");
  await ctx.db.query(
    "INSERT INTO users(id, role, email_hash, email_enc, password_hash, totp_secret_enc, email_verified, created_at) VALUES ($1,'admin',$2,$3,$4,$5,true,$6)",
    [id, ctx.hasher.ref(norm), await ctx.keys.encrypt(id, norm), await hashSecret(password), await ctx.keys.encrypt(id, secret), ctx.now()]);
  await audit(ctx, "system", "admin.created", { type: "user", ref: ctx.hasher.ref(id) });
  return { id, totpSecret: secret, otpauthUri: `otpauth://totp/AIBuddy:${encodeURIComponent(norm)}?secret=${secret}&issuer=AIBuddy` };
}

/** Khi khởi động: nạp lại các bài đã được duyệt xuất bản từ DB (CMS). */
export async function loadPublished(ctx: AppContext): Promise<number> {
  const r = await ctx.db.query<{ body: unknown }>("SELECT DISTINCT ON (lesson_id) body FROM content_drafts WHERE status='published' ORDER BY lesson_id, version DESC");
  for (const row of r.rows) ctx.content.publish(lesson.parse(row.body));
  return r.rows.length;
}

export function adminRoutes(app: FastifyInstance, ctx: AppContext): void {
  const actor = (userId: string) => ctx.hasher.ref(userId);

  app.get("/api/v1/admin/lessons", async (req) => {
    requireAdmin(req);
    const drafts = await ctx.db.query<{ id: string; lesson_id: string; version: number; status: string; author_id: string; reviewer_id: string | null }>(
      "SELECT id, lesson_id, version, status, author_id, reviewer_id FROM content_drafts ORDER BY lesson_id, version DESC");
    return { published: ctx.content.lessons().map((l) => ({ id: l.id, level: l.level, title: l.title.vi })), drafts: drafts.rows };
  });

  // Soạn bài: kiểm tra schema đầy đủ (outcome hợp lệ, parentGuide bắt buộc, quy tắc Level 1…).
  app.post("/api/v1/admin/drafts", async (req, reply) => {
    const a = requireAdmin(req);
    const body = lesson.safeParse((req.body as { lesson?: unknown })?.lesson);
    if (!body.success) throw badRequest("lesson_invalid", body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const known = new Set(ctx.content.outcomes().map((o) => o.id));
    const bad = body.data.outcomes.filter((o) => !known.has(o));
    if (bad.length) throw badRequest("unknown_outcome", bad.join(","));
    const v = (await ctx.db.query<{ v: number }>("SELECT COALESCE(MAX(version),0)::int AS v FROM content_drafts WHERE lesson_id=$1", [body.data.id])).rows[0]!.v + 1;
    const id = randomUUID();
    await ctx.db.query("INSERT INTO content_drafts(id, lesson_id, version, body, status, author_id, created_at, updated_at) VALUES ($1,$2,$3,$4,'draft',$5,$6,$6)",
      [id, body.data.id, v, JSON.stringify(body.data), a.userId, ctx.now()]);
    await audit(ctx, actor(a.userId), "cms.draft_created", { type: "lesson", ref: body.data.id }, { version: v });
    reply.code(201);
    return { id, lessonId: body.data.id, version: v, status: "draft" };
  });

  const load = async (id: string) => {
    const r = await ctx.db.query<{ id: string; lesson_id: string; status: string; author_id: string; body: unknown }>("SELECT id, lesson_id, status, author_id, body FROM content_drafts WHERE id=$1", [id]);
    if (!r.rows[0]) throw notFound();
    return r.rows[0];
  };

  app.post("/api/v1/admin/drafts/:id/submit", async (req) => {
    const a = requireAdmin(req);
    const d = await load((req.params as { id: string }).id);
    if (d.status !== "draft") throw badRequest("not_a_draft");
    if (d.author_id !== a.userId) throw forbidden("only_author_can_submit");
    await ctx.db.query("UPDATE content_drafts SET status='in_review', updated_at=$2 WHERE id=$1", [d.id, ctx.now()]);
    await audit(ctx, actor(a.userId), "cms.submitted", { type: "lesson", ref: d.lesson_id });
    return { status: "in_review" };
  });

  // Duyệt 2 bước (T9): người duyệt phải khác tác giả.
  app.post("/api/v1/admin/drafts/:id/review", async (req) => {
    const a = requireAdmin(req);
    const d = await load((req.params as { id: string }).id);
    const { decision } = parse(z.object({ decision: z.enum(["approve", "reject"]) }), req.body);
    if (d.status !== "in_review") throw badRequest("not_in_review");
    if (d.author_id === a.userId) throw forbidden("reviewer_must_differ_from_author");
    if (decision === "reject") {
      await ctx.db.query("UPDATE content_drafts SET status='rejected', reviewer_id=$2, updated_at=$3 WHERE id=$1", [d.id, a.userId, ctx.now()]);
      await audit(ctx, actor(a.userId), "cms.rejected", { type: "lesson", ref: d.lesson_id });
      return { status: "rejected" };
    }
    const parsed = lesson.parse(d.body);
    await ctx.db.query("UPDATE content_drafts SET status='published', reviewer_id=$2, updated_at=$3 WHERE id=$1", [d.id, a.userId, ctx.now()]);
    ctx.content.publish(parsed);
    await audit(ctx, actor(a.userId), "cms.published", { type: "lesson", ref: d.lesson_id });
    return { status: "published" };
  });

  app.get("/api/v1/admin/audit-logs", async (req) => {
    requireAdmin(req);
    const { limit, action } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100), action: z.string().optional() }), req.query);
    const r = await ctx.db.query("SELECT id, actor_ref, action, target_type, target_ref, meta, created_at FROM audit_logs WHERE ($2::text IS NULL OR action=$2) ORDER BY created_at DESC LIMIT $1", [limit, action ?? null]);
    return { logs: r.rows };
  });

  app.post("/api/v1/admin/maintenance/run", async (req) => {
    const a = requireAdmin(req);
    const r = await runMaintenance(ctx);
    await audit(ctx, actor(a.userId), "maintenance.run", undefined, { ...r });
    return r;
  });

  // Báo cáo tuân thủ (SRS 2.2: xuất báo cáo tuân thủ NĐ13). Chỉ số tổng hợp, không có PII.
  app.get("/api/v1/admin/compliance-report", async (req) => {
    const a = requireAdmin(req);
    const q = async <T>(sql: string, p: unknown[] = []) => (await ctx.db.query<T>(sql, p)).rows;
    const children = await q<{ status: string; n: number }>("SELECT status, count(*)::int AS n FROM children GROUP BY status");
    const consent = await q<{ type: string; actor: string; n: number }>("SELECT type, actor, count(*)::int AS n FROM consent_events GROUP BY type, actor");
    const er = (await q<{ total: number; done: number; overdue_open: number; max_hours: number | null }>(
      `SELECT count(*)::int AS total, count(done_at)::int AS done,
              count(*) FILTER (WHERE done_at IS NULL AND due_at < $1)::int AS overdue_open,
              MAX(EXTRACT(EPOCH FROM (done_at - requested_at))/3600) AS max_hours FROM erasure_requests`, [ctx.now()]))[0]!;
    const cameraOn = (await q<{ n: number }>("SELECT count(*)::int AS n FROM children WHERE camera_allowed AND status='ACTIVE'"))[0]!.n;
    const lateCompletions = (await q<{ n: number }>("SELECT count(*)::int AS n FROM erasure_requests WHERE done_at IS NOT NULL AND done_at > due_at"))[0]!.n;
    await audit(ctx, actor(a.userId), "compliance.report_generated");
    return {
      generatedAt: ctx.now(), termsVersion: ctx.config.termsVersion, erasureSlaHours: ctx.config.erasureSlaHours,
      children: Object.fromEntries(children.map((c) => [c.status, c.n])),
      consentEvents: consent,
      erasure: { total: er.total, completed: er.done, openOverdue: er.overdue_open, completedLate: lateCompletions, maxHoursToComplete: er.max_hours },
      privacy: { activeChildrenWithCameraAllowed: cameraOn, rawMediaStoredOnServer: false, projectEventColumns: ["accuracy", "samples", "improved_after_review", "project"] },
      notes: ["Báo cáo tổng hợp, không chứa dữ liệu cá nhân.", "Cần DPO/pháp lý rà soát trước khi nộp hồ sơ theo NĐ 13/2023/NĐ-CP."],
    };
  });

}
