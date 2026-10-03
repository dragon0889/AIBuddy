import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.ts";
import { audit } from "../lib/audit.ts";
import { hashSecret, verifySecret, verifyTotp } from "../lib/crypto.ts";
import { AppError, conflict, parse, unauthorized } from "../lib/errors.ts";
import { issueOtp, verifyOtp } from "../lib/otp.ts";
import { COOKIE, createSession, destroySessions, requireParent } from "../lib/session.ts";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10, "min 10 characters").max(200);

const registerBody = z.object({
  email,
  password,
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/).optional(),
  locale: z.enum(["vi", "en"]).default("vi"),
  acceptTerms: z.literal(true),
});
const loginBody = z.object({ email, password: z.string().max(200), totp: z.string().optional() });

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashSecret("dummy-password-for-timing"));

export async function emailOf(ctx: AppContext, userId: string): Promise<string> {
  const r = await ctx.db.query<{ email_enc: string }>("SELECT email_enc FROM users WHERE id=$1", [userId]);
  return ctx.keys.decrypt(userId, r.rows[0]!.email_enc);
}

export function authRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/v1/auth/register", async (req, reply) => {
    const body = parse(registerBody, req.body);
    ctx.rate.check(`register:${req.ip}`, 10, 60 * 60_000);
    const id = randomUUID();
    const emailHash = ctx.hasher.ref(body.email);
    const exists = await ctx.db.query("SELECT 1 FROM users WHERE email_hash=$1", [emailHash]);
    if (exists.rows.length) throw conflict("email_in_use");
    const passwordHash = await hashSecret(body.password);
    // Lưu ý: không bọc trong db.tx vì KeyService dùng kết nối chính (PGlite tuần tự hoá → deadlock).
    await ctx.db.query(
      "INSERT INTO users(id, role, email_hash, email_enc, phone_enc, password_hash, locale, created_at) VALUES ($1,'parent',$2,$3,$4,$5,$6,$7)",
      [id, emailHash, await ctx.keys.encrypt(id, body.email), body.phone ? await ctx.keys.encrypt(id, body.phone) : null, passwordHash, body.locale, ctx.now()],
    );
    await audit(ctx, ctx.hasher.ref(id), "parent.register", { type: "user", ref: ctx.hasher.ref(id) });
    await issueOtp(ctx, id, "email_verify", [{ channel: "email", to: body.email }]);
    await createSession(ctx, reply, "parent", id, ctx.config.parentSessionHours * 3_600_000);
    reply.code(201);
    return { id, role: "parent", emailVerified: false, locale: body.locale };
  });

  app.post("/api/v1/auth/verify-email", async (req) => {
    const a = requireParent(req);
    const { code } = parse(z.object({ code: z.string().regex(/^\d{6}$/) }), req.body);
    await verifyOtp(ctx, a.userId, "email_verify", code);
    await ctx.db.query("UPDATE users SET email_verified=true WHERE id=$1", [a.userId]);
    await audit(ctx, ctx.hasher.ref(a.userId), "parent.email_verified");
    return { emailVerified: true };
  });

  app.post("/api/v1/auth/resend-email-otp", async (req) => {
    const a = requireParent(req);
    await issueOtp(ctx, a.userId, "email_verify", [{ channel: "email", to: await emailOf(ctx, a.userId) }]);
    return { sent: true };
  });

  app.post("/api/v1/auth/login", async (req, reply) => {
    const body = parse(loginBody, req.body);
    const emailHash = ctx.hasher.ref(body.email);
    ctx.rate.check(`login:ip:${req.ip}`, 30, 15 * 60_000);
    ctx.rate.check(`login:acct:${emailHash}`, 8, 15 * 60_000); // chống dò mật khẩu theo tài khoản
    const r = await ctx.db.query<{ id: string; role: "parent" | "admin"; password_hash: string; totp_secret_enc: string | null; email_verified: boolean; locale: string; status: string }>(
      "SELECT id, role, password_hash, totp_secret_enc, email_verified, locale, status FROM users WHERE email_hash=$1", [emailHash]);
    const u = r.rows[0];
    // Luôn chạy verify để thời gian phản hồi không lộ việc email có tồn tại hay không.
    const ok = await verifySecret(body.password, u?.password_hash ?? (await dummyHash()));
    if (!u || !ok || u.status !== "ACTIVE") throw unauthorized("invalid_credentials");
    if (u.role === "admin") {
      // 2FA bắt buộc cho Admin (SRS 2.2).
      if (!u.totp_secret_enc) throw new AppError(403, "totp_not_configured");
      const secret = await ctx.keys.decrypt(u.id, u.totp_secret_enc);
      if (!body.totp || !verifyTotp(secret, body.totp, ctx.now().getTime())) throw unauthorized("totp_required_or_invalid");
    }
    ctx.rate.reset(`login:acct:${emailHash}`);
    await createSession(ctx, reply, u.role, u.id, (u.role === "admin" ? 8 : ctx.config.parentSessionHours) * 3_600_000);
    await audit(ctx, ctx.hasher.ref(u.id), `${u.role}.login`);
    return { id: u.id, role: u.role, emailVerified: u.email_verified, locale: u.locale };
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    for (const a of [req.auth.session, req.auth.child]) if (a) await destroySessions(ctx, { tokenHash: a.tokenHash });
    if (req.auth.session?.kind === "parent") await destroySessions(ctx, { userId: req.auth.session.userId }).catch(() => {});
    reply.clearCookie(COOKIE.session, { path: "/" }).clearCookie(COOKIE.child, { path: "/" });
    return { ok: true };
  });

  app.get("/api/v1/auth/me", async (req) => {
    const a = req.auth.session;
    if (!a) throw unauthorized();
    const r = await ctx.db.query<{ role: string; email_verified: boolean; locale: string }>("SELECT role, email_verified, locale FROM users WHERE id=$1", [a.userId]);
    const u = r.rows[0]!;
    return { id: a.userId, role: u.role, emailVerified: u.email_verified, locale: u.locale };
  });
}
