// Benchmark Sprint 1: chạy spike ML trong Chromium headless với từng backend và mức giả lập CPU chậm.
// Dùng: node scripts/bench-ml.mjs [--port 3100] [--out docs/spikes/bench-results.json]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined);

const port = Number(process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : 3100);
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "docs/spikes/bench-results.json";
const base = `http://localhost:${port}`;

const server = spawn("pnpm", ["--filter", "@aibuddy/web", "exec", "next", "start", "-p", String(port)], { stdio: "inherit" });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${base}/spike/ml`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});

const results = [];
for (const backend of ["cpu", "wasm", "webgl"]) {
  for (const throttle of [1, 4]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    page.on("request", (r) => net.push({ url: r.url(), method: r.method(), hasPostData: r.postData() != null }));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    await page.goto(`${base}/spike/ml`);
    await page.waitForFunction(() => typeof window.__runSpike === "function");
    const t0 = Date.now();
    const r = await page.evaluate((b) => window.__runSpike({ backend: b, perClass: 30, epochs: 20 }), backend);
    const external = net.filter((n) => !n.url.startsWith(base) && !n.url.startsWith("data:") && !n.url.startsWith("blob:"));
    const posts = net.filter((n) => n.method !== "GET" || n.hasPostData);
    results.push({ requestedBackend: backend, cpuThrottle: throttle, wallMs: Date.now() - t0, ...r, externalRequests: external.length, nonGetRequests: posts.length });
    console.log(`${backend} x${throttle}: total=${Math.round(r.totalMs)}ms train=${Math.round(r.trainMs)}ms acc=${r.testAccuracy} leaked=${r.leakedTensors} ext=${external.length} nonGET=${posts.length}${r.error ? " ERROR " + r.error : ""}`);
    await ctx.close();
  }
}
await browser.close();
writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), userAgent: "Chromium headless (SwiftShader), môi trường cloud – không đại diện thiết bị thật", results }, null, 2));
stop();
process.exit(0);
