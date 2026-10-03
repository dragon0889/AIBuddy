// E2E spike khối lệnh: render workspace Scratch, nạp chương trình có khối ML tùy chỉnh, mô phỏng nhận diện.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined);
import assert from "node:assert/strict";

const port = 3101;
const base = `http://localhost:${port}`;
const server = spawn("pnpm", ["--filter", "@aibuddy/web", "exec", "next", "start", "-p", String(port)], { stdio: "ignore" });
process.on("exit", () => server.kill("SIGTERM"));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/spike/blocks`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
const external = [];
page.on("request", (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`${base}/spike/blocks`);
await page.waitForFunction(() => window.__blocksSpike?.ready === true, null, { timeout: 30000 });

const svgCount = await page.locator("[data-testid=workspace] svg").count();
assert.ok(svgCount > 0, "workspace svg rendered");

await page.evaluate(() => window.__blocksSpike.loadProgram({
  blocks: { languageVersion: 0, blocks: [{
    type: "ml_whenclassified", x: 40, y: 40, fields: { LABEL: "open" },
    next: { block: { type: "motion_movesteps", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 15 } } } },
      next: { block: { type: "motion_movesteps", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 5 } } } } } } } },
  }] },
}));
const none = await page.evaluate(() => window.__blocksSpike.classify("fist"));
assert.equal(none.x, 0, "unmatched label does nothing");
const moved = await page.evaluate(() => window.__blocksSpike.classify("open"));
assert.equal(moved.x, 20, "matching label runs the stack (15 + 5)");
await page.screenshot({ path: process.argv[2] ?? "docs/spikes/blocks-spike.png" });
await browser.close();
server.kill("SIGTERM");
assert.equal(external.length, 0, `no third-party requests, got: ${external.join(", ")}`);
const real = errors.filter((e) => !/favicon|404/i.test(e));
console.log("blocks e2e ok; svg:", svgCount, "console errors:", real.length ? real : "none");
process.exit(0);
