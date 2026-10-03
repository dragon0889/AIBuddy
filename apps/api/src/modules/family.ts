import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ageInYears, createChildProfile, transition, type AccountStatus, type ConsentEvent } from "@aibuddy/shared";
import type { AppContext } from "../context.ts";
import { audit } from "../lib/audit.ts";
import { hashSecret, verifySecret } from "../lib/crypto.ts";
import { AppError, badRequest, forbidden, notFound, parse, tooMany } from "../lib/errors.ts";
import { issueOtp, verifyOtp } from "../lib/otp.ts";
import { COOKIE, createSession, destroySessions, requireChild, requireParent } from "../lib/session.ts";
import { emailOf } from "./auth.ts";
import { requestChildErasure, requestParentErasure, processErasures } from "./erasure.ts";

export const AVATARS = ["fox", "owl", "cat", "panda", "robot", "whale", "rabbit", "turtle"] as const;

export interface ChildRow {
  id: string; parent_id: string; nickname_enc: string; birth_enc: string; level: 1 | 2 | 3; avatar: string; pin_hash: string;
  pin_failed: number; pin_locked_until: Date | null; status: AccountStatus; guardian_verified: boolean; child_agreed: boolean;
  age_at_creation: number; camera_allowed: boolean; created_at: Date; consent_expires_at: Date;
}

const levelForAge = (age: number): 1 | 2 | 3 => (age <= 7 ? 1 : age <= 10 ? 2 : 3);

/** Chỉ trả về hồ sơ của chính phụ huynh; ngược lại 404 (không lộ sự tồn tại – chống IDOR). */
export async function ownedChild(ctx: AppContext, parentId: string, childId: string): Promise<ChildRow> {
  if (!/^[0-9a-f-]{36}$/i.test(childId)) throw notFound();
  const r = await ctx.db.query<ChildRow>("SELECT * FROM children WHERE id=$1 AND parent_id=$2", [childId, parentId]);
  if (!r.rows[0]) throw notFound();
  return r.rows[0];
}

export async function childSummary(ctx: AppContext, c: ChildRow) {
  return {
    id: c.id, nickname: await ctx.keys.decrypt(c.id, c.nickname_enc), level: c.level, avatar: c.avatar, status: c.status,
    guardianVerified: c.guardian_verified, childAgreed: c.child_agreed, cameraAllowed: c.camera_allowed,
    needsChildAgreement: c.age_at_creation >= 7, consentExpiresAt: c.consent_expires_at,
  };
}

async function verifiedParentEmail(ctx: AppContext, parentId: string): Promise<string> {
  const r = await ctx.db.query<{ email_verified: boolean; phone_enc: string | null }>("SELECT email_verified, phone_enc FROM users WHERE id=$1", [parentId]);
  if (!r.rows[0]?.email_verified) throw forbidden("email_not_verified");
  return emailOf(ctx, parentId);
}

async function sendConsentOtp(ctx: AppContext, parentId: string, childId: string) {
  const email = await verifiedParentEmail(ctx, parentId);
  const phoneEnc = (await ctx.db.query<{ phone_enc: string | null }>("SELECT phone_enc FROM users WHERE id=$1", [parentId])).rows[0]!.phone_enc;
  const targets: { channel: "email" | "sms"; to: string }[] = [{ channel: "email", to: email }];
  if (phoneEnc) targets.push({ channel: "sms", to: await ctx.keys.decrypt(parentId, phoneEnc) });
  await issueOtp(ctx, childId, "guardian_consent", targets);
}

async function consentEvent(ctx: AppContext, childId: string, actor: "guardian" | "child" | "system", type: string) {
  await ctx.db.query("INSERT INTO consent_events(id, child_ref, actor, type, terms_version, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [randomUUID(), ctx.hasher.ref(childId), actor, type, ctx.config.termsVersion, ctx.now()]);
}

async function applyConsent(ctx: AppContext, c: ChildRow, event: ConsentEvent) {
  const next = transition({ status: c.status, age: c.age_at_creation, guardianVerified: c.guardian_verified, childAgreed: c.child_agreed }, event);
  await ctx.db.query("UPDATE children SET status=$2, guardian_verified=$3, child_agreed=$4 WHERE id=$1", [c.id, next.status, next.guardianVerified, next.childAgreed]);
  if (next.status === "ACTIVE" && c.status !== "ACTIVE") {
    // Privacy by Default: giới hạn thời gian mặc định; camera tắt cho tới khi phụ huynh bật.
    await ctx.db.query("INSERT INTO screen_time_rules(child_id, daily_minutes) VALUES ($1,$2) ON CONFLICT DO NOTHING", [c.id, ctx.config.defaultDailyMinutes]);
    await audit(ctx, ctx.hasher.ref(c.parent_id), "child.activated", { type: "child", ref: ctx.hasher.ref(c.id) });
  }
  return next;
}

export const todayKey = (ctx: AppContext) => ctx.now().toISOString().slice(0, 10);

export async function remainingSeconds(ctx: AppContext, childId: string): Promise<number> {
  const rule = await ctx.db.query<{ daily_minutes: number }>("SELECT daily_minutes FROM screen_time_rules WHERE child_id=$1", [childId]);
  const used = await ctx.db.query<{ seconds: number }>("SELECT seconds FROM usage_days WHERE child_id=$1 AND day=$2", [childId, todayKey(ctx)]);
  return Math.max(0, (rule.rows[0]?.daily_minutes ?? ctx.config.defaultDailyMinutes) * 60 - (used.rows[0]?.seconds ?? 0));
}

const createChildBody = z.object({
  nickname: z.string().trim().min(1).max(30),
  birthYear: z.number().int().min(2000).max(2100),
  birthMonth: z.number().int().min(1).max(12),
  avatar: z.enum(AVATARS),
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export function familyRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/v1/children", async (req, reply) => {
    const a = requireParent(req);
    await verifiedParentEmail(ctx, a.userId);
    const b = parse(createChildBody, req.body);
    const age = ageInYears(b.birthYear, b.birthMonth, ctx.now());
    if (age < 6 || age > 15) throw badRequest("age_out_of_range", "Nền tảng dành cho trẻ 6–15 tuổi");
    const count = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM children WHERE parent_id=$1 AND status NOT IN ('EXPIRED','ERASED')", [a.userId])).rows[0]!.n;
    if (count >= 6) throw badRequest("too_many_children");
    const id = randomUUID();
    const state = createChildProfile(age);
    await ctx.db.query(
      `INSERT INTO children(id, parent_id, nickname_enc, birth_enc, level, avatar, pin_hash, status, age_at_creation, created_at, consent_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, a.userId, await ctx.keys.encrypt(id, b.nickname), await ctx.keys.encrypt(id, `${b.birthYear}-${String(b.birthMonth).padStart(2, "0")}`),
        levelForAge(age), b.avatar, await hashSecret(b.pin), state.status, age, ctx.now(), new Date(ctx.now().getTime() + ctx.config.consentTtlDays * 86_400_000)],
    );
    await consentEvent(ctx, id, "guardian", "profile_created");
    await audit(ctx, ctx.hasher.ref(a.userId), "child.created", { type: "child", ref: ctx.hasher.ref(id) });
    await sendConsentOtp(ctx, a.userId, id);
    reply.code(201);
    return childSummary(ctx, await ownedChild(ctx, a.userId, id));
  });

  app.get("/api/v1/children", async (req) => {
    const a = requireParent(req);
    const r = await ctx.db.query<ChildRow>("SELECT * FROM children WHERE parent_id=$1 AND status NOT IN ('EXPIRED','ERASED') ORDER BY created_at", [a.userId]);
    return { children: await Promise.all(r.rows.map((c) => childSummary(ctx, c))) };
  });

  app.post("/api/v1/children/:id/consent/resend", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    if (c.status !== "PENDING_PARENT_CONSENT") throw badRequest("not_pending");
    await sendConsentOtp(ctx, a.userId, c.id);
    return { sent: true };
  });

  app.post("/api/v1/children/:id/consent/guardian", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    const b = parse(z.object({ code: z.string().regex(/^\d{6}$/), termsVersion: z.string(), cameraAllowed: z.boolean().default(false) }), req.body);
    if (b.termsVersion !== ctx.config.termsVersion) throw badRequest("terms_version_mismatch");
    if (c.status !== "PENDING_PARENT_CONSENT") throw badRequest("not_pending");
    if (new Date(c.consent_expires_at) <= ctx.now()) throw badRequest("consent_expired");
    await verifyOtp(ctx, c.id, "guardian_consent", b.code);
    const next = await applyConsent(ctx, c, { type: "GUARDIAN_VERIFIED" });
    await ctx.db.query("UPDATE children SET camera_allowed=$2 WHERE id=$1", [c.id, b.cameraAllowed]);
    await consentEvent(ctx, c.id, "guardian", "guardian_consented");
    return childSummary(ctx, { ...c, status: next.status, guardian_verified: next.guardianVerified, child_agreed: next.childAgreed, camera_allowed: b.cameraAllowed });
  });

  // Trẻ (từ 7 tuổi) bấm "Con đồng ý" trên thiết bị của phụ huynh. Hệ thống không chứng minh được ai bấm (ghi nhận trong DPIA).
  app.post("/api/v1/children/:id/consent/child", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    if (c.age_at_creation < 7) throw badRequest("child_agreement_not_required");
    if (c.status !== "PENDING_PARENT_CONSENT") throw badRequest("not_pending");
    const next = await applyConsent(ctx, c, { type: "CHILD_AGREED" });
    await consentEvent(ctx, c.id, "child", "child_agreed");
    return childSummary(ctx, { ...c, status: next.status, guardian_verified: next.guardianVerified, child_agreed: next.childAgreed });
  });

  app.put("/api/v1/children/:id/settings", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    const b = parse(z.object({ dailyMinutes: z.number().int().min(5).max(240).optional(), cameraAllowed: z.boolean().optional() }), req.body);
    if (c.status !== "ACTIVE") throw badRequest("child_not_active");
    if (b.dailyMinutes !== undefined) await ctx.db.query("INSERT INTO screen_time_rules(child_id, daily_minutes) VALUES ($1,$2) ON CONFLICT (child_id) DO UPDATE SET daily_minutes=$2", [c.id, b.dailyMinutes]);
    if (b.cameraAllowed !== undefined) await ctx.db.query("UPDATE children SET camera_allowed=$2 WHERE id=$1", [c.id, b.cameraAllowed]);
    await audit(ctx, ctx.hasher.ref(a.userId), "child.settings_changed", { type: "child", ref: ctx.hasher.ref(c.id) }, { ...b });
    return { ok: true };
  });

  // Thu hồi đồng ý = yêu cầu xóa dữ liệu của con (FR-011).
  app.post("/api/v1/children/:id/withdraw", async (req) => {
    const a = requireParent(req);
    const c = await ownedChild(ctx, a.userId, (req.params as { id: string }).id);
    const requestId = await requestChildErasure(ctx, c.id, ctx.hasher.ref(a.userId), "consent_withdrawn");
    await consentEvent(ctx, c.id, "guardian", "consent_withdrawn");
    await processErasures(ctx);
    return { requestId, status: "ERASED_OR_PENDING", slaHours: ctx.config.erasureSlaHours };
  });

  // Xóa toàn bộ tài khoản phụ huynh + dữ liệu con. Yêu cầu nhập lại mật khẩu.
  app.post("/api/v1/account/erase", async (req, reply) => {
    const a = requireParent(req);
    const { password } = parse(z.object({ password: z.string() }), req.body);
    const u = await ctx.db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [a.userId]);
    if (!(await verifySecret(password, u.rows[0]!.password_hash))) throw new AppError(401, "invalid_credentials");
    const requestId = await requestParentErasure(ctx, a.userId, ctx.hasher.ref(a.userId));
    await processErasures(ctx);
    reply.clearCookie(COOKIE.session, { path: "/" }).clearCookie(COOKIE.child, { path: "/" });
    return { requestId };
  });

  // ----- Chuyển hồ sơ (thiết bị dùng chung) -----
  app.post("/api/v1/auth/profile-switch", async (req, reply) => {
    const a = requireParent(req);
    const b = parse(z.object({ childId: z.string(), pin: z.string().regex(/^\d{4}$/) }), req.body);
    const c = await ownedChild(ctx, a.userId, b.childId);
    if (c.status !== "ACTIVE") throw forbidden("child_not_active");
    const now = ctx.now();
    if (c.pin_locked_until && new Date(c.pin_locked_until) > now) throw tooMany("pin_locked");
    if (!(await verifySecret(b.pin, c.pin_hash))) {
      const failed = c.pin_failed + 1;
      await ctx.db.query("UPDATE children SET pin_failed=$2, pin_locked_until=$3 WHERE id=$1", [c.id, failed >= 5 ? 0 : failed, failed >= 5 ? new Date(now.getTime() + 5 * 60_000) : null]);
      throw new AppError(401, "invalid_pin");
    }
    await ctx.db.query("UPDATE children SET pin_failed=0, pin_locked_until=NULL WHERE id=$1", [c.id]);
    const left = await remainingSeconds(ctx, c.id);
    if (left <= 0) throw forbidden("screen_time_exceeded");
    await destroySessions(ctx, { childId: c.id });
    await createSession(ctx, reply, "child", a.userId, Math.min(ctx.config.childSessionMinutes * 60_000, left * 1000), c.id);
    return { child: await childSummary(ctx, c), remainingSeconds: left };
  });

  app.post("/api/v1/child/exit", async (req, reply) => {
    const a = requireChild(req);
    await destroySessions(ctx, { tokenHash: a.tokenHash });
    reply.clearCookie(COOKIE.child, { path: "/" });
    return { ok: true };
  });

  // Nhịp tim: cộng thời gian sử dụng; hết giờ thì khóa hồ sơ (ADD-05: giới hạn thời gian mặc định).
  app.post("/api/v1/child/heartbeat", async (req, reply) => {
    const a = requireChild(req);
    const { seconds } = parse(z.object({ seconds: z.number().int().min(1).max(60) }), req.body);
    await ctx.db.query(
      "INSERT INTO usage_days(child_id, day, seconds) VALUES ($1,$2,$3) ON CONFLICT (child_id, day) DO UPDATE SET seconds = usage_days.seconds + $3",
      [a.childId, todayKey(ctx), seconds]);
    const left = await remainingSeconds(ctx, a.childId);
    if (left <= 0) {
      await destroySessions(ctx, { tokenHash: a.tokenHash });
      reply.clearCookie(COOKIE.child, { path: "/" });
      throw forbidden("screen_time_exceeded");
    }
    return { remainingSeconds: left };
  });
}

/** Dùng cho mọi route trẻ em: kiểm tra phiên, hồ sơ còn hoạt động và còn thời gian. */
export async function activeChild(ctx: AppContext, req: import("fastify").FastifyRequest): Promise<ChildRow> {
  const a = requireChild(req);
  const r = await ctx.db.query<ChildRow>("SELECT * FROM children WHERE id=$1", [a.childId]);
  const c = r.rows[0];
  if (!c || c.status !== "ACTIVE") throw forbidden("child_not_active");
  if ((await remainingSeconds(ctx, c.id)) <= 0) throw forbidden("screen_time_exceeded");
  return c;
}
