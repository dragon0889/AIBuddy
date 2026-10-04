"use client";
import Link from "next/link";
import { Mascot } from "../components/Mascot";
import { Shell } from "../components/Shell";
import { useI18n } from "../lib/i18n";

export default function Home() {
  const { t } = useI18n();
  return (
    <Shell>
      <div className="row" style={{ alignItems: "center" }}>
        <Mascot />
        <div className="bubble"><h1 style={{ margin: 0 }}>{t("tagline")}</h1></div>
      </div>
      <div className="card stack">
        <p>Dành cho trẻ 6–15 tuổi, có phụ huynh đồng hành. Ảnh và âm thanh của con không rời khỏi thiết bị.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/register">{t("register")}</Link>
          <Link className="btn" href="/login">{t("login")}</Link>
        </div>
      </div>
    </Shell>
  );
}
