import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { buildApp } from "../src/app.ts";
import { defaultConfig, type AppContext, type Config } from "../src/context.ts";
import { createPgliteDb } from "../src/db/index.ts";
import { migrate } from "../src/db/migrations.ts";
import { Hasher, KeyService } from "../src/lib/crypto.ts";
import { MockOtpSender } from "../src/lib/otp.ts";
import { RateLimiter } from "../src/lib/rate-limit.ts";
import { ContentStore } from "../src/modules/content.ts";

export const CONTENT_DIR = join(import.meta.dirname, "../../../content");

export async function makeCtx(over: Partial<Config> = {}) {
  const db = await createPgliteDb();
  await migrate(db);
  const clock = { t: new Date("2026-10-05T08:00:00Z") };
  const now = () => new Date(clock.t);
  const otp = new MockOtpSender();
  const ctx: AppContext = {
    db, now, config: { ...defaultConfig, ...over },
    keys: new KeyService(db, randomBytes(32), now),
    hasher: new Hasher(randomBytes(32)),
    rate: new RateLimiter(now),
    otp,
    content: new ContentStore(CONTENT_DIR).load(),
  };
  const app = await buildApp(ctx);
  return { ctx, app, otp, clock, db };
}
export type Harness = Awaited<ReturnType<typeof makeCtx>>;

/** Client có cookie-jar tối giản. */
export class Client {
  cookies = new Map<string, string>();
  constructor(private app: Harness["app"]) {}
  async req(method: "GET" | "POST" | "PUT" | "DELETE", url: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await this.app.inject({
      method, url, headers: { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      payload: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const c of res.cookies) { if (c.value) this.cookies.set(c.name, c.value); else this.cookies.delete(c.name); }
    let json: any; try { json = res.json(); } catch { json = undefined; }
    return { status: res.statusCode, json, headers: res.headers };
  }
  get = (u: string) => this.req("GET", u);
  post = (u: string, b?: unknown) => this.req("POST", u, b ?? {});
  put = (u: string, b?: unknown) => this.req("PUT", u, b ?? {});
  del = (u: string) => this.req("DELETE", u);
}

export async function registerParent(h: Harness, email: string, opts: { verify?: boolean; phone?: string } = {}) {
  const c = new Client(h.app);
  h.ctx.rate.reset("register:127.0.0.1"); // test tạo nhiều tài khoản từ cùng một IP
  const r = await c.post("/api/v1/auth/register", { email, password: "correct horse battery", acceptTerms: true, ...(opts.phone ? { phone: opts.phone } : {}) });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.json)}`);
  if (opts.verify !== false) await c.post("/api/v1/auth/verify-email", { code: h.otp.last(email)!.code });
  return { client: c, id: r.json.id as string };
}

export async function addChild(h: Harness, c: Client, email: string, age: number, extra: Record<string, unknown> = {}) {
  const year = h.clock.t.getUTCFullYear() - age; // sinh tháng 1: tháng hiện tại > 1 nên đã đủ `age` tuổi
  const r = await c.post("/api/v1/children", { nickname: "Bé Na", birthYear: year, birthMonth: 1, avatar: "fox", pin: "1234", ...extra });
  return { res: r, id: r.json?.id as string, code: () => h.otp.last(email)!.code };
}

export async function activateChild(h: Harness, c: Client, email: string, age: number) {
  const ch = await addChild(h, c, email, age);
  await c.post(`/api/v1/children/${ch.id}/consent/guardian`, { code: ch.code(), termsVersion: h.ctx.config.termsVersion });
  if (age >= 7) await c.post(`/api/v1/children/${ch.id}/consent/child`);
  return ch.id;
}
