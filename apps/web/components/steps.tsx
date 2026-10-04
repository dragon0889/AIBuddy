"use client";
import { useState } from "react";
import { loc, useI18n } from "../lib/i18n";
import { chunkAnswer, markedToParts, type LessonStep } from "../lib/lessons";
import { Mascot } from "./Mascot";
import { useSpeech } from "./useSpeech";

export type StepResult = { correct: boolean | null; feedback?: string; xpAwarded: number };
type Submit = (answer?: unknown) => Promise<StepResult>;
type P<T extends LessonStep["type"]> = { step: Extract<LessonStep, { type: T }>; submit: Submit; onNext: () => void; level: 1 | 2 | 3; autoRead: boolean };

function Speak({ text }: { text: string }) {
  const { lang, t } = useI18n();
  const { speak, supported } = useSpeech(lang);
  if (!supported) return null;
  return <button type="button" className="btn" onClick={() => speak(text)} aria-label={`${t("readAloud")}: ${text.slice(0, 40)}`}>🔊 {t("readAloud")}</button>;
}

function Feedback({ r }: { r: StepResult | null }) {
  if (!r) return null;
  return (
    <div role="status" className="card" style={{ borderColor: r.correct === false ? "#dc2626" : "#15803d" }}>
      <div className="row"><Mascot mood={r.correct === false ? "oops" : "happy"} />
        <div className="bubble"><strong className={r.correct === false ? "err" : "ok"}>{r.correct === false ? "Chưa đúng, thử lại nhé!" : r.correct ? "Đúng rồi! 🎉" : "Tốt lắm!"}</strong>{r.feedback && <p>{r.feedback}</p>}{r.xpAwarded > 0 && <p>+{r.xpAwarded} điểm ⭐</p>}</div></div>
    </div>
  );
}

export function StoryStep({ step, submit, onNext }: P<"story">) {
  const { lang, t } = useI18n();
  const text = loc(step.text, lang);
  return (
    <div className="stack">
      <div className="row"><Mascot /><p className="bubble" style={{ fontSize: "1.15em" }}>{text}</p></div>
      <div className="row"><Speak text={text} /><button className="btn btn-primary" onClick={async () => { await submit(); onNext(); }}>{t("next")}</button></div>
    </div>
  );
}

export function ChoiceStep({ step, submit, onNext }: P<"choice">) {
  const { lang, t } = useI18n();
  const [res, setRes] = useState<StepResult | null>(null);
  const prompt = loc(step.prompt, lang);
  return (
    <div className="stack">
      <div className="row"><h2 style={{ margin: 0 }}>{prompt}</h2><Speak text={prompt} /></div>
      <div className="stack" role="group" aria-label={prompt}>
        {step.options.map((o, i) => (
          <button key={i} className="btn" style={{ width: "100%", textAlign: "left", fontSize: "1.05em" }} disabled={res?.correct === true} onClick={async () => setRes(await submit({ optionIndex: i }))}>{loc(o.text, lang)}</button>
        ))}
      </div>
      <Feedback r={res} />
      {res?.correct === true && <button className="btn btn-primary" onClick={onNext}>{t("next")}</button>}
    </div>
  );
}

export function DragDropStep({ step, submit, onNext }: P<"drag_drop">) {
  const { lang, t } = useI18n();
  const [sel, setSel] = useState<number | null>(null);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [res, setRes] = useState<StepResult | null>(null);
  const prompt = loc(step.prompt, lang);
  const complete = step.items.every((_, i) => place[String(i)]);
  return (
    <div className="stack">
      <div className="row"><h2 style={{ margin: 0 }}>{prompt}</h2><Speak text={prompt} /></div>
      <p className="muted">Chạm vào một thẻ, rồi chạm vào nhóm đúng.</p>
      <div className="row" aria-label="Các thẻ">
        {step.items.map((it, i) => !place[String(i)] && <button key={i} className={`tile ${sel === i ? "selected" : ""}`} aria-pressed={sel === i} onClick={() => setSel(i)}>{loc(it.label, lang)}</button>)}
      </div>
      <div className="grid">
        {step.targets.map((tg) => (
          <div key={tg.id} className="card" style={{ minHeight: 90 }}>
            <button className="btn" style={{ width: "100%" }} disabled={sel === null} onClick={() => { if (sel !== null) { setPlace({ ...place, [String(sel)]: tg.id }); setSel(null); setRes(null); } }}>📥 {loc(tg.label, lang)}</button>
            <ul>{step.items.map((it, i) => place[String(i)] === tg.id && <li key={i}>{loc(it.label, lang)} <button className="btn" aria-label="Bỏ ra" onClick={() => { const p = { ...place }; delete p[String(i)]; setPlace(p); setRes(null); }}>✖</button></li>)}</ul>
          </div>
        ))}
      </div>
      {complete && res?.correct !== true && <button className="btn btn-primary" onClick={async () => setRes(await submit({ placements: place }))}>{t("check")}</button>}
      <Feedback r={res} />
      {res?.correct === true && <button className="btn btn-primary" onClick={onNext}>{t("next")}</button>}
    </div>
  );
}

export function ShortTextStep({ step, submit, onNext }: P<"short_text">) {
  const { lang, t } = useI18n();
  const [v, setV] = useState("");
  const prompt = loc(step.prompt, lang);
  return (
    <div className="stack">
      <div className="row"><h2 style={{ margin: 0 }}>{prompt}</h2><Speak text={prompt} /></div>
      <label>Câu trả lời của con (đừng viết tên thật, địa chỉ hay số điện thoại nhé)<textarea rows={4} maxLength={500} value={v} onChange={(e) => setV(e.target.value)} /></label>
      <p className="muted">Câu trả lời này chỉ ở trên máy của con, không gửi đi đâu.</p>
      <button className="btn btn-primary" disabled={v.trim().length < 3} onClick={async () => { await submit(); onNext(); }}>{t("done")}</button>
    </div>
  );
}

export function SpotStep({ step, submit, onNext }: P<"spot_ai_mistake">) {
  const { lang, t } = useI18n();
  const answer = loc(step.aiAnswer, lang);
  const chunks = chunkAnswer(answer);
  const [on, setOn] = useState<string[]>([]);
  const [res, setRes] = useState<StepResult | null>(null);
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>🔎 Thám tử kiểm chứng: câu nào của AI có thể sai?</h2>
      <div className="card" aria-label="Câu trả lời của AI">
        <p><strong>🤖 AI nói:</strong></p>
        <p>{chunks.map((c, i) => (
          <button key={i} className={`chunk ${on.includes(c) ? "on" : ""}`} aria-pressed={on.includes(c)} onClick={() => { setRes(null); setOn(on.includes(c) ? on.filter((x) => x !== c) : [...on, c]); }}>{c}{" "}</button>
        ))}</p>
        <Speak text={answer} />
      </div>
      <details className="card"><summary>📚 Sách/nguồn tin cậy nói</summary><ul>{step.facts.map((f, i) => <li key={i}>{loc(f, lang)}</li>)}</ul></details>
      {res?.correct !== true && <button className="btn btn-primary" disabled={on.length === 0} onClick={async () => setRes(await submit({ marked: markedToParts(on, step.wrongParts) }))}>{t("check")}</button>}
      <Feedback r={res} />
      {res?.correct === true && <button className="btn btn-primary" onClick={onNext}>{t("next")}</button>}
    </div>
  );
}

export function DiscussionStep({ step, submit, onNext }: P<"discussion">) {
  const { lang, t } = useI18n();
  const prompt = loc(step.prompt, lang);
  return (
    <div className="stack">
      <div className="row"><Mascot mood="think" /><p className="bubble" style={{ fontSize: "1.15em" }}>💬 {prompt}</p></div>
      <p>Hãy trò chuyện cùng bố mẹ nhé!</p>
      <div className="row"><Speak text={prompt} /><button className="btn btn-primary" onClick={async () => { await submit(); onNext(); }}>{t("done")}</button></div>
    </div>
  );
}

export function UnpluggedStep({ step, submit, onNext }: P<"unplugged">) {
  const { lang, t } = useI18n();
  const text = loc(step.instructions, lang);
  return (
    <div className="stack">
      <h2>🎲 Chơi cùng gia đình (không cần máy)</h2>
      <p className="bubble" style={{ fontSize: "1.1em" }}>{text}</p>
      {step.materials.length > 0 && <p><strong>Cần chuẩn bị:</strong> {step.materials.map((m) => loc(m, lang)).join(", ")}</p>}
      <div className="row"><Speak text={text} /><button className="btn btn-primary" onClick={async () => { await submit(); onNext(); }}>{t("done")}</button></div>
    </div>
  );
}
