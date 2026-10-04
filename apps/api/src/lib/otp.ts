import { randomUUID } from "node:crypto";
import type { AppContext } from "../context.ts";
import { AppError, tooMany } from "./errors.ts";
import { newOtp, sha256 } from "./crypto.ts";

export type OtpPurpose = "email_verify" | "guardian_consent";

export interface OtpSender {
  send(channel: "email" | "sms", to: string, code: string, purpose: OtpPurpose): Promise<void>;
}

/** Dev/test: lưu thư vào bộ nhớ (không gửi đi đâu). Production: thay bằng nhà cung cấp thật. */
export class MockOtpSender implements OtpSender {
  outbox: { channel: string; to: string; code: string; purpose: OtpPurpose }[] = [];
  async send(channel: "email" | "sms", to: string, code: string, purpose: OtpPurpose) {
    this.outbox.push({ channel, to, code, purpose });
  }
  last(to?: string) {
    return [...this.outbox].reverse().find((m) => !to || m.to === to);
  }
}

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

export async function issueOtp(ctx: AppContext, subjectId: string, purpose: OtpPurpose, targets: { channel: "email" | "sms"; to: string }[]): Promise<void> {
  // Giới hạn tần suất gửi: tối đa 3 mã/10 phút cho mỗi (chủ thể, mục đích) – chống spam/SMS pumping.
  ctx.rate.check(`otp-issue:${subjectId}:${purpose}`, 3, TTL_MS);
  const code = newOtp();
  const now = ctx.now();
  await ctx.db.query("UPDATE otp_codes SET consumed_at=$3 WHERE subject_id=$1 AND purpose=$2 AND consumed_at IS NULL", [subjectId, purpose, now]);
  await ctx.db.query(
    "INSERT INTO otp_codes(id, subject_id, purpose, code_hash, channel, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [randomUUID(), subjectId, purpose, sha256(`${subjectId}:${purpose}:${code}`), targets.map((t) => t.channel).join("+"), new Date(now.getTime() + TTL_MS), now],
  );
  for (const t of targets) await ctx.otp.send(t.channel, t.to, code, purpose);
}

export async function verifyOtp(ctx: AppContext, subjectId: string, purpose: OtpPurpose, code: string): Promise<void> {
  const now = ctx.now();
  const r = await ctx.db.query<{ id: string; code_hash: string; attempts: number; expires_at: Date }>(
    "SELECT id, code_hash, attempts, expires_at FROM otp_codes WHERE subject_id=$1 AND purpose=$2 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [subjectId, purpose],
  );
  const row = r.rows[0];
  if (!row || new Date(row.expires_at) <= now) throw new AppError(400, "otp_invalid_or_expired");
  if (row.attempts >= MAX_ATTEMPTS) throw tooMany("otp_locked");
  if (sha256(`${subjectId}:${purpose}:${code}`) !== row.code_hash) {
    await ctx.db.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1", [row.id]);
    throw new AppError(400, "otp_invalid_or_expired");
  }
  await ctx.db.query("UPDATE otp_codes SET consumed_at=$2 WHERE id=$1", [row.id, now]);
}

/**
 * Bộ gửi OTP thật qua webhook HTTPS của nhà cung cấp/relay tự chọn (nhà cung cấp Email/SMS chưa quyết – Q4).
 * Gửi JSON { channel, to, code, purpose } kèm Bearer token. Bắt buộc ở production (xem main.ts).
 */
export class WebhookOtpSender implements OtpSender {
  constructor(private url: string, private token: string, private timeoutMs = 8000) {
    if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("OTP webhook must be https (or localhost for tests)");
  }
  async send(channel: "email" | "sms", to: string, code: string, purpose: OtpPurpose) {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ channel, to, code, purpose }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new AppError(502, "otp_delivery_failed");
  }
}
