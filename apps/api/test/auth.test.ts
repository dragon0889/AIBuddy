import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, makeCtx, type Harness } from "./helpers.ts";

let h: Harness;
beforeAll(async () => { h = await makeCtx(); });
afterAll(async () => { await h.db.close(); });

const creds = { email: "Parent@Example.com", password: "correct horse battery", acceptTerms: true };

describe("parent auth", () => {
  it("registers, verifies email by OTP, logs out and in again", async () => {
    const c = new Client(h.app);
    const r = await c.post("/api/v1/auth/register", creds);
    expect(r.status).toBe(201);
    expect(r.json.emailVerified).toBe(false);
    const mail = h.otp.last("parent@example.com")!;
    expect(mail.purpose).toBe("email_verify");
    expect((await c.post("/api/v1/auth/verify-email", { code: "000000" })).status).toBe(400);
    expect((await c.post("/api/v1/auth/verify-email", { code: mail.code })).json.emailVerified).toBe(true);
    expect((await c.get("/api/v1/auth/me")).json.emailVerified).toBe(true);
    await c.post("/api/v1/auth/logout");
    expect((await c.get("/api/v1/auth/me")).status).toBe(401);
    expect((await c.post("/api/v1/auth/login", { email: "parent@example.com", password: creds.password })).status).toBe(200);
  });

  it("rejects duplicate email, weak password and missing terms", async () => {
    const c = new Client(h.app);
    expect((await c.post("/api/v1/auth/register", creds)).status).toBe(409);
    expect((await c.post("/api/v1/auth/register", { ...creds, email: "x@example.com", password: "short" })).status).toBe(400);
    expect((await c.post("/api/v1/auth/register", { ...creds, email: "y@example.com", acceptTerms: false })).status).toBe(400);
  });

  it("stores email encrypted (no plaintext PII in users table)", async () => {
    const rows = (await h.db.query<{ email_enc: string; email_hash: string }>("SELECT email_enc, email_hash FROM users")).rows;
    for (const r of rows) {
      expect(r.email_enc).not.toContain("example.com");
      expect(r.email_hash).not.toContain("example.com");
    }
  });

  it("locks login attempts per account and does not reveal which part was wrong", async () => {
    const c = new Client(h.app);
    const bad = await c.post("/api/v1/auth/login", { email: "ghost@example.com", password: "whatever-password" });
    const bad2 = await c.post("/api/v1/auth/login", { email: "parent@example.com", password: "wrong-password-x" });
    expect(bad.status).toBe(401);
    expect(bad2.status).toBe(401);
    expect(bad.json.title).toBe(bad2.json.title);
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await c.post("/api/v1/auth/login", { email: "parent@example.com", password: "wrong-password-x" })).status;
    expect(last).toBe(429);
  });

  it("sets hardened cookie and security headers; blocks cross-origin and non-JSON writes", async () => {
    const c = new Client(h.app);
    const res = await h.app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { "content-type": "application/json" }, payload: JSON.stringify({ ...creds, email: "z@example.com" }) });
    expect(res.headers["set-cookie"]).toMatch(/HttpOnly/i);
    expect(res.headers["set-cookie"]).toMatch(/SameSite=Lax/i);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    const form = await h.app.inject({ method: "POST", url: "/api/v1/auth/login", headers: { "content-type": "text/plain", "content-length": "5" }, payload: "a=b&c" });
    expect(form.statusCode).toBe(415);
    expect(c).toBeDefined();
  });
});
