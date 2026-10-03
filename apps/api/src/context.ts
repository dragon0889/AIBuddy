import type { Db } from "./db/index.ts";
import type { Hasher, KeyService } from "./lib/crypto.ts";
import type { RateLimiter } from "./lib/rate-limit.ts";
import type { OtpSender } from "./lib/otp.ts";
import type { ContentStore } from "./modules/content.ts";

export interface Config {
  isProd: boolean;
  /** Origin được phép gọi API từ trình duyệt (chống CSRF kết hợp SameSite). */
  allowedOrigin?: string;
  termsVersion: string;
  consentTtlDays: number;
  parentSessionHours: number;
  childSessionMinutes: number;
  childIdleMinutes: number;
  defaultDailyMinutes: number;
  erasureSlaHours: number;
}

export const defaultConfig: Config = {
  isProd: false,
  termsVersion: "2026-10",
  consentTtlDays: 7,
  parentSessionHours: 24 * 14,
  childSessionMinutes: 60,
  childIdleMinutes: 15,
  defaultDailyMinutes: 30,
  erasureSlaHours: 72,
};

export interface AppContext {
  db: Db;
  now: () => Date;
  config: Config;
  keys: KeyService;
  hasher: Hasher;
  rate: RateLimiter;
  otp: OtpSender;
  content: ContentStore;
}
