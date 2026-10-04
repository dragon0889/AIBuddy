"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Shell } from "../../../components/Shell";
import { get } from "../../../lib/api";
import { useAsync } from "../../../lib/hooks";
import { useI18n } from "../../../lib/i18n";

type Weekly = {
  child: { nickname: string; level: number };
  minutesPerDay: { day: string; minutes: number }[];
  lessonsThisWeek: { id: string; title: string }[];
  xpThisWeek: number;
  outcomes: { practiced: number; total: number; items: { id: string; pillar: string; statement: string; practiced: boolean }[] };
  assessments: { kind: string; scope: string; score: number; max: number; at: string }[];
  projects: { project: string; accuracy: number; samples: number; improvedAfterReview: boolean }[];
};
type Co = { recent: { lessonId: string; title: string; talkAbout: string[]; activity: string }[]; upNext: { lessonId: string; title: string; talkAbout: string[]; activity: string; reason: string } | null };

const kindName: Record<string, string> = { pre: "Đầu vào", post: "Cuối kỳ", micro: "Mini-quiz", misconception: "Khảo sát" };

function Report() {
  const id = useSearchParams().get("id") ?? "";
  const { t } = useI18n();
  const w = useAsync(() => get<Weekly>(`/api/v1/children/${id}/weekly-summary`), [id]);
  const co = useAsync(() => get<Co>(`/api/v1/children/${id}/co-learning`), [id]);
  const d = w.data;
  return (
    <Shell title={`${t("report")}${d ? ` – ${d.child.nickname}` : ""}`}>
      {d && (
        <>
          <section className="card stack">
            <h2>Tuần này</h2>
            <p>Đã học <strong>{d.lessonsThisWeek.length}</strong> bài · <strong>{d.xpThisWeek}</strong> {t("xp")}</p>
            <ul>{d.lessonsThisWeek.map((l) => <li key={l.id}>{l.title}</li>)}</ul>
            <div role="img" aria-label="Số phút mỗi ngày" className="stack">
              {d.minutesPerDay.map((m) => <div key={m.day} className="row"><span style={{ width: 100 }}>{m.day.slice(5)}</span><div className="bar" aria-hidden style={{ flex: 1 }}><i style={{ width: `${Math.min(100, m.minutes * 3)}%` }} /></div><span>{m.minutes} phút</span></div>)}
            </div>
          </section>
          <section className="card stack">
            <h2>Kỹ năng đã luyện: {d.outcomes.practiced}/{d.outcomes.total}</h2>
            <div className="bar" role="progressbar" aria-label="Kỹ năng đã luyện" aria-valuemin={0} aria-valuemax={d.outcomes.total} aria-valuenow={d.outcomes.practiced}><i style={{ width: `${(100 * d.outcomes.practiced) / Math.max(1, d.outcomes.total)}%` }} /></div>
            <ul>{d.outcomes.items.map((o) => <li key={o.id}>{o.practiced ? "✅" : "⬜"} {o.statement}</li>)}</ul>
          </section>
          {d.assessments.length > 0 && <section className="card"><h2>Kết quả đánh giá</h2><ul>{d.assessments.map((a, i) => <li key={i}>{kindName[a.kind] ?? a.kind}: {a.score}/{a.max}</li>)}</ul></section>}
          {d.projects.length > 0 && <section className="card"><h2>Dự án AI</h2><ul>{d.projects.map((p, i) => <li key={i}>{p.project}: độ chính xác {(p.accuracy * 100).toFixed(0)}% với {p.samples} mẫu {p.improvedAfterReview ? "· đã cải thiện sau khi xem lại lỗi 🌱" : ""}</li>)}</ul></section>}
        </>
      )}
      {co.data && (
        <section className="card stack">
          <h2>Học cùng con</h2>
          {co.data.upNext && <div><h3>Chuẩn bị cho bài tiếp theo: {co.data.upNext.title}</h3><p><strong>Hoạt động:</strong> {co.data.upNext.activity}</p></div>}
          {co.data.recent.map((r) => <div key={r.lessonId}><h3>{r.title}</h3><p>Hãy hỏi con:</p><ul>{r.talkAbout.map((q) => <li key={q}>{q}</li>)}</ul><p><strong>Hoạt động cùng con:</strong> {r.activity}</p></div>)}
        </section>
      )}
    </Shell>
  );
}

export default function Page() { return <Suspense><Report /></Suspense>; }
