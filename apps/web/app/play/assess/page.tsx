"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { ChildGate } from "../../../components/ChildGate";
import { Mascot } from "../../../components/Mascot";
import { useSpeech } from "../../../components/useSpeech";
import { get, post } from "../../../lib/api";
import { useAsync } from "../../../lib/hooks";
import { useI18n } from "../../../lib/i18n";

type A = { id: string; kind: string; title: string; items: { id: string; prompt: string; options: string[] }[] };

function Quiz() {
  const id = useSearchParams().get("id") ?? "";
  const { lang } = useI18n();
  const { speak, supported } = useSpeech(lang);
  const { data } = useAsync(() => get<A>(`/api/v1/child/assessments/${id}`), [id]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [res, setRes] = useState<{ score: number; max: number } | null>(null);
  if (!data) return <p>Đang tải…</p>;
  if (res)
    return (
      <div className="card stack" data-testid="assess-done">
        <div className="row"><Mascot /><div className="bubble"><h2 style={{ margin: 0 }}>Cảm ơn con!</h2>
          {data.kind === "pre" || data.kind === "misconception" ? <p>Bud đã biết thêm về con rồi. Mình cùng học nhé!</p> : <p>Con trả lời đúng {res.score}/{res.max} câu. Giỏi lắm!</p>}</div></div>
        <Link className="btn btn-primary" href="/play/home">Về trang chính</Link>
      </div>
    );
  const it = data.items[i]!;
  const last = i === data.items.length - 1;
  return (
    <div className="stack">
      <h1>{data.title}</h1>
      <div className="bar" role="progressbar" aria-label="Tiến độ bài đánh giá" aria-valuemin={0} aria-valuemax={data.items.length} aria-valuenow={i}><i style={{ width: `${(100 * i) / data.items.length}%` }} /></div>
      <div className="card stack">
        <div className="row"><h2 style={{ margin: 0 }}>{it.prompt}</h2>{supported && <button className="btn" onClick={() => speak(`${it.prompt}. ${it.options.join(". ")}`)}>🔊</button>}</div>
        <div className="stack" role="radiogroup" aria-label={it.prompt}>
          {it.options.map((o, k) => <button key={k} role="radio" aria-checked={answers[it.id] === k} className={`tile ${answers[it.id] === k ? "selected" : ""}`} style={{ width: "100%", textAlign: "left" }} onClick={() => setAnswers({ ...answers, [it.id]: k })}>{o}</button>)}
        </div>
        <button className="btn btn-primary" disabled={answers[it.id] === undefined} onClick={async () => { if (!last) setI(i + 1); else setRes(await post(`/api/v1/child/assessments/${id}/submit`, { answers })); }}>{last ? "Xong" : "Tiếp"}</button>
      </div>
    </div>
  );
}
export default function Page() { return <ChildGate><Suspense><Quiz /></Suspense></ChildGate>; }
