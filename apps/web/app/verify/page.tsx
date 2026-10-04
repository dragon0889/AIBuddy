"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Shell } from "../../components/Shell";
import { ApiError, post } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

export default function Verify() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await post("/api/v1/auth/verify-email", { code }); router.push("/parent"); }
    catch (x) { setErr((x as ApiError).code === "otp_locked" ? "Nhập sai quá nhiều lần. Hãy gửi lại mã mới." : "Mã chưa đúng hoặc đã hết hạn."); }
  }
  return (
    <Shell title={t("verifyTitle")}>
      <form className="card stack" onSubmit={submit}>
        <p>Chúng tôi đã gửi mã 6 số tới email của bạn.</p>
        <label>{t("code")}<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
        {err && <p className="err" role="alert">{err}</p>}{msg && <p className="ok">{msg}</p>}
        <div className="row">
          <button className="btn btn-primary">{t("confirm")}</button>
          <button type="button" className="btn" onClick={async () => { try { await post("/api/v1/auth/resend-email-otp"); setMsg("Đã gửi lại mã."); } catch { setErr("Bạn gửi quá nhiều lần, đợi một lúc nhé."); } }}>{t("resend")}</button>
        </div>
      </form>
    </Shell>
  );
}
