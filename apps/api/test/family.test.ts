import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMaintenance } from "../src/modules/erasure.ts";
import { Client, activateChild, addChild, makeCtx, registerParent, type Harness } from "./helpers.ts";

let h: Harness;
beforeAll(async () => { h = await makeCtx(); });
afterAll(async () => { await h.db.close(); });

describe("Dual Consent (FR-010)", () => {
  it("child aged 9 needs guardian OTP AND child agreement", async () => {
    const { client } = await registerParent(h, "a1@example.com");
    const ch = await addChild(h, client, "a1@example.com", 9);
    expect(ch.res.status).toBe(201);
    expect(ch.res.json.status).toBe("PENDING_PARENT_CONSENT");
    expect(ch.res.json.level).toBe(2);
    const otp = h.otp.last("a1@example.com")!;
    expect(otp.purpose).toBe("guardian_consent");
    const bad = await client.post(`/api/v1/children/${ch.id}/consent/guardian`, { code: "111111", termsVersion: h.ctx.config.termsVersion });
    expect(bad.status).toBe(400);
    const g = await client.post(`/api/v1/children/${ch.id}/consent/guardian`, { code: otp.code, termsVersion: h.ctx.config.termsVersion });
    expect(g.json.status).toBe("PENDING_PARENT_CONSENT");
    expect(g.json.guardianVerified).toBe(true);
    const k = await client.post(`/api/v1/children/${ch.id}/consent/child`);
    expect(k.json.status).toBe("ACTIVE");
    expect(k.json.cameraAllowed).toBe(false); // Privacy by Default
    const rule = await h.db.query("SELECT daily_minutes FROM screen_time_rules WHERE child_id=$1", [ch.id]);
    expect(rule.rows[0]).toEqual({ daily_minutes: 30 });
  });

  it("child under 7 needs the guardian only; child agreement endpoint is refused", async () => {
    const { client } = await registerParent(h, "a2@example.com");
    const ch = await addChild(h, client, "a2@example.com", 6);
    expect(ch.res.json.level).toBe(1);
    const g = await client.post(`/api/v1/children/${ch.id}/consent/guardian`, { code: ch.code(), termsVersion: h.ctx.config.termsVersion });
    expect(g.json.status).toBe("ACTIVE");
    expect((await client.post(`/api/v1/children/${ch.id}/consent/child`)).status).toBe(400);
  });

  it("requires a verified parent email and a valid age range", async () => {
    const { client } = await registerParent(h, "a3@example.com", { verify: false });
    expect((await addChild(h, client, "a3@example.com", 8)).res.status).toBe(403);
    await client.post("/api/v1/auth/verify-email", { code: h.otp.last("a3@example.com")!.code });
    expect((await addChild(h, client, "a3@example.com", 4)).res.status).toBe(400);
    expect((await addChild(h, client, "a3@example.com", 17)).res.status).toBe(400);
    expect((await addChild(h, client, "a3@example.com", 8, { pin: "12" })).res.status).toBe(400);
  });

  it("rejects wrong terms version and expired consent; expired profiles are erased", async () => {
    const { client } = await registerParent(h, "a4@example.com");
    const ch = await addChild(h, client, "a4@example.com", 8);
    expect((await client.post(`/api/v1/children/${ch.id}/consent/guardian`, { code: ch.code(), termsVersion: "old" })).status).toBe(400);
    h.clock.t = new Date(h.clock.t.getTime() + 8 * 86_400_000);
    const m = await runMaintenance(h.ctx);
    expect(m.expired).toBeGreaterThanOrEqual(1);
    expect((await h.db.query("SELECT 1 FROM children WHERE id=$1", [ch.id])).rows).toHaveLength(0);
    h.clock.t = new Date("2026-10-05T08:00:00Z");
  });

  it("stores child PII encrypted, and consent events carry no PII", async () => {
    const r = await h.db.query<{ nickname_enc: string; birth_enc: string }>("SELECT nickname_enc, birth_enc FROM children");
    for (const row of r.rows) { expect(row.nickname_enc).not.toContain("Na"); expect(row.birth_enc).not.toMatch(/20\d\d-/); }
    const ev = await h.db.query<{ child_ref: string }>("SELECT child_ref FROM consent_events");
    for (const e of ev.rows) expect(e.child_ref).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("access control", () => {
  it("parents cannot see or change each other's children (IDOR → 404)", async () => {
    const A = await registerParent(h, "b1@example.com");
    const B = await registerParent(h, "b2@example.com");
    const id = await activateChild(h, A.client, "b1@example.com", 9);
    expect((await B.client.put(`/api/v1/children/${id}/settings`, { dailyMinutes: 200 })).status).toBe(404);
    expect((await B.client.post(`/api/v1/children/${id}/withdraw`)).status).toBe(404);
    expect((await B.client.post(`/api/v1/auth/profile-switch`, { childId: id, pin: "1234" })).status).toBe(404);
    expect((await B.client.get("/api/v1/children")).json.children).toHaveLength(0);
    expect((await new Client(h.app).get("/api/v1/children")).status).toBe(401);
  });
});

describe("profile switch, PIN lockout, screen time", () => {
  it("locks after 5 wrong PINs, then allows the right PIN after the lock", async () => {
    const { client } = await registerParent(h, "c1@example.com");
    const id = await activateChild(h, client, "c1@example.com", 9);
    for (let i = 0; i < 5; i++) expect((await client.post("/api/v1/auth/profile-switch", { childId: id, pin: "0000" })).status).toBe(401);
    expect((await client.post("/api/v1/auth/profile-switch", { childId: id, pin: "1234" })).status).toBe(429);
    h.clock.t = new Date(h.clock.t.getTime() + 6 * 60_000);
    const ok = await client.post("/api/v1/auth/profile-switch", { childId: id, pin: "1234" });
    expect(ok.status).toBe(200);
    expect(ok.json.remainingSeconds).toBe(1800);
  });

  it("enforces the daily limit via heartbeat and blocks further switching", async () => {
    const { client } = await registerParent(h, "c2@example.com");
    const id = await activateChild(h, client, "c2@example.com", 8);
    await client.put(`/api/v1/children/${id}/settings`, { dailyMinutes: 5 });
    expect((await client.post("/api/v1/auth/profile-switch", { childId: id, pin: "1234" })).status).toBe(200);
    let last = 0;
    for (let i = 0; i < 5; i++) last = (await client.post("/api/v1/child/heartbeat", { seconds: 60 })).status;
    expect(last).toBe(403);
    expect((await client.post("/api/v1/child/heartbeat", { seconds: 10 })).status).toBe(401); // phiên trẻ đã bị hủy
    expect((await client.post("/api/v1/auth/profile-switch", { childId: id, pin: "1234" })).status).toBe(403);
  });

  it("child sessions expire when idle", async () => {
    const { client } = await registerParent(h, "c3@example.com");
    const id = await activateChild(h, client, "c3@example.com", 8);
    await client.post("/api/v1/auth/profile-switch", { childId: id, pin: "1234" });
    expect((await client.post("/api/v1/child/heartbeat", { seconds: 5 })).status).toBe(200);
    h.clock.t = new Date(h.clock.t.getTime() + 16 * 60_000);
    expect((await client.post("/api/v1/child/heartbeat", { seconds: 5 })).status).toBe(401);
  });
});

describe("erasure (FR-011) with crypto-shredding", () => {
  it("withdrawing consent erases child data and shreds the key; proof and audit remain", async () => {
    const { client } = await registerParent(h, "d1@example.com");
    const id = await activateChild(h, client, "d1@example.com", 9);
    await h.db.query("INSERT INTO xp_events(id, child_id, reason, points, ref, created_at) VALUES (gen_random_uuid(), $1, 'x', 5, 'r', now())", [id]);
    expect((await h.ctx.keys.exists(id))).toBe(true);
    const r = await client.post(`/api/v1/children/${id}/withdraw`);
    expect(r.status).toBe(200);
    expect((await h.db.query("SELECT 1 FROM children WHERE id=$1", [id])).rows).toHaveLength(0);
    expect((await h.db.query("SELECT 1 FROM xp_events WHERE child_id=$1", [id])).rows).toHaveLength(0);
    expect(await h.ctx.keys.exists(id)).toBe(false);
    const er = (await h.db.query<{ done_at: Date | null; proof: string; due_at: Date; requested_at: Date }>("SELECT * FROM erasure_requests WHERE subject_id=$1", [id])).rows[0]!;
    expect(er.done_at).not.toBeNull();
    expect(er.proof).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(er.due_at).getTime() - new Date(er.requested_at).getTime()).toBe(72 * 3_600_000);
    expect((await h.db.query("SELECT 1 FROM audit_logs WHERE action='erasure.completed' AND target_ref=$1", [h.ctx.hasher.ref(id)])).rows).toHaveLength(1);
  });

  it("an encrypted blob cannot be decrypted after the key is shredded", async () => {
    const sid = crypto.randomUUID();
    const blob = await h.ctx.keys.encrypt(sid, "ảnh mặt của bé");
    expect(await h.ctx.keys.decrypt(sid, blob)).toBe("ảnh mặt của bé");
    await h.ctx.keys.shred(sid);
    await expect(h.ctx.keys.decrypt(sid, blob)).rejects.toThrow(/shredded/);
  });

  it("account erase needs the password and removes the parent with all children", async () => {
    const { client, id } = await registerParent(h, "d2@example.com");
    const kid = await activateChild(h, client, "d2@example.com", 8);
    expect((await client.post("/api/v1/account/erase", { password: "wrong password!!" })).status).toBe(401);
    expect((await client.post("/api/v1/account/erase", { password: "correct horse battery" })).status).toBe(200);
    expect((await h.db.query("SELECT 1 FROM users WHERE id=$1", [id])).rows).toHaveLength(0);
    expect((await h.db.query("SELECT 1 FROM children WHERE id=$1", [kid])).rows).toHaveLength(0);
    expect(await h.ctx.keys.exists(id)).toBe(false);
    expect(await h.ctx.keys.exists(kid)).toBe(false);
  });

  it("audit log and consent events are immutable at the database level", async () => {
    await expect(h.db.query("UPDATE audit_logs SET action='x'")).rejects.toThrow(/append-only/);
    await expect(h.db.query("DELETE FROM audit_logs")).rejects.toThrow(/append-only/);
    await expect(h.db.query("DELETE FROM consent_events")).rejects.toThrow(/append-only/);
  });
});
