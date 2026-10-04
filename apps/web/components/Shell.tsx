"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";

export function Shell({ children, level, title }: { children: ReactNode; level?: "l1" | "l2" | "l3"; title?: string }) {
  const { lang, setLang, t } = useI18n();
  const [dys, setDys] = useState(false);
  useEffect(() => { try { setDys(localStorage.getItem("ab_dys") === "1"); } catch { /* ignore */ } }, []);
  useEffect(() => { document.body.classList.toggle("dyslexia", dys); }, [dys]);
  return (
    <div data-level={level}>
      <a className="skip" href="#main">Bỏ qua tới nội dung</a>
      <header className="wrap row" style={{ justifyContent: "space-between" }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: "1.3em", textDecoration: "none" }}>🤖 {t("appName")}</Link>
        <div className="row">
          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={dys} onChange={(e) => { setDys(e.target.checked); try { localStorage.setItem("ab_dys", e.target.checked ? "1" : "0"); } catch { /* ignore */ } }} /> Dễ đọc
          </label>
          <button className="btn" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{t("lang")}</button>
        </div>
      </header>
      <main id="main" className="wrap">
        {title && <h1>{title}</h1>}
        {children}
      </main>
    </div>
  );
}
