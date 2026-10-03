import { randomUUID } from "node:crypto";
import type { Db } from "../db/index.ts";
import type { AppContext } from "../context.ts";
import { audit } from "../lib/audit.ts";
import { sha256 } from "../lib/crypto.ts";
import { destroySessions } from "../lib/session.ts";

/**
 * Xóa dữ liệu (FR-011): xóa bản ghi + crypto-shredding (hủy khóa dữ liệu của chủ thể).
 * Dữ liệu còn trong bản sao lưu mã hóa trở nên không giải mã được ngay khi khóa bị hủy.
 * Hạn chót (SLA) 72 giờ ghi ở `due_at`; job `processErasures` xử lý ngay khi chạy.
 */
export async function requestChildErasure(ctx: AppContext, childId: string, actorRef: string, reason: string): Promise<string> {
  const now = ctx.now();
  const open = await ctx.db.query<{ id: string }>("SELECT id FROM erasure_requests WHERE subject_id=$1 AND done_at IS NULL", [childId]);
  if (open.rows[0]) return open.rows[0].id;
  const id = randomUUID();
  await ctx.db.query("UPDATE children SET status='ERASURE_REQUESTED' WHERE id=$1 AND status<>'ERASED'", [childId]);
  await ctx.db.query(
    "INSERT INTO erasure_requests(id, subject_type, subject_ref, subject_id, requested_at, due_at) VALUES ($1,'child',$2,$3,$4,$5)",
    [id, ctx.hasher.ref(childId), childId, now, new Date(now.getTime() + ctx.config.erasureSlaHours * 3_600_000)],
  );
  await destroySessions(ctx, { childId });
  await audit(ctx, actorRef, "erasure.requested", { type: "child", ref: ctx.hasher.ref(childId) }, { reason });
  return id;
}

export async function requestParentErasure(ctx: AppContext, parentId: string, actorRef: string): Promise<string> {
  const now = ctx.now();
  const open = await ctx.db.query<{ id: string }>("SELECT id FROM erasure_requests WHERE subject_id=$1 AND done_at IS NULL", [parentId]);
  if (open.rows[0]) return open.rows[0].id;
  const id = randomUUID();
  await ctx.db.query("UPDATE users SET status='ERASURE_REQUESTED' WHERE id=$1", [parentId]);
  await ctx.db.query("UPDATE children SET status='ERASURE_REQUESTED' WHERE parent_id=$1", [parentId]);
  await ctx.db.query(
    "INSERT INTO erasure_requests(id, subject_type, subject_ref, subject_id, requested_at, due_at) VALUES ($1,'parent',$2,$3,$4,$5)",
    [id, ctx.hasher.ref(parentId), parentId, now, new Date(now.getTime() + ctx.config.erasureSlaHours * 3_600_000)],
  );
  await destroySessions(ctx, { userId: parentId });
  await audit(ctx, actorRef, "erasure.requested", { type: "parent", ref: ctx.hasher.ref(parentId) });
  return id;
}

async function eraseChildRows(db: Db, childId: string): Promise<number> {
  await db.query("DELETE FROM otp_codes WHERE subject_id=$1", [childId]);
  // lesson_progress, step_results, xp_events, user_badges, assessment_results, usage_days, ... xóa theo ON DELETE CASCADE.
  return (await db.query("DELETE FROM children WHERE id=$1", [childId])).rowCount;
}

export async function processErasures(ctx: AppContext): Promise<{ processed: number; overdue: number }> {
  const open = await ctx.db.query<{ id: string; subject_type: "child" | "parent"; subject_id: string; subject_ref: string; due_at: Date }>(
    "SELECT id, subject_type, subject_id, subject_ref, due_at FROM erasure_requests WHERE done_at IS NULL ORDER BY requested_at");
  let overdue = 0;
  for (const r of open.rows) {
    const now = ctx.now();
    if (new Date(r.due_at) < now) overdue++;
    const subjects: string[] = [r.subject_id];
    let rows = 0;
    if (r.subject_type === "child") {
      rows += await eraseChildRows(ctx.db, r.subject_id);
    } else {
      const kids = await ctx.db.query<{ id: string }>("SELECT id FROM children WHERE parent_id=$1", [r.subject_id]);
      for (const k of kids.rows) { rows += await eraseChildRows(ctx.db, k.id); subjects.push(k.id); }
      await ctx.db.query("DELETE FROM otp_codes WHERE subject_id=$1", [r.subject_id]);
      rows += (await ctx.db.query("DELETE FROM users WHERE id=$1", [r.subject_id])).rowCount; // cascade: sessions
    }
    let shredded = 0;
    for (const s of subjects) if (await ctx.keys.shred(s)) shredded++;
    // Chứng từ xóa: băm, không chứa PII.
    const proof = sha256(JSON.stringify({ ref: r.subject_ref, rows, shredded, at: now.toISOString() }));
    await ctx.db.query("UPDATE erasure_requests SET done_at=$2, proof=$3 WHERE id=$1", [r.id, now, proof]);
    await audit(ctx, "system", "erasure.completed", { type: r.subject_type, ref: r.subject_ref }, { rows, keysShredded: shredded, proof });
  }
  return { processed: open.rows.length, overdue };
}

/** Hồ sơ chờ đồng ý quá hạn → coi như hết hạn và xóa (SRS 7.1; tối thiểu hóa dữ liệu). */
export async function expirePendingConsents(ctx: AppContext): Promise<number> {
  const now = ctx.now();
  const r = await ctx.db.query<{ id: string }>("SELECT id FROM children WHERE status='PENDING_PARENT_CONSENT' AND consent_expires_at < $1", [now]);
  for (const c of r.rows) {
    await ctx.db.query("UPDATE children SET status='EXPIRED' WHERE id=$1", [c.id]);
    await requestChildErasure(ctx, c.id, "system", "consent_expired");
  }
  return r.rows.length;
}

export async function runMaintenance(ctx: AppContext) {
  const expired = await expirePendingConsents(ctx);
  const er = await processErasures(ctx);
  await ctx.db.query("DELETE FROM sessions WHERE expires_at < $1", [ctx.now()]);
  return { expired, ...er };
}
