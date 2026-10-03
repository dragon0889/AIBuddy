import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppContext } from "./context.ts";
import { AppError } from "./lib/errors.ts";
import { loadAuth } from "./lib/session.ts";
import { adminRoutes } from "./modules/admin.ts";
import { authRoutes } from "./modules/auth.ts";
import { familyRoutes } from "./modules/family.ts";
import { learningRoutes } from "./modules/learning.ts";

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: ctx.config.isProd, bodyLimit: 256 * 1024 });
  await app.register(cookie);

  // Header bảo mật mặc định (CSP chi tiết cho web nằm ở apps/web/next.config.mjs).
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
    reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    if (ctx.config.isProd) reply.header("strict-transport-security", "max-age=63072000; includeSubDomains");
  });

  // Chống CSRF: với request đổi dữ liệu, bắt buộc JSON và (nếu có Origin) phải khớp origin cho phép.
  app.addHook("onRequest", async (req) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && ctx.config.allowedOrigin && origin !== ctx.config.allowedOrigin) throw new AppError(403, "bad_origin");
      const ct = req.headers["content-type"] ?? "";
      if (req.headers["content-length"] !== "0" && req.headers["content-length"] !== undefined && !ct.startsWith("application/json")) throw new AppError(415, "json_required");
    }
    await loadAuth(ctx, req);
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).type("application/problem+json").send({ type: `about:blank`, title: err.code, status: err.status, detail: err.message });
    const e = err as { statusCode?: number; code?: string; message: string };
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).type("application/problem+json").send({ title: e.code ?? "bad_request", status: e.statusCode, detail: e.message });
    // Không rò rỉ chi tiết nội bộ/PII ra ngoài; log chỉ ghi thông điệp.
    console.error("unhandled", e.message);
    return reply.code(500).type("application/problem+json").send({ title: "internal_error", status: 500 });
  });

  app.get("/health", async () => ({ status: "ok" }));
  authRoutes(app, ctx);
  familyRoutes(app, ctx);
  learningRoutes(app, ctx);
  adminRoutes(app, ctx);
  return app;
}
