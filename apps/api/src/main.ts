import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { buildApp } from "./app.ts";
import { defaultConfig, type AppContext } from "./context.ts";
import { createPgDb, createPgliteDb, type Db } from "./db/index.ts";
import { migrate } from "./db/migrations.ts";
import { Hasher, KeyService } from "./lib/crypto.ts";
import { MockOtpSender } from "./lib/otp.ts";
import { RateLimiter } from "./lib/rate-limit.ts";
import { ContentStore } from "./modules/content.ts";
import { loadPublished } from "./modules/admin.ts";
import { runMaintenance } from "./modules/erasure.ts";

const isProd = process.env.NODE_ENV === "production";
const need = (k: string): string => {
  const v = process.env[k];
  if (!v && isProd) throw new Error(`${k} is required in production`);
  return v ?? "";
};

// Khóa: production bắt buộc đặt từ biến môi trường/KMS; dev dùng khóa ngẫu nhiên (dữ liệu dev mất khi khởi động lại – chấp nhận).
const kek = process.env.AIBUDDY_MASTER_KEY ? Buffer.from(need("AIBUDDY_MASTER_KEY"), "base64") : (need("AIBUDDY_MASTER_KEY"), randomBytes(32));
const pepper = process.env.AIBUDDY_PEPPER ? Buffer.from(need("AIBUDDY_PEPPER"), "base64") : (need("AIBUDDY_PEPPER"), randomBytes(32));
if (isProd && process.env.OTP_PROVIDER === "mock") throw new Error("OTP_PROVIDER=mock is not allowed in production");

const db: Db = process.env.DATABASE_URL ? createPgDb(process.env.DATABASE_URL) : await createPgliteDb();
await migrate(db);
const now = () => new Date();
const ctx: AppContext = {
  db, now,
  config: { ...defaultConfig, isProd, allowedOrigin: process.env.ALLOWED_ORIGIN },
  keys: new KeyService(db, kek, now),
  hasher: new Hasher(pepper),
  rate: new RateLimiter(now),
  otp: new MockOtpSender(), // TODO: nhà cung cấp Email/SMS thật (Q: chưa chọn)
  content: new ContentStore(process.env.CONTENT_DIR ?? join(import.meta.dirname, "../../../content")).load(),
};
await loadPublished(ctx);
const app = await buildApp(ctx);

// Job định kỳ: hết hạn đồng ý, xử lý yêu cầu xóa (SLA 72h), dọn phiên.
setInterval(() => runMaintenance(ctx).catch((e) => console.error("maintenance failed", e.message)), 10 * 60_000).unref();

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`api listening on :${port}${process.env.DATABASE_URL ? "" : " (in-memory PGlite, dev only)"}`);
