import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/index.ts";

// ---------- Mật khẩu / PIN (scrypt) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
const scryptAsync = (pw: string, salt: Buffer, opts: { N: number; r: number; p: number }, keylen: number) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(secret, salt, SCRYPT, SCRYPT.keylen);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(secret, Buffer.from(salt, "base64"), { N: +n, r: +r, p: +p }, expected.length);
  return timingSafeEqual(key, expected);
}

// ---------- Token phiên / OTP ----------
export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export class Hasher {
  constructor(private pepper: Buffer) {}
  /** HMAC có "pepper": dùng tra cứu email và tham chiếu ẩn danh mà không lộ giá trị gốc. */
  ref(value: string): string {
    return createHmac("sha256", this.pepper).update(value.trim().toLowerCase()).digest("hex");
  }
}

// ---------- Envelope encryption + crypto-shredding ----------
const aesEncrypt = (key: Buffer, plain: Buffer): string => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
};
const aesDecrypt = (key: Buffer, b64: string): Buffer => {
  const raw = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
};

export class KeyShreddedError extends Error {
  constructor(subject: string) {
    super(`data key for ${subject} was shredded`);
  }
}

/**
 * Mỗi chủ thể (phụ huynh, trẻ) có một khóa dữ liệu (DEK) AES-256, được bọc bằng khóa chủ (KEK).
 * Xóa hàng trong `subject_keys` làm mọi dữ liệu đã mã hóa của chủ thể không thể giải mã, kể cả trong bản sao lưu.
 */
export class KeyService {
  constructor(private db: Db, private kek: Buffer, private now: () => Date) {
    if (kek.length !== 32) throw new Error("master key must be 32 bytes");
  }
  private async dek(subjectId: string, create: boolean): Promise<Buffer> {
    const r = await this.db.query<{ wrapped_dek: string }>("SELECT wrapped_dek FROM subject_keys WHERE subject_id=$1", [subjectId]);
    if (r.rows[0]) return aesDecrypt(this.kek, r.rows[0].wrapped_dek);
    if (!create) throw new KeyShreddedError(subjectId);
    const dek = randomBytes(32);
    await this.db.query("INSERT INTO subject_keys(subject_id, wrapped_dek, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [subjectId, aesEncrypt(this.kek, dek), this.now()]);
    return this.dek(subjectId, false);
  }
  async encrypt(subjectId: string, plaintext: string): Promise<string> {
    return aesEncrypt(await this.dek(subjectId, true), Buffer.from(plaintext, "utf8"));
  }
  async decrypt(subjectId: string, cipher: string): Promise<string> {
    return aesDecrypt(await this.dek(subjectId, false), cipher).toString("utf8");
  }
  async shred(subjectId: string): Promise<boolean> {
    return (await this.db.query("DELETE FROM subject_keys WHERE subject_id=$1", [subjectId])).rowCount > 0;
  }
  async exists(subjectId: string): Promise<boolean> {
    return (await this.db.query("SELECT 1 FROM subject_keys WHERE subject_id=$1", [subjectId])).rows.length > 0;
  }
}

// ---------- TOTP (RFC 6238) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const i = B32.indexOf(ch); if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
export function totp(secretB32: string, atMs: number, step = 30, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / step)));
  const h = createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const o = h[h.length - 1]! & 15;
  const code = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 10 ** digits).padStart(digits, "0");
}
export function verifyTotp(secretB32: string, code: string, nowMs: number): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const w of [-1, 0, 1]) {
    const expected = Buffer.from(totp(secretB32, nowMs + w * 30_000));
    if (timingSafeEqual(expected, Buffer.from(code))) return true;
  }
  return false;
}
export const newTotpSecret = () => base32Encode(randomBytes(20));
