import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy cùng origin tới API (đọc API_URL lúc chạy, không "đóng cứng" khi build).
 * Dùng cùng origin để cookie phiên là first-party/HttpOnly và CSP chỉ cần connect-src 'self'.
 * Dùng 127.0.0.1 thay "localhost" vì Node ưu tiên IPv6 (::1) có thể không có listener.
 */
export const dynamic = "force-dynamic";
const API_URL = () => process.env.API_URL ?? "http://127.0.0.1:3001";
const FORWARD = ["cookie", "content-type", "origin", "user-agent", "accept-language"];

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const headers = new Headers();
  for (const h of FORWARD) { const v = req.headers.get(h); if (v) headers.set(h, v); }
  const xff = req.headers.get("x-forwarded-for"); if (xff) headers.set("x-forwarded-for", xff);
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL()}/api/${path.join("/")}${req.nextUrl.search}`, {
      method: req.method, headers, redirect: "manual", cache: "no-store",
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    });
  } catch {
    return NextResponse.json({ title: "upstream_unavailable", status: 502 }, { status: 502 });
  }
  const out = new NextResponse(upstream.body, { status: upstream.status });
  const ct = upstream.headers.get("content-type"); if (ct) out.headers.set("content-type", ct);
  out.headers.set("cache-control", "no-store");
  for (const c of upstream.headers.getSetCookie()) out.headers.append("set-cookie", c);
  return out;
}
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
