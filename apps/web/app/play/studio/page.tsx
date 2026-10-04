"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type * as TF from "@tensorflow/tfjs";
import type { Embedder, Sample } from "@aibuddy/ml-core";
import { ChildGate, useChildMe } from "../../../components/ChildGate";
import { LineChart } from "../../../components/LineChart";
import { Mascot } from "../../../components/Mascot";
import { post } from "../../../lib/api";
import { saveLocalModel } from "../../../lib/model-store";
import { initBackend } from "../../../lib/tf-backend";

type Phase = "intro" | "collect" | "training" | "test" | "saving";
const MIN_PER_LABEL = 5;

function Studio() {
  const q = useSearchParams();
  const router = useRouter();
  const { me } = useChildMe();
  const project = q.get("project") ?? "PRJ-02";
  const labels = (q.get("labels") ?? (project === "PRJ-01" ? "Bàn tay mở|Nắm tay" : "Kéo|Búa|Bao")).split("|");
  const lesson = q.get("lesson"), stepId = q.get("step"), stepIdx = Number(q.get("idx") ?? -1);

  const [phase, setPhase] = useState<Phase>("intro");
  const [adult, setAdult] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [counts, setCounts] = useState<number[]>(labels.map(() => 0));
  const [loss, setLoss] = useState<number[]>([]);
  const [acc, setAcc] = useState<number[]>([]);
  const [testAcc, setTestAcc] = useState<number | null>(null);
  const [firstAcc, setFirstAcc] = useState<number | null>(null);
  const [pred, setPred] = useState<{ label: number; confidence: number } | null>(null);
  const [corrections, setCorrections] = useState(0);
  const [trainMs, setTrainMs] = useState(0);
  const [epochs, setEpochs] = useState(20);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const embedder = useRef<Embedder | null>(null);
  const samples = useRef<Sample[]>([]);
  const holdout = useRef<Sample[]>([]);
  const model = useRef<TF.LayersModel | null>(null);
  const busy = useRef(false);
  const [capturing, setCapturing] = useState(false);

  const stopCamera = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; if (video.current) video.current.srcObject = null; }, []);

  /** Giải phóng toàn bộ: camera, mô hình, vector đặc trưng trong RAM (SRS 7.2 bước 4). */
  const wipe = useCallback(async () => {
    stopCamera();
    const ml = await import("@aibuddy/ml-core");
    if (model.current) { ml.disposeModel(model.current); model.current = null; }
    embedder.current?.dispose(); embedder.current = null;
    samples.current = []; holdout.current = [];
  }, [stopCamera]);

  useEffect(() => () => { void wipe(); }, [wipe]);
  useEffect(() => { const h = () => { stopCamera(); }; window.addEventListener("pagehide", h); return () => window.removeEventListener("pagehide", h); }, [stopCamera]);

  async function start() {
    setErr(""); setStatus("Đang chuẩn bị bộ não cho Bud…");
    try {
      await initBackend();
      const ml = await import("@aibuddy/ml-core");
      embedder.current = await ml.loadEmbedder();
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
      if (video.current) { video.current.srcObject = stream.current; await video.current.play(); }
      setStatus(""); setPhase("collect");
    } catch (e) {
      setStatus(""); setErr((e as Error).name === "NotAllowedError" ? "Máy chưa được phép dùng camera. Hãy nhờ bố mẹ cho phép trong trình duyệt." : "Không mở được camera hoặc bộ não của Bud trên máy này.");
      await wipe();
    }
  }

  async function capture(label: number, n = 1) {
    if (!embedder.current || !video.current || busy.current) return;
    busy.current = true; setCapturing(true);
    try {
      for (let k = 0; k < n; k++) {
        // Trích đặc trưng ngay lúc chụp (D2) – không giữ ảnh, chỉ giữ vector số.
        samples.current.push({ embedding: await embedder.current.embed(video.current), label });
        setCounts((c) => c.map((x, i) => (i === label ? x + 1 : x)));
        if (n > 1) await new Promise((r) => setTimeout(r, 120));
      }
    } finally { busy.current = false; setCapturing(false); }
  }

  async function train(retrain = false) {
    const ml = await import("@aibuddy/ml-core");
    if (!retrain) {
      const split = ml.splitStratified(samples.current, 0.2);
      holdout.current = split.test;
      samples.current = split.train;
    }
    setPhase("training"); setLoss([]); setAcc([]);
    if (model.current) { ml.disposeModel(model.current); model.current = null; }
    const r = await ml.trainHead(samples.current, { numClasses: labels.length, epochs, onEpoch: (e) => { setLoss((l) => [...l, e.loss]); setAcc((a) => [...a, e.accuracy]); } });
    model.current = r.model; setTrainMs(r.trainMs);
    const ta = ml.accuracy(r.model, holdout.current);
    setTestAcc(ta); if (firstAcc === null) setFirstAcc(ta);
    setPhase("test");
  }

  // Vòng thử trực tiếp
  useEffect(() => {
    if (phase !== "test") return;
    let stop = false;
    (async () => {
      const ml = await import("@aibuddy/ml-core");
      while (!stop) {
        if (embedder.current && model.current && video.current && !busy.current) {
          busy.current = true;
          try { const e = await embedder.current.embed(video.current); const p = ml.predict(model.current, e); setPred({ label: p.label, confidence: p.confidence }); } finally { busy.current = false; }
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
    return () => { stop = true; };
  }, [phase]);

  async function wrong(correctLabel: number) {
    if (!embedder.current || !video.current) return;
    busy.current = true;
    try { samples.current.push({ embedding: await embedder.current.embed(video.current), label: correctLabel }); } finally { busy.current = false; }
    setCorrections((c) => c + 1);
    setCounts((c) => c.map((x, i) => (i === correctLabel ? x + 1 : x)));
  }

  async function finish() {
    setPhase("saving");
    const total = samples.current.length + holdout.current.length;
    const improved = corrections > 0 && firstAcc !== null && (testAcc ?? 0) >= firstAcc;
    try {
      if (model.current) await saveLocalModel(project, model.current, labels);
      await post("/api/v1/child/projects", { project, accuracy: testAcc ?? 0, samples: total, improvedAfterReview: improved });
      if (lesson && stepId) await post(`/api/v1/child/lessons/${lesson}/steps`, { stepId });
    } catch { setErr("Chưa lưu được kết quả. Hãy thử lại."); setPhase("test"); return; }
    await wipe(); // xoá camera, vector, mô hình trong RAM
    router.push(lesson ? `/play/lesson?id=${lesson}&at=${stepIdx + 1}` : "/play/home");
  }

  if (!me.cameraAllowed) return <div className="card"><p className="err" role="alert">Xưởng dạy máy cần camera. Hãy nhờ bố mẹ bật camera trong phần Cài đặt.</p></div>;

  const canTrain = counts.every((c) => c >= MIN_PER_LABEL);
  return (
    <div className="stack">
      <h1>🎥 Xưởng dạy máy ({project})</h1>
      <div className="card" role="note" style={{ borderColor: "#15803d" }}>🔒 Ảnh của con <strong>chỉ ở trên máy này</strong>. Bud chỉ nhớ các con số, và xóa hết khi con xong.</div>
      {err && <p className="err" role="alert">{err}</p>}
      {status && <p role="status">{status}</p>}

      {phase === "intro" && (
        <div className="card stack">
          <div className="row"><Mascot /><p className="bubble">Con sẽ dạy máy nhận ra: <strong>{labels.join(", ")}</strong>. Có ba bước: <strong>1. Chụp mẫu → 2. Học → 3. Thử</strong>.</p></div>
          <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> Có người lớn ngồi cạnh con</label>
          <button className="btn btn-primary" disabled={!adult} onClick={start}>Bật camera và bắt đầu</button>
        </div>
      )}

      <div className="card" style={{ display: phase === "intro" || phase === "saving" ? "none" : "block" }}>
        <div className="row"><span className="lamp" aria-hidden /> <strong>Camera đang bật</strong></div>
        <video ref={video} muted playsInline style={{ width: "100%", maxWidth: 400, borderRadius: 12, background: "#111" }} aria-label="Hình từ camera" />
      </div>

      {phase === "collect" && (
        <div className="card stack">
          <h2>Bước 1: Chụp mẫu</h2>
          <p>Mỗi nhóm cần ít nhất {MIN_PER_LABEL} ảnh. Thay đổi góc tay, ánh sáng và nền để máy học tốt hơn!</p>
          <div className="grid">
            {labels.map((l, i) => (
              <div key={l} className="card stack">
                <strong>{l}</strong><div className="bar" role="progressbar" aria-label={`Số ảnh nhóm ${l}`} aria-valuemin={0} aria-valuemax={20} aria-valuenow={Math.min(20, counts[i]!)}><i style={{ width: `${Math.min(100, (counts[i]! / 20) * 100)}%` }} /></div>
                <span>{counts[i]} ảnh</span>
                <div className="row"><button className="btn btn-primary" disabled={capturing} onClick={() => capture(i)}>📸 Chụp</button><button className="btn" disabled={capturing} onClick={() => capture(i, 8)}>📸×8</button></div>
              </div>
            ))}
          </div>
          <label>Số lần học tập<input type="number" min={5} max={60} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} /></label>
          <button className="btn btn-primary" disabled={!canTrain} onClick={() => train(false)}>🧠 Bước 2: Cho máy học</button>
          <button className="btn btn-danger" onClick={async () => { samples.current = []; setCounts(labels.map(() => 0)); }}>Xóa hết mẫu</button>
        </div>
      )}

      {(phase === "training" || phase === "test") && (
        <div className="card stack">
          <h2>{phase === "training" ? "Máy đang học…" : "Máy đã học xong!"}</h2>
          <div className="grid"><LineChart title="Độ chính xác khi học" values={acc} max={1} color="#15803d" /><LineChart title="Độ sai (càng thấp càng tốt)" values={loss} color="#b91c1c" /></div>
          {phase === "test" && <p>Học trong {(trainMs / 1000).toFixed(1)} giây · Khi thử ảnh máy chưa từng thấy, máy đúng khoảng <strong>{Math.round((testAcc ?? 0) * 100)}%</strong>.</p>}
        </div>
      )}

      {phase === "test" && (
        <div className="card stack">
          <h2>Bước 3: Thử xem máy đoán gì</h2>
          <p aria-live="polite" style={{ fontSize: "1.4em" }}>Máy nghĩ đây là: <strong>{pred ? labels[pred.label] : "…"}</strong> {pred && `(${Math.round(pred.confidence * 100)}% chắc chắn)`}</p>
          <p className="muted">Nếu máy đoán sai, hãy bấm đúng tên rồi cho máy học lại. Đây là cách điều tra “vì sao máy sai”.</p>
          <div className="row">{labels.map((l, i) => <button key={l} className="btn" onClick={() => wrong(i)}>Đây là {l}</button>)}</div>
          {corrections > 0 && <p>Con đã sửa {corrections} lần. <button className="btn btn-primary" onClick={() => train(true)}>🔁 Học lại với dữ liệu mới</button></p>}
          <button className="btn btn-primary" onClick={finish}>Xong! Lưu kết quả và xóa ảnh</button>
        </div>
      )}
      {phase === "saving" && <p role="status">Đang lưu và dọn dẹp…</p>}
    </div>
  );
}

export default function Page() { return <ChildGate><Suspense><Studio /></Suspense></ChildGate>; }
