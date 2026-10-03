import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.ts";
import { newToken, sha256 } from "./crypto.ts";
import { forbidden, unauthorized } from "./errors.ts";

export type AuthKind = "parent" | "admin" | "child";
export interface Auth { kind: AuthKind; userId: string; childId?: string; tokenHash: string }

declare module "fastify" {
  interface FastifyRequest { auth: { session?: Auth; child?: Auth } }
}

export const COOKIE = { session: "ab_session", child: "ab_child" } as const;

export async function createSession(ctx: AppContext, reply: FastifyReply, kind: AuthKind, userId: string, ttlMs: number, childId?: string): Promise<void> {
  const token = newToken();
  const now = ctx.now();
  await ctx.db.query(
    "INSERT INTO sessions(token_hash, kind, user_id, child_id, created_at, expires_at, last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$5)",
    [sha256(token), kind, userId, childId ?? null, now, new Date(now.getTime() + ttlMs)],
  );
  reply.setCookie(kind === "child" ? COOKIE.child : COOKIE.session, token, {
    httpOnly: true, sameSite: "lax", secure: ctx.config.isProd, path: "/", maxAge: Math.floor(ttlMs / 1000),
  });
}

export async function loadAuth(ctx: AppContext, req: FastifyRequest): Promise<void> {
  req.auth = {};
  const now = ctx.now();
  for (const [slot, name] of [["session", COOKIE.session], ["child", COOKIE.child]] as const) {
    const token = req.cookies[name];
    if (!token) continue;
    const h = sha256(token);
    const r = await ctx.db.query<{ kind: AuthKind; user_id: string; child_id: string | null; expires_at: Date; last_seen_at: Date }>(
      "SELECT kind, user_id, child_id, expires_at, last_seen_at FROM sessions WHERE token_hash=$1", [h]);
    const row = r.rows[0];
    if (!row || new Date(row.expires_at) <= now) continue;
    if (row.kind === "child" && now.getTime() - new Date(row.last_seen_at).getTime() > ctx.config.childIdleMinutes * 60_000) {
      await ctx.db.query("DELETE FROM sessions WHERE token_hash=$1", [h]);
      continue; // hết phiên do không hoạt động
    }
    if (row.kind === "child" && slot !== "child") continue;
    if (row.kind !== "child" && slot !== "session") continue;
    await ctx.db.query("UPDATE sessions SET last_seen_at=$2 WHERE token_hash=$1", [h, now]);
    req.auth[slot] = { kind: row.kind, userId: row.user_id, childId: row.child_id ?? undefined, tokenHash: h };
  }
}

export function requireParent(req: FastifyRequest): Auth {
  const a = req.auth.session;
  if (!a) throw unauthorized();
  if (a.kind !== "parent") throw forbidden();
  return a;
}
export function requireAdmin(req: FastifyRequest): Auth {
  const a = req.auth.session;
  if (!a) throw unauthorized();
  if (a.kind !== "admin") throw forbidden();
  return a;
}
export function requireChild(req: FastifyRequest): Auth & { childId: string } {
  const a = req.auth.child;
  if (!a?.childId) throw unauthorized("child_session_required");
  return a as Auth & { childId: string };
}

export async function destroySessions(ctx: AppContext, where: { userId?: string; childId?: string; tokenHash?: string }): Promise<void> {
  if (where.tokenHash) await ctx.db.query("DELETE FROM sessions WHERE token_hash=$1", [where.tokenHash]);
  if (where.childId) await ctx.db.query("DELETE FROM sessions WHERE child_id=$1", [where.childId]);
  if (where.userId) await ctx.db.query("DELETE FROM sessions WHERE user_id=$1", [where.userId]);
}
