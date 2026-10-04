"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChildGate, useChildMe } from "../../../components/ChildGate";
import { Mascot } from "../../../components/Mascot";
import { ChoiceStep, DiscussionStep, DragDropStep, ShortTextStep, SpotStep, StoryStep, UnpluggedStep, type StepResult } from "../../../components/steps";
import { ApiError, get, post } from "../../../lib/api";
import { enqueue, gradeLocal, isNetworkError } from "../../../lib/offline";
import { loc, useI18n } from "../../../lib/i18n";
import type { Lesson } from "../../../lib/lessons";

type Done = { xpAwarded: number; totalXp: number; newBadges: { id: string; vi: string }[]; next: { lessonId: string | null } };

function Player() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const at = Number(sp.get("at") ?? 0);
  const { lang } = useI18n();
  const { me, reload } = useChildMe();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [idx, setIdx] = useState(at);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    get<Lesson>(`/api/v1/child/lessons/${id}`).then(setLesson).catch((e: ApiError) => setErr(e.code === "camera_not_allowed" ? "Bài này cần camera. Nhờ bố mẹ bật camera trong cài đặt nhé." : "Không mở được bài này."));
  }, [id]);

  if (err) return <div className="card stack"><p className="err" role="alert">{err}</p><Link className="btn" href="/play/home">Về trang chính</Link></div>;
  if (!lesson) return <p>Đang tải…</p>;

  if (done)
    return (
      <div className="card stack" data-testid="lesson-done">
        <div className="row"><Mascot /><div className="bubble"><h2 style={{ margin: 0 }}>Giỏi quá! 🎉</h2><p>+{done.xpAwarded} điểm · Tổng {done.totalXp} điểm</p>
          {done.newBadges.map((b) => <p key={b.id}>🏅 Huy hiệu mới: <strong>{b.vi}</strong></p>)}</div></div>
        <div className="row">
          {done.next.lessonId && <Link className="btn btn-primary" href={`/play/lesson?id=${done.next.lessonId}`}>Bài tiếp theo</Link>}
          <Link className="btn" href="/play/home" onClick={() => void reload()}>Về trang chính</Link>
        </div>
      </div>
    );

  const step = lesson.steps[idx]!;
  const submit = async (answer?: unknown): Promise<StepResult> => {
    const path = `/api/v1/child/lessons/${id}/steps`;
    try {
      return await post<{ correct: boolean | null; feedback?: string; xpAwarded: number }>(path, { stepId: step.id, answer });
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Mất mạng: phản hồi tại máy, xếp hàng để đồng bộ (máy chủ sẽ chấm lại và tính điểm).
      enqueue(me.id, path, { stepId: step.id, answer });
      return { ...gradeLocal(step, answer), xpAwarded: 0 };
    }
  };
  const next = async () => {
    if (idx + 1 < lesson.steps.length) { setIdx(idx + 1); return; }
    const path = `/api/v1/child/lessons/${id}/complete`;
    try { setDone(await post<Done>(path)); }
    catch (e) {
      if (!isNetworkError(e)) throw e;
      enqueue(me.id, path, {});
      setDone({ xpAwarded: 0, totalXp: me.xp, newBadges: [], next: { lessonId: null } });
    }
  };
  const common = { submit, onNext: next, level: lesson.level, autoRead: lesson.level === 1 };

  return (
    <div className="stack">
      <h1>{loc(lesson.title, lang)}</h1>
      <div className="bar" role="progressbar" aria-label="Tiến độ bài học" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={idx}><i style={{ width: `${(100 * idx) / lesson.steps.length}%` }} /></div>
      <div className="card" key={step.id} data-testid={`step-${step.type}`}>
        {step.type === "story" && <StoryStep step={step} {...common} />}
        {step.type === "choice" && <ChoiceStep step={step} {...common} />}
        {step.type === "drag_drop" && <DragDropStep step={step} {...common} />}
        {step.type === "short_text" && <ShortTextStep step={step} {...common} />}
        {step.type === "spot_ai_mistake" && <SpotStep step={step} {...common} />}
        {step.type === "discussion" && <DiscussionStep step={step} {...common} />}
        {step.type === "unplugged" && <UnpluggedStep step={step} {...common} />}
        {step.type === "ml_task" && (
          <div className="stack"><h2>🎥 Xưởng dạy máy</h2><p>Hãy cùng dạy máy nhận ra: {step.labels.map((l) => loc(l, lang)).join(", ")}. Ảnh con chụp chỉ ở trên máy này.</p>
            <Link className="btn btn-primary" href={`/play/studio?project=${step.project}&lesson=${id}&step=${step.id}&idx=${idx}&labels=${encodeURIComponent(step.labels.map((l) => loc(l, lang)).join("|"))}`}>Mở xưởng</Link></div>
        )}
        {step.type === "block_task" && (
          <div className="stack"><h2>🧩 Khối lệnh</h2><p>{loc(step.goal, lang)}</p>
            <Link className="btn btn-primary" href={`/play/blocks?lesson=${id}&step=${step.id}&idx=${idx}`}>Mở sân chơi</Link></div>
        )}
      </div>
    </div>
  );
}

export default function Page() { return <ChildGate><Suspense><Player /></Suspense></ChildGate>; }
