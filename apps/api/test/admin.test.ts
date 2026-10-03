import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { totp, verifyTotp, base32Decode, base32Encode } from "../src/lib/crypto.ts";
import { createAdmin, loadPublished } from "../src/modules/admin.ts";
import { Client, activateChild, makeCtx, registerParent, type Harness } from "./helpers.ts";

let h: Harness;
beforeAll(async () => { h = await makeCtx(); });
afterAll(async () => { await h.db.close(); });

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC 6238 SHA-1 test vectors", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    // RFC 6238 Appendix B (8 chữ số) → ta dùng 6 chữ số: 6 chữ số cuối của mã 8 chữ số.
    expect(totp(secret, 59_000)).toBe("287082");
    expect(totp(secret, 1_111_111_109_000)).toBe("081804");
    expect(totp(secret, 1_234_567_890_000)).toBe("005924");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
  it("accepts ±1 step, rejects others and malformed codes", () => {
    const s = base32Encode(Buffer.from("12345678901234567890"));
    const t = 1_234_567_890_000;
    expect(verifyTotp(s, totp(s, t - 30_000), t)).toBe(true);
    expect(verifyTotp(s, totp(s, t - 90_000), t)).toBe(false);
    expect(verifyTotp(s, "abc", t)).toBe(false);
  });
});

async function adminClient(email: string) {
  const a = await createAdmin(h.ctx, email, "a-very-long-admin-password");
  const c = new Client(h.app);
  const login = (totpCode?: string) => c.post("/api/v1/auth/login", { email, password: "a-very-long-admin-password", totp: totpCode });
  return { ...a, c, login, code: () => totp(a.totpSecret, h.clock.t.getTime()) };
}

describe("admin 2FA", () => {
  it("requires a valid TOTP code to log in; parents cannot reach admin routes", async () => {
    const a = await adminClient("admin1@example.com");
    expect((await a.login()).status).toBe(401);
    expect((await a.login("000000")).status).toBe(401);
    expect((await a.login(a.code())).status).toBe(200);
    expect((await a.c.get("/api/v1/admin/lessons")).status).toBe(200);
    const p = await registerParent(h, "notadmin@example.com");
    expect((await p.client.get("/api/v1/admin/lessons")).status).toBe(403);
    expect((await new Client(h.app).get("/api/v1/admin/lessons")).status).toBe(401);
    expect(a.otpauthUri).toContain("secret=");
  });
  it("refuses short admin passwords", async () => {
    await expect(createAdmin(h.ctx, "weak@example.com", "short")).rejects.toThrow();
  });
});

describe("CMS two-person review (T9)", () => {
  const draftLesson = () => ({ ...JSON.parse(JSON.stringify(h.ctx.content.lesson("L2-RESP-01")!)), id: "L2-RESP-90", title: { vi: "Bài thử nghiệm CMS" } });

  it("validates lessons, blocks self-approval, publishes after another admin approves, and survives restart", async () => {
    const a = await adminClient("cms-a@example.com");
    const b = await adminClient("cms-b@example.com");
    await a.login(a.code()); await b.login(b.code());

    const bad = await a.c.post("/api/v1/admin/drafts", { lesson: { ...draftLesson(), outcomes: ["RESP.9.9"] } });
    expect(bad.status).toBe(400);
    const noGuide = draftLesson(); delete noGuide.parentGuide;
    expect((await a.c.post("/api/v1/admin/drafts", { lesson: noGuide })).status).toBe(400);
    const unknown = await a.c.post("/api/v1/admin/drafts", { lesson: { ...draftLesson(), outcomes: ["RESP.2.9"] } });
    expect(unknown.status).toBe(400);

    const d = await a.c.post("/api/v1/admin/drafts", { lesson: draftLesson() });
    expect(d.status).toBe(201);
    expect((await b.c.post(`/api/v1/admin/drafts/${d.json.id}/submit`)).status).toBe(403); // chỉ tác giả gửi duyệt
    expect((await a.c.post(`/api/v1/admin/drafts/${d.json.id}/submit`)).status).toBe(200);
    expect((await a.c.post(`/api/v1/admin/drafts/${d.json.id}/review`, { decision: "approve" })).status).toBe(403);
    expect(h.ctx.content.lesson("L2-RESP-90")).toBeUndefined();
    expect((await b.c.post(`/api/v1/admin/drafts/${d.json.id}/review`, { decision: "approve" })).json.status).toBe("published");
    expect(h.ctx.content.lesson("L2-RESP-90")?.title.vi).toBe("Bài thử nghiệm CMS");

    // khởi động lại: bài đã xuất bản được nạp lại từ DB
    h.ctx.content.load();
    expect(h.ctx.content.lesson("L2-RESP-90")).toBeUndefined();
    expect(await loadPublished(h.ctx)).toBeGreaterThanOrEqual(1);
    expect(h.ctx.content.lesson("L2-RESP-90")).toBeDefined();
    const logs = (await b.c.get("/api/v1/admin/audit-logs?action=cms.published")).json.logs;
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("rejection keeps the lesson unpublished", async () => {
    const a = await adminClient("cms-c@example.com");
    const b = await adminClient("cms-d@example.com");
    await a.login(a.code()); await b.login(b.code());
    const d = await a.c.post("/api/v1/admin/drafts", { lesson: { ...draftLesson(), id: "L2-RESP-91" } });
    await a.c.post(`/api/v1/admin/drafts/${d.json.id}/submit`);
    expect((await b.c.post(`/api/v1/admin/drafts/${d.json.id}/review`, { decision: "reject" })).json.status).toBe("rejected");
    expect(h.ctx.content.lesson("L2-RESP-91")).toBeUndefined();
  });
});

describe("compliance report", () => {
  it("summarises consent, erasure and privacy without PII", async () => {
    const p = await registerParent(h, "rep1@example.com");
    const id = await activateChild(h, p.client, "rep1@example.com", 9);
    await p.client.post(`/api/v1/children/${id}/withdraw`);
    const a = await adminClient("rep-admin@example.com");
    await a.login(a.code());
    const r = (await a.c.get("/api/v1/admin/compliance-report")).json;
    expect(r.erasure.completed).toBeGreaterThanOrEqual(1);
    expect(r.erasure.openOverdue).toBe(0);
    expect(r.privacy.rawMediaStoredOnServer).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/@example\.com/);
    expect((await a.c.post("/api/v1/admin/maintenance/run")).status).toBe(200);
  });
});
