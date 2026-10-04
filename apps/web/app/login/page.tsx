"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Shell } from "../../components/Shell";
import { ApiError, post } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

export default function Login() {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    try {
      const me = await post<{ role: string; emailVerified: boolean }>("/api/v1/auth/login", f);
      router.push(me.role === "admin" ? "/admin" : me.emailVerified ? "/parent" : "/verify");
    } catch (x) {
      const code = (x as ApiError).code;
      setErr(code === "rate_limited" ? "Bạn thử quá nhiều lần, vui lòng đợi một lúc." : "Email hoặc mật khẩu chưa đúng.");
    }
  }
  return (
    <Shell title={t("login")}>
      <form className="card stack" onSubmit={submit}>
        <label>{t("email")}<input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>{t("password")}<input type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary">{t("login")}</button>
      </form>
    </Shell>
  );
}
