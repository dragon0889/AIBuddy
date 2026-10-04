// Đo thời gian tải trang bài học (SRS 6.1: ≤ 2,0 s trong mạng tiêu chuẩn) trên bản build production.
// Mạng giả lập: "băng thông rộng" (10 Mbps, RTT 40 ms) và "4G chậm" (1,6 Mbps, RTT 150 ms), cache lạnh. Kết quả ghi vào docs/perf/page-load.json.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const WEB = 3300, API = 3301, web = `http://localhost:${WEB}`, api = `http://127.0.0.1:${API}`;
const LOCAL = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(LOCAL) ? LOCAL : undefined);
const procs = [
  spawn("pnpm", ["--filter", "@aibuddy/api", "exec", "tsx", "src/main.ts"], { env: { ...process.env, PORT: String(API) }, stdio: "ignore" }),
  spawn("pnpm", ["--filter", "@aibuddy/web", "exec", "next", "start", "-p", String(WEB)], { env: { ...process.env, API_URL: api }, stdio: "ignore" }),
];
process.on("exit", () => procs.forEach((p) => p.kill("SIGTERM")));
for (let i = 0; i < 90; i++) { try { if ((await fetch(`${api}/health`)).ok && (await fetch(`${web}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const profiles = { "broadband (10 Mbps, RTT 40 ms)": { d: (10 * 1e6) / 8, rtt: 40 }, "slow 4G (1.6 Mbps, RTT 150 ms)": { d: (1.6 * 1e6) / 8, rtt: 150 } };
const results = [];

async function session() {
  const ctx = await browser.newContext();
  const post = (p, b) => ctx.request.post(`${web}${p}`, { data: b });
  await post("/api/v1/auth/register", { email: `perf${Date.now()}@example.com`, password: "correct horse battery", acceptTerms: true });
  const ob = async () => (await (await fetch(`${api}/api/v1/dev/outbox`)).json()).messages;
  await post("/api/v1/auth/verify-email", { code: [...(await ob())].reverse().find((m) => m.purpose === "email_verify").code });
  const y = new Date().getFullYear() - 9;
  const child = await (await post("/api/v1/children", { nickname: "Perf", birthYear: y, birthMonth: 1, avatar: "fox", pin: "1234" })).json();
  await post(`/api/v1/children/${child.id}/consent/guardian`, { code: [...(await ob())].reverse().find((m) => m.purpose === "guardian_consent").code, termsVersion: "2026-10" });
  await post(`/api/v1/children/${child.id}/consent/child`, {});
  await post("/api/v1/auth/profile-switch", { childId: child.id, pin: "1234" });
  return ctx;
}

const seed = await session(); // đăng ký một lần (giới hạn 10 đăng ký/giờ/IP), dùng lại phiên cho mọi lần đo
const state = await seed.storageState();
await seed.close();
for (const [name, p] of Object.entries(profiles)) {
  for (const path of ["/play/home", "/play/lesson?id=L2-RESP-02"]) {
    const times = [];
    let bytes = 0;
    for (let run = 0; run < 3; run++) {
      const ctx = await browser.newContext({ storageState: state });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: p.rtt, downloadThroughput: p.d, uploadThroughput: p.d / 2 });
      let b = 0; cdp.on("Network.loadingFinished", (e) => { b += e.encodedDataLength; });
      const t0 = Date.now();
      await page.goto(`${web}${path}`, { waitUntil: "commit" });
      await page.waitForSelector(path.includes("lesson") ? "[data-testid=step-story]" : "text=Hành trình của con", { timeout: 60000 });
      times.push(Date.now() - t0); bytes = Math.max(bytes, b);
      await ctx.close();
    }
    times.sort((a, c) => a - c);
    const r = { network: name, page: path, medianMs: times[1], maxMs: times[2], transferKB: Math.round(bytes / 1024), budgetMs: 2000, withinBudget: times[1] <= 2000 };
    results.push(r); console.log(JSON.stringify(r));
  }
}
await browser.close();
mkdirSync("docs/perf", { recursive: true });
writeFileSync("docs/perf/page-load.json", JSON.stringify({ date: new Date().toISOString(), note: "Chromium headless trên máy cloud; cache lạnh; mạng giả lập bằng CDP; chưa phải thiết bị/mạng thật", results }, null, 2));
process.exit(0);
