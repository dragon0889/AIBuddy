import { randomUUID } from "node:crypto";
import type { AppContext } from "../context.ts";

/** Ghi nhật ký bất biến. Tham chiếu là băm (không PII). */
export async function audit(ctx: AppContext, actorRef: string, action: string, target?: { type: string; ref: string }, meta: Record<string, unknown> = {}): Promise<void> {
  await ctx.db.query(
    "INSERT INTO audit_logs(id, actor_ref, action, target_type, target_ref, meta, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [randomUUID(), actorRef, action, target?.type ?? null, target?.ref ?? null, JSON.stringify(meta), ctx.now()],
  );
}
