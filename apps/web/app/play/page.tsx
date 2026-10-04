"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { ApiError, get, post } from "../../lib/api";
import { AVATARS, type Child } from "../../lib/avatars";
import { useAsync } from "../../lib/hooks";
import { useI18n } from "../../lib/i18n";

/** Chuyển hồ sơ trên thiết bị dùng chung: chọn biểu tượng + PIN (ADD-10). */
export default function Play() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, error } = useAsync(() => get<{ children: Child[] }>("/api/v1/children"), []);
  const [picked, setPicked] = useState<Child | null>(null);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  if (error?.status === 401) { router.replace("/login"); return null; }

  async function submit(p: string) {
    if (!picked) return;
    try { await post("/api/v1/auth/profile-switch", { childId: picked.id, pin: p }); router.push("/play/home"); }
    catch (x) {
      const code = (x as ApiError).code;
      setPin("");
      setMsg(code === "pin_locked" || code === "rate_limited" ? "Thử lại sau ít phút nhé." : code === "screen_time_exceeded" ? t("timeUp") : "Chưa đúng, thử lại nhé!");
    }
  }
  const press = (d: string) => { if (pin.length >= 4) return; const n = pin + d; setPin(n); if (n.length === 4) void submit(n); };

  return (
    <Shell title={picked ? t("enterPin") : t("whoPlays")}>
      {!picked && (
        <div className="grid">
          {data?.children.filter((c) => c.status === "ACTIVE").map((c) => (
            <button key={c.id} className="tile" onClick={() => { setPicked(c); setMsg(""); }} data-testid={`pick-${c.nickname}`}>
              <span className="emoji" aria-hidden>{AVATARS[c.avatar]}</span><strong>{c.nickname}</strong>
            </button>
          ))}
        </div>
      )}
      {picked && (
        <div className="card stack" style={{ maxWidth: 360, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem" }}>{AVATARS[picked.avatar]}</div>
          <div aria-live="polite" aria-label="PIN" style={{ fontSize: "2rem", letterSpacing: 8 }}>{"●".repeat(pin.length)}{"○".repeat(4 - pin.length)}</div>
          {msg && <p className="err" role="alert">{msg}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} className="btn" style={{ minHeight: 64, fontSize: "1.5rem" }} onClick={() => press(d)}>{d}</button>)}
            <button className="btn" style={{ minHeight: 64 }} onClick={() => { setPicked(null); setPin(""); }} aria-label="Quay lại">↩</button>
            <button className="btn" style={{ minHeight: 64, fontSize: "1.5rem" }} onClick={() => press("0")}>0</button>
            <button className="btn" style={{ minHeight: 64 }} onClick={() => setPin(pin.slice(0, -1))} aria-label="Xóa">⌫</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
