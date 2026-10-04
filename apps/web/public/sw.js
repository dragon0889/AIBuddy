/* Service worker AIBuddy: học bài lý thuyết khi mất mạng (SRS 2.3).
 * - Tài nguyên tĩnh (JS/CSS, mô hình, WASM, media Blockly): cache-first.
 * - Nội dung từng bài học GET /api/v1/child/lessons/:id: stale-while-revalidate (không chứa dữ liệu cá nhân).
 * - KHÔNG cache bất kỳ API nào khác (tiến độ, hồ sơ, báo cáo) – dữ liệu cá nhân không nằm trong cache của SW.
 * - Có thể xoá toàn bộ cache bằng thông điệp { type: "clear" } khi đăng xuất/đổi hồ sơ (T13). */
const STATIC = "aibuddy-static-v1";
const LESSONS = "aibuddy-lessons-v1";
const STATIC_PREFIXES = ["/_next/static/", "/models/", "/tfjs-wasm/", "/blockly-media/", "/icon.svg"];
const LESSON_RE = /^\/api\/v1\/child\/lessons\/[A-Za-z0-9-]+$/;

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  // Điều hướng tới trang /play/* (HTML tĩnh, đã dựng sẵn – không chứa dữ liệu cá nhân): mạng trước, rơi về cache khi mất mạng.
  if (req.mode === "navigate" && url.pathname.startsWith("/play")) {
    event.respondWith(caches.open(STATIC).then(async (c) => {
      try { const r = await fetch(req); if (r.ok) c.put(new Request(url.pathname), r.clone()); return r; }
      catch { return (await c.match(new Request(url.pathname))) ?? Response.error(); }
    }));
    return;
  }
  // RSC payload của trang tĩnh /play/* (điều hướng phía client): cache-first sau lần đầu.
  if (url.pathname.startsWith("/play") && (url.searchParams.has("_rsc") || req.headers.get("rsc"))) {
    event.respondWith(caches.open(STATIC).then(async (c) => {
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { return (await c.match(req)) ?? Response.error(); }
    }));
    return;
  }
  if (LESSON_RE.test(url.pathname)) {
    event.respondWith(caches.open(LESSONS).then(async (c) => {
      const cached = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => undefined);
      return cached ?? (await net) ?? new Response(JSON.stringify({ title: "offline" }), { status: 503, headers: { "content-type": "application/json" } });
    }));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear") event.waitUntil(Promise.all([caches.delete(LESSONS)]));
});
