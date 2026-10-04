"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Shell } from "../../components/Shell";
import { ApiError, get, post, put } from "../../lib/api";
import { AVATARS, type Child } from "../../lib/avatars";
import { useAsync } from "../../lib/hooks";
import { useI18n } from "../../lib/i18n";

const TERMS = "2026-10";

function ConsentPanel({ c, onDone }: { c: Child; onDone: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [err, setErr] = useState("");
  const [childMode, setChildMode] = useState(false);
  async function guardian(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await post(`/api/v1/children/${c.id}/consent/guardian`, { code, termsVersion: TERMS, cameraAllowed: camera }); onDone(); }
    catch (x) { setErr((x as ApiError).code === "otp_locked" ? "Nhập sai quá nhiều lần – gửi lại mã." : "Mã chưa đúng hoặc đã hết hạn."); }
  }
  if (childMode)
    return (
      <div className="card stack" style={{ fontSize: "1.25em" }}>
        <p>🤖 {t("childAgreeText")}</p>
        <button className="btn btn-primary" style={{ fontSize: "1.2em" }} onClick={async () => { await post(`/api/v1/children/${c.id}/consent/child`); onDone(); }}>👍 {t("childAgree")}</button>
      </div>
    );
  return (
    <div className="card stack">
      <h3>{t("consentTitle")}</h3>
      <p>{t("consentBody")}</p>
      {!c.guardianVerified ? (
        <form className="stack" onSubmit={guardian}>
          <label>{t("code")} (đã gửi tới email/SMS của bạn)<input type="text" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
          <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)} /> {t("allowCamera")}</label>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="row">
            <button className="btn btn-primary">{t("confirm")}</button>
            <button type="button" className="btn" onClick={() => post(`/api/v1/children/${c.id}/consent/resend`)}>{t("resend")}</button>
          </div>
        </form>
      ) : (
        c.needsChildAgreement && <button className="btn btn-primary" onClick={() => setChildMode(true)}>Đưa máy cho con để con bấm “Con đồng ý”</button>
      )}
    </div>
  );
}

function ChildCard({ c, reload }: { c: Child; reload: () => void }) {
  const { t } = useI18n();
  const [mins, setMins] = useState(30);
  const [msg, setMsg] = useState("");
  const active = c.status === "ACTIVE";
  return (
    <div className="card stack" data-testid={`child-${c.nickname}`}>
      <div className="row"><span style={{ fontSize: "2.4rem" }} aria-hidden>{AVATARS[c.avatar]}</span><div><strong>{c.nickname}</strong> <span className="pill">Cấp {c.level}</span> <span className="pill">{active ? "Đang hoạt động" : "Chờ đồng ý"}</span></div></div>
      {!active && <ConsentPanel c={c} onDone={reload} />}
      {active && (
        <>
          <div className="row">
            <Link className="btn btn-primary" href="/play">{t("play")}</Link>
            <Link className="btn" href={`/parent/child?id=${c.id}`}>{t("report")}</Link>
          </div>
          <details>
            <summary>{t("settings")}</summary>
            <div className="stack">
              <label>{t("dailyMinutes")}<input type="number" min={5} max={240} value={mins} onChange={(e) => setMins(Number(e.target.value))} /></label>
              <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={c.cameraAllowed} onChange={async (e) => { await put(`/api/v1/children/${c.id}/settings`, { cameraAllowed: e.target.checked }); reload(); }} /> {t("allowCamera")}</label>
              <button className="btn" onClick={async () => { await put(`/api/v1/children/${c.id}/settings`, { dailyMinutes: mins }); setMsg("Đã lưu."); }}>{t("save")}</button>
              {msg && <p className="ok">{msg}</p>}
              <button className="btn btn-danger" onClick={async () => { if (confirm("Xóa vĩnh viễn toàn bộ dữ liệu của con? Không thể khôi phục.")) { await post(`/api/v1/children/${c.id}/withdraw`); reload(); } }}>{t("withdraw")}</button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

export default function Parent() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, error, reload } = useAsync(() => get<{ children: Child[] }>("/api/v1/children"), []);
  const [f, setF] = useState({ nickname: "", birthYear: new Date().getFullYear() - 8, birthMonth: 1, avatar: "fox", pin: "" });
  const [err, setErr] = useState("");
  if (error?.status === 401) { router.replace("/login"); return null; }
  async function add(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await post("/api/v1/children", f); setF({ ...f, nickname: "", pin: "" }); await reload(); }
    catch (x) {
      const code = (x as ApiError).code;
      setErr(code === "email_not_verified" || code === "forbidden" ? "Hãy xác minh email trước." : code === "age_out_of_range" ? "Nền tảng dành cho trẻ 6–15 tuổi." : t("errorGeneric"));
    }
  }
  return (
    <Shell title={t("children")}>
      <div className="row">
        <Link className="btn" href="/parent/guide">{t("guide")}</Link>
        <button className="btn" onClick={async () => { await post("/api/v1/auth/logout"); router.push("/"); }}>{t("logout")}</button>
      </div>
      {data?.children.map((c) => <ChildCard key={c.id} c={c} reload={reload} />)}
      <form className="card stack" onSubmit={add}>
        <h2>{t("addChild")}</h2>
        <label>{t("nickname")}<input type="text" required maxLength={30} value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></label>
        <div className="row">
          <label>{t("birthYear")}<input type="number" required min={2000} max={2100} value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: Number(e.target.value) })} /></label>
          <label>{t("birthMonth")}<input type="number" required min={1} max={12} value={f.birthMonth} onChange={(e) => setF({ ...f, birthMonth: Number(e.target.value) })} /></label>
        </div>
        <fieldset><legend>Hình đại diện</legend>
          <div className="row">{Object.entries(AVATARS).map(([k, e]) => <button type="button" key={k} className={`tile ${f.avatar === k ? "selected" : ""}`} aria-pressed={f.avatar === k} aria-label={k} onClick={() => setF({ ...f, avatar: k })}><span className="emoji">{e}</span></button>)}</div>
        </fieldset>
        <label>{t("pin4")}<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} autoComplete="off" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary">{t("create")}</button>
      </form>
      <details className="card">
        <summary>{t("eraseAccount")}</summary>
        <button className="btn btn-danger" onClick={async () => { const pw = prompt("Nhập mật khẩu để xác nhận xóa toàn bộ tài khoản và dữ liệu của con:"); if (pw) { try { await post("/api/v1/account/erase", { password: pw }); router.push("/"); } catch { alert("Mật khẩu chưa đúng."); } } }}>{t("eraseAccount")}</button>
      </details>
    </Shell>
  );
}
