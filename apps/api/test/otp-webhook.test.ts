import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebhookOtpSender } from "../src/lib/otp.ts";

let received: { auth?: string; body?: any }[] = [];
let status = 200;
const srv = createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { received.push({ auth: req.headers.authorization, body: JSON.parse(b) }); res.statusCode = status; res.end("{}"); });
});
let url = "";
beforeAll(async () => { await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r)); url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/otp`; });
afterAll(() => { srv.close(); });

describe("WebhookOtpSender", () => {
  it("posts the code with a bearer token and fails loudly on provider errors", async () => {
    const s = new WebhookOtpSender(url, "secret-token");
    await s.send("email", "a@example.com", "123456", "email_verify");
    expect(received[0]).toEqual({ auth: "Bearer secret-token", body: { channel: "email", to: "a@example.com", code: "123456", purpose: "email_verify" } });
    status = 500;
    await expect(s.send("sms", "+84901234567", "654321", "guardian_consent")).rejects.toThrow(/otp_delivery_failed/);
  });
  it("rejects non-HTTPS provider URLs", () => {
    expect(() => new WebhookOtpSender("http://example.com/otp", "t")).toThrow();
  });
});
