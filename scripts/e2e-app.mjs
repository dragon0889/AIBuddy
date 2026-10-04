// E2E toàn hệ thống: API (PGlite trong bộ nhớ) + Next.js + Chromium (camera giả).
// Luồng: đăng ký phụ huynh → OTP → tạo hồ sơ con → Dual Consent → chọn hồ sơ bằng PIN → học bài → đánh giá → Xưởng dạy máy (camera giả)
// → khối lệnh → báo cáo phụ huynh → offline → kiểm tra quyền riêng tư (không request ngoài, không gửi ảnh) → axe (WCAG).
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const WEB = 3200, API = 3201;
const web = `http://localhost:${WEB}`, api = `http://127.0.0.1:${API}`;
const LOCAL = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(LOCAL) ? LOCAL : undefined);
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const procs = [
  spawn("pnpm", ["--filter", "@aibuddy/api", "exec", "tsx", "src/main.ts"], { env: { ...process.env, PORT: String(API), ALLOWED_ORIGIN: web }, stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@aibuddy/web", "exec", "next", "start", "-p", String(WEB)], { env: { ...process.env, API_URL: api }, stdio: "ignore" }),
];
const cleanup = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("exit", cleanup);
async function waitFor(url) { for (let i = 0; i < 90; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 1000)); } throw new Error(`timeout ${url}`); }
await waitFor(`${api}/health`); await waitFor(`${web}/`);

const outbox = async () => (await (await fetch(`${api}/api/v1/dev/outbox`)).json()).messages;
const lastOtp = async (purpose) => [...(await outbox())].reverse().find((m) => m.purpose === purpose).code;

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, permissions: ["camera"] });
const page = await ctx.newPage();
const external = [], badPosts = [], consoleErrors = [];
let offlineNow = false; // lỗi tải do chủ động ngắt mạng là bình thường, không tính
page.on("request", (r) => {
  const u = r.url();
  if (!u.startsWith(web) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  // Mọi POST chỉ được gửi tới /api/v1/ và không chứa dữ liệu nhị phân/ảnh.
  if (r.method() !== "GET") { const d = r.postData() ?? ""; if (!u.includes("/api/v1/") || d.length > 5000 || /data:image|base64,/.test(d)) badPosts.push(`${r.method()} ${u} (${d.length}b)`); }
});
page.on("pageerror", (e) => { if (!offlineNow) consoleErrors.push(String(e)); });
page.on("console", (m) => { if (!offlineNow && m.type() === "error" && !/favicon|404|Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });

const step = (s) => console.log("•", s);
async function axe(name) {
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () => { const x = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }); return x.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, target: v.nodes[0]?.target })); });
  const bad = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  console.log(`  axe ${name}: ${r.length} violations (${bad.length} serious/critical)`, bad.length ? JSON.stringify(bad) : "");
  return bad;
}
const a11y = [];

// 1. Đăng ký + xác minh email
step("register + verify email");
await page.goto(`${web}/register`);
a11y.push(...await axe("register"));
await page.fill('input[type=email]', "e2e.parent@example.com");
await page.fill('input[type=password]', "correct horse battery staple");
await page.check('form input[type=checkbox]');
await page.click("button.btn-primary");
await page.waitForURL("**/verify");
await page.fill('input[autocomplete=one-time-code]', await lastOtp("email_verify"));
await page.click("button.btn-primary");
await page.waitForURL("**/parent");

// 2. Tạo hồ sơ con + Dual Consent
step("create child + dual consent");
const year = new Date().getFullYear() - 9;
await page.fill('label:has-text("Biệt danh") input', "Bé Na");
await page.fill('label:has-text("Năm sinh") input', String(year));
await page.fill('label:has-text("PIN") input', "1234");
await page.click("button.btn-primary:has-text('Tạo hồ sơ')");
await page.waitForSelector('[data-testid="child-Bé Na"]');
await page.fill('[data-testid="child-Bé Na"] input[autocomplete=one-time-code]', await lastOtp("guardian_consent"));
await page.check('[data-testid="child-Bé Na"] label:has-text("camera") input');
await page.click('[data-testid="child-Bé Na"] button.btn-primary:has-text("Xác nhận")');
await page.click('button:has-text("Đưa máy cho con")');
await page.click('button:has-text("Con đồng ý")');
await page.waitForSelector('[data-testid="child-Bé Na"] a:has-text("Cho con chơi")');
a11y.push(...await axe("parent dashboard"));

// 3. Chọn hồ sơ bằng PIN
step("profile switch with PIN");
await page.click('a:has-text("Cho con chơi")');
await page.click('[data-testid="pick-Bé Na"]');
for (const d of "0000") await page.click(`button:text-is("${d}")`);
await page.waitForSelector("text=Chưa đúng");
for (const d of "1234") await page.click(`button:text-is("${d}")`);
await page.waitForURL("**/play/home");
await page.waitForSelector("text=Chào Bé Na");
a11y.push(...await axe("child home"));

// 4. Đánh giá đầu vào
step("pre-test");
await page.click('a:has-text("Bắt đầu")');
for (let i = 0; i < 10; i++) { await page.click('[role=radio] >> nth=0'); await page.click('button.btn-primary:has-text("' + (i === 9 ? "Xong" : "Tiếp") + '")'); }
await page.waitForSelector('[data-testid="assess-done"]');
await page.click('a:has-text("Về trang chính")');

// 5. Bài "Tìm lỗi" (chấm ở máy chủ)
step("lesson: spot the AI mistake");
await page.click('[data-testid="lesson-L2-RESP-05"]');
await page.click('button:has-text("Tiếp")');
await page.click('button.chunk:has-text("sinh ra ở Huế")');
await page.click('button.btn-primary:has-text("Kiểm tra")');
await page.waitForSelector("text=Đúng rồi");
await page.waitForSelector("text=+20 điểm");
a11y.push(...await axe("lesson spot step"));
await page.click('button.btn-primary:has-text("Tiếp")');
await page.click('button:has-text("Đối chiếu với sách")');
await page.waitForSelector("text=Đúng rồi");
await page.click('button.btn-primary:has-text("Tiếp")');
await page.click('button.btn-primary:has-text("Xong")');
await page.waitForSelector('[data-testid="lesson-done"]');
const me1 = await ctx.request.get(`${web}/api/v1/child/me`).then((r) => r.json());
assert.ok(me1.xp >= 70, `xp after lesson: ${me1.xp}`);
assert.ok(me1.badges.some((b) => b.id === "first_lesson"));
await page.click('a:has-text("Về trang chính")');

// 6. Xưởng dạy máy với camera giả
step("ML studio (fake camera): capture → train → test → save");
await page.goto(`${web}/play/studio?project=PRJ-02`);
await page.check('label:has-text("người lớn") input');
await page.click('button:has-text("Bật camera")');
await page.waitForSelector("text=Bước 1: Chụp mẫu", { timeout: 120000 });
const cards = page.locator(".grid .card");
for (let i = 0; i < 3; i++) {
  await cards.nth(i).locator('button:has-text("×8")').click();
  await cards.nth(i).locator("text=/^[89] ảnh$/").waitFor({ timeout: 120000 }); // đợi chụp xong rồi mới sang nhóm kế (nút bị khóa khi đang chụp)
}
await page.click('button:has-text("Cho máy học")');
await page.waitForSelector("text=Máy đã học xong", { timeout: 120000 });
await page.click('button:has-text("Đây là Búa")'); // sửa lỗi (mô phỏng "vì sao máy sai")
await page.click('button:has-text("Học lại với dữ liệu mới")');
await page.waitForSelector("text=Máy đã học xong", { timeout: 120000 });
await page.click('button:has-text("Xong! Lưu kết quả")');
await page.waitForURL("**/play/home", { timeout: 60000 });
const me2 = await ctx.request.get(`${web}/api/v1/child/me`).then((r) => r.json());
assert.ok(me2.badges.some((b) => b.id === "trainer"), "trainer badge after training a model");
const hasModel = await page.evaluate(async () => { const tf = await import("/_next/static/chunks/x").catch(() => null); return tf; }).catch(() => null);
void hasModel;

// 7. Khối lệnh
step("block coding");
await page.goto(`${web}/play/blocks?e2e=1`);
await page.waitForFunction(() => typeof window.__loadProgram === "function", null, { timeout: 60000 });
await page.evaluate(() => window.__loadProgram({ blocks: { languageVersion: 0, blocks: [{ type: "ml_whenclassified", x: 20, y: 20, fields: { LABEL: "Kéo" }, next: { block: { type: "motion_movesteps", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 25 } } } } } } }] } }));
await page.click('button:has-text("Giả vờ nhận ra “Kéo”")');
await page.waitForSelector("text=x = 25");
await page.click('button:has-text("Giả vờ nhận ra “Búa”")');
assert.match(await page.textContent('[data-testid="sprite-state"]'), /x = 25/, "unmatched label leaves the sprite");

// 8. Offline: học từ cache, đồng bộ khi có mạng
step("offline lesson + sync");
await page.goto(`${web}/play/home`);
await page.waitForSelector("text=Chào Bé Na");
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload();
await page.waitForSelector("text=Chào Bé Na");
await page.waitForTimeout(2500); // chờ tải trước các bài vào cache của SW
const xpBefore = (await ctx.request.get(`${web}/api/v1/child/me`).then((r) => r.json())).xp;
offlineNow = true;
await ctx.setOffline(true);
await page.click('[data-testid="lesson-L2-RESP-06"]');
try { await page.waitForSelector("button:has-text(\"Tiếp\")", { timeout: 20000 }); }
catch (e) {
  const info = await page.evaluate(async () => ({ url: location.href, ctrl: !!navigator.serviceWorker.controller, caches: await Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search).slice(0, 40)])), text: document.body.innerText.slice(0, 300) }));
  console.log("OFFLINE DEBUG", JSON.stringify(info, null, 1), consoleErrors.slice(-5));
  throw e;
}
await page.click('button:has-text("Tiếp")');
await page.click('button.chunk:has-text("ban đêm")');
await page.click('button.btn-primary:has-text("Kiểm tra")');
await page.waitForSelector("text=Đúng rồi");
await ctx.setOffline(false);
offlineNow = false;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForFunction(async (before) => { const r = await fetch("/api/v1/child/me"); return (await r.json()).xp >= before + 20; }, xpBefore, { timeout: 30000 });

// 9. Báo cáo phụ huynh
step("parent report");
await page.goto(`${web}/parent`);
await page.click('a:has-text("Báo cáo tuần")');
await page.waitForSelector("text=Tìm lỗi: Lịch sử");
await page.waitForSelector("text=Học cùng con");
a11y.push(...await axe("parent report"));

await browser.close(); cleanup();
assert.equal(external.length, 0, `third-party requests: ${external.join(", ")}`);
assert.equal(badPosts.length, 0, `unexpected posts: ${badPosts.join(", ")}`);
assert.equal(consoleErrors.length, 0, `console errors: ${consoleErrors.join(" | ")}`);
assert.equal(a11y.length, 0, `serious/critical a11y violations: ${JSON.stringify(a11y)}`);
console.log("E2E OK ✔  (no third-party requests, no media uploads, no console errors, no serious a11y violations)");
process.exit(0);
