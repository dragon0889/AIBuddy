"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Shell } from "../../components/Shell";
import { ApiError, post } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

const errText: Record<string, string> = {
  email_in_use: "Email này đã được đăng ký.",
  validation_error: "Vui lòng kiểm tra lại thông tin (mật khẩu tối thiểu 10 ký tự).",
  rate_limited: "Bạn thử quá nhiều lần, vui lòng đợi một lúc.",
};

export default function Register() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", phone: "", acceptTerms: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await post("/api/v1/auth/register", { email: f.email, password: f.password, phone: f.phone || undefined, locale: lang, acceptTerms: f.acceptTerms });
      router.push("/verify");
    } catch (x) { setErr(errText[(x as ApiError).code] ?? t("errorGeneric")); } finally { setBusy(false); }
  }
  return (
    <Shell title={t("register")}>
      <form className="card stack" onSubmit={submit}>
        <label>{t("email")}<input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>{t("password")}<input type="password" required minLength={10} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label>{t("phone")}<input type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" required checked={f.acceptTerms} onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })} /> {t("acceptTerms")}</label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary" disabled={busy}>{t("register")}</button>
      </form>
    </Shell>
  );
}
