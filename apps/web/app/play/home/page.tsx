"use client";
import Link from "next/link";
import { ChildGate, useChildMe } from "../../../components/ChildGate";
import { Mascot } from "../../../components/Mascot";
import { get } from "../../../lib/api";
import { AVATARS } from "../../../lib/avatars";
import { useAsync } from "../../../lib/hooks";
import { useEffect } from "react";
import { type LessonListItem, pillarEmoji, pillarName } from "../../../lib/lessons";

type Assess = { id: string; kind: string; title: string; items: number; takenBefore: boolean };

function Home() {
  const { me, exit } = useChildMe();
  const lessons = useAsync(() => get<{ lessons: LessonListItem[] }>("/api/v1/child/lessons"), []);
  const next = useAsync(() => get<{ lessonId: string | null; reason: string }>("/api/v1/child/next"), []);
  const assess = useAsync(() => get<{ assessments: Assess[] }>("/api/v1/child/assessments"), []);
  // Tải trước các bài chưa học để học được khi mất mạng (service worker lưu nội dung bài, không lưu dữ liệu cá nhân).
  useEffect(() => { for (const l of (lessons.data?.lessons ?? []).filter((x) => !x.locked && x.status !== "completed" && !x.requiresCamera).slice(0, 30)) void fetch(`/api/v1/child/lessons/${l.id}`).catch(() => {}); }, [lessons.data]);
  const pre = assess.data?.assessments.find((a) => a.kind === "pre");
  const post = assess.data?.assessments.find((a) => a.kind === "post");
  const mis = assess.data?.assessments.find((a) => a.kind === "misconception");
  const list = lessons.data?.lessons ?? [];
  const doneCount = list.filter((l) => l.status === "completed").length;
  const nextLesson = list.find((l) => l.id === next.data?.lessonId);
  const byPillar = Object.entries(list.reduce<Record<string, LessonListItem[]>>((acc, l) => { (acc[l.pillar] ??= []).push(l); return acc; }, {}));

  return (
    <>
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <div className="row"><span style={{ fontSize: "3rem" }} aria-hidden>{AVATARS[me.avatar]}</span>
          <div><h1 style={{ margin: 0 }}>Chào {me.nickname}!</h1><span className="pill">⭐ {me.xp} điểm</span> <span className="pill">Cấp {me.level}</span>
            {me.daysThisWeek !== undefined && <span className="pill">📅 {me.daysThisWeek} ngày học tuần này</span>}</div></div>
        <button className="btn" onClick={exit}>Thoát</button>
      </div>

      {me.badges.length > 0 && <div className="card"><strong>Huy hiệu:</strong> {me.badges.map((b) => <span key={b.id} className="pill" title={b.descVi} style={{ margin: 4 }}>🏅 {b.vi}</span>)}</div>}

      {pre && !pre.takenBefore && (
        <div className="card row"><Mascot /><div className="bubble"><strong>Khởi động cùng Bud!</strong> Vài câu hỏi vui giúp Bud biết con đã biết gì (không bị chấm điểm).</div>
          <Link className="btn btn-primary" href={`/play/assess?id=${pre.id}`}>Bắt đầu</Link></div>
      )}

      {nextLesson && (
        <div className="card row" style={{ borderColor: "var(--ab-primary)" }}>
          <Mascot /><div className="bubble"><strong>Bài tiếp theo cho con:</strong> {nextLesson.title}
            {next.data?.reason === "review_weak_pillar" && <p className="muted">Bud chọn bài này để ôn lại phần con muốn luyện thêm.</p>}</div>
          <Link className="btn btn-primary" href={`/play/lesson?id=${nextLesson.id}`}>Học thôi!</Link>
        </div>
      )}

      <h2>Hành trình của con ({doneCount}/{list.length})</h2>
      <div className="bar" role="progressbar" aria-label="Tiến độ hành trình" aria-valuemin={0} aria-valuemax={Math.max(1, list.length)} aria-valuenow={doneCount}><i style={{ width: `${(100 * doneCount) / Math.max(1, list.length)}%` }} /></div>
      {byPillar.map(([p, ls]) => (
        <section key={p} className="card">
          <h3>{pillarEmoji[p]} {pillarName[p] ?? p}</h3>
          <div className="grid">
            {ls.map((l) => (
              <Link key={l.id} href={l.locked ? "#" : `/play/lesson?id=${l.id}`} className={`tile ${l.status === "completed" ? "selected" : ""}`} style={{ textDecoration: "none", color: "inherit", opacity: l.locked ? 0.5 : 1 }} aria-disabled={l.locked} data-testid={`lesson-${l.id}`}>
                <span className="emoji" aria-hidden>{l.status === "completed" ? "✅" : l.locked ? "🔒" : l.status === "in_progress" ? "▶️" : pillarEmoji[p]}</span>
                <strong>{l.title}</strong><br /><span className="muted">{l.minutes} phút{l.requiresCamera ? " · cần camera" : ""}</span>
                {l.locked && <><br /><span className="muted">Nhờ bố mẹ bật camera</span></>}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="row">
        {mis && <Link className="btn" href={`/play/assess?id=${mis.id}`}>Bạn nghĩ sao? (khảo sát vui)</Link>}
        {post && doneCount >= 3 && <Link className="btn" href={`/play/assess?id=${post.id}`}>Con đã học được gì?</Link>}
        <Link className="btn" href="/play/studio">🎥 Xưởng dạy máy</Link>
        <Link className="btn" href="/play/blocks">🧩 Sân chơi khối lệnh</Link>
      </div>
    </>
  );
}

export default function Page() { return <ChildGate><Home /></ChildGate>; }
