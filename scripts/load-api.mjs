// Thử tải API (đọc danh sách bài + nhịp tim) với autocannon. Dùng: node scripts/load-api.mjs [--url http://127.0.0.1:3001] [--conns 100] [--secs 10]
// CẢNH BÁO: nếu không đặt DATABASE_URL thì API chạy PGlite (một tiến trình, bộ nhớ) – kết quả KHÔNG đại diện cho PostgreSQL production.
import autocannon from "autocannon";
import { spawn } from "node:child_process";

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
let base = arg("--url", "");
let proc;
if (!base) {
  proc = spawn("pnpm", ["--filter", "@aibuddy/api", "exec", "tsx", "src/main.ts"], { env: { ...process.env, PORT: "3401" }, stdio: "ignore" });
  base = "http://127.0.0.1:3401";
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
}
const conns = Number(arg("--conns", 100)), secs = Number(arg("--secs", 10));
const J = { "content-type": "application/json" };
const call = async (p, b, cookie) => { const r = await fetch(base + p, { method: "POST", headers: { ...J, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(b) }); return { r, set: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), j: await r.json().catch(() => ({})) }; };
const ob = async () => (await (await fetch(`${base}/api/v1/dev/outbox`)).json()).messages;

const reg = await call("/api/v1/auth/register", { email: `load${Date.now()}@example.com`, password: "correct horse battery", acceptTerms: true });
const parentCookie = reg.set;
await call("/api/v1/auth/verify-email", { code: [...(await ob())].reverse().find((m) => m.purpose === "email_verify").code }, parentCookie);
const child = (await call("/api/v1/children", { nickname: "Load", birthYear: new Date().getFullYear() - 9, birthMonth: 1, avatar: "fox", pin: "1234" }, parentCookie)).j;
await call(`/api/v1/children/${child.id}/consent/guardian`, { code: [...(await ob())].reverse().find((m) => m.purpose === "guardian_consent").code, termsVersion: "2026-10" }, parentCookie);
await call(`/api/v1/children/${child.id}/consent/child`, {}, parentCookie);
await call("/api/v1/children/" + child.id + "/settings", {}, parentCookie).catch(() => {});
const sw = await call("/api/v1/auth/profile-switch", { childId: child.id, pin: "1234" }, parentCookie);
const cookie = `${parentCookie}; ${sw.set}`;

const run = (title, opts) => new Promise((res) => autocannon({ url: base, connections: conns, duration: secs, headers: { cookie }, ...opts }, (e, r) => res({ title, e, r })));
const out = [];
for (const [title, opts] of [
  ["GET /api/v1/child/lessons", { requests: [{ method: "GET", path: "/api/v1/child/lessons" }] }],
  ["GET /api/v1/child/lessons/L2-RESP-02 (nội dung bài)", { requests: [{ method: "GET", path: "/api/v1/child/lessons/L2-RESP-02" }] }],
  ["POST /api/v1/child/heartbeat", { requests: [{ method: "POST", path: "/api/v1/child/heartbeat", headers: J, body: JSON.stringify({ seconds: 1 }) }] }],
]) {
  const { r } = await run(title, opts);
  const row = { endpoint: title, connections: conns, secs, rps: Math.round(r.requests.average), p50ms: r.latency.p50, p99ms: r.latency.p99, non2xx: r.non2xx, errors: r.errors, timeouts: r.timeouts };
  out.push(row); console.log(JSON.stringify(row));
}
proc?.kill("SIGTERM");
process.exit(0);
