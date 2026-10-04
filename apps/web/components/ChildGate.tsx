"use client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, get, post } from "../lib/api";
import { isNetworkError } from "../lib/offline";
import { clearLocalModels } from "../lib/model-store";
import { clearLessonCache, flushQueue, registerSW } from "../lib/offline";
import { useI18n } from "../lib/i18n";
import { Shell } from "./Shell";
import { Mascot } from "./Mascot";
import type { Child } from "../lib/avatars";

export type ChildMe = Child & {
  xp: number; badges: { id: string; vi: string; descVi: string }[]; lessonsCompleted: number; daysThisWeek?: number; remainingSeconds: number;
};
const MeCtx = createContext<{ me: ChildMe; reload: () => Promise<void>; exit: () => Promise<void> } | null>(null);
export const useChildMe = () => useContext(MeCtx)!;

/** Bảo vệ khu vực của trẻ: cần phiên trẻ, gửi nhịp để tính thời gian dùng, hết giờ thì khóa (ADD-05). */
export function ChildGate({ children, title }: { children: ReactNode; title?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [me, setMe] = useState<ChildMe | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [offline, setOffline] = useState(false);
  const meRef = useRef<ChildMe | null>(null);

  const reload = async () => {
    try {
      const m = await get<ChildMe>("/api/v1/child/me"); meRef.current = m; setMe(m); setOffline(false);
      try { sessionStorage.setItem("ab_me_cache", JSON.stringify(m)); } catch { /* ignore */ }
    }
    catch (e) {
      if (isNetworkError(e)) {
        // Mất mạng: dùng bản hồ sơ đã thấy gần nhất trong phiên này để vẫn học được bài đã tải trước.
        try { const c = sessionStorage.getItem("ab_me_cache"); if (c) { setMe(JSON.parse(c)); setOffline(true); } } catch { /* ignore */ }
        return;
      }
      const err = e as ApiError;
      if (err.code === "screen_time_exceeded") setTimeUp(true);
      else if (err.status === 401) router.replace("/play");
    }
  };
  const exit = async () => {
    await clearLocalModels(); // xoá mô hình lưu cục bộ khi đổi người dùng (T13)
    clearLessonCache();
    try { sessionStorage.removeItem("ab_me_cache"); } catch { /* ignore */ }
    try { await post("/api/v1/child/exit"); } catch { /* đã hết phiên */ }
    router.push("/play");
  };

  useEffect(() => { registerSW(); void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    if (!me) return;
    const sync = () => { void flushQueue(me.id).then((n) => { if (n > 0) void reload(); }); };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try { await post("/api/v1/child/heartbeat", { seconds: 30 }); }
      catch (e) { const err = e as ApiError; if (err.code === "screen_time_exceeded") setTimeUp(true); else if (err.status === 401) router.replace("/play"); }
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  if (timeUp)
    return (
      <Shell>
        <div className="card stack" role="alert"><div className="row"><Mascot mood="happy" /><div className="bubble"><h2 style={{ margin: 0 }}>{t("timeUp")}</h2></div></div>
          <button className="btn btn-primary" onClick={exit}>{t("exit")}</button></div>
      </Shell>
    );
  if (!me) return <Shell><p>{t("loading")}</p></Shell>;
  return (
    <Shell level={`l${me.level}` as "l1" | "l2" | "l3"} title={title}>
      {offline && <p className="card" role="status">📴 Đang học khi không có mạng. Điểm sẽ được cập nhật khi có mạng trở lại.</p>}
      <MeCtx.Provider value={{ me, reload, exit }}>{children}</MeCtx.Provider>
    </Shell>
  );
}
