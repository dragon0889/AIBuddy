"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Embedder } from "@aibuddy/ml-core";
import { blockPalette } from "@aibuddy/ui";
import { ChildGate, useChildMe } from "../../../components/ChildGate";
import { post } from "../../../lib/api";
import { localLabels, modelKey } from "../../../lib/model-store";
import { initBackend } from "../../../lib/tf-backend";

type Sprite = { x: number; rot: number; size: number; say: string };
const DEFAULT_LABELS = ["Kéo", "Búa", "Bao"];

function Blocks() {
  const q = useSearchParams();
  const router = useRouter();
  const { me } = useChildMe();
  const host = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("blockly/core").WorkspaceSvg | null>(null);
  const [sprite, setSprite] = useState<Sprite>({ x: 0, rot: 0, size: 100, say: "" });
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [live, setLive] = useState(false);
  const [current, setCurrent] = useState<string>("");
  const labelsRef = useRef(labels);
  const lessonId = q.get("lesson"), stepId = q.get("step"), idx = Number(q.get("idx") ?? -1);
  const spriteRef = useRef(sprite);
  spriteRef.current = sprite;

  // Trình thông dịch tối giản (không dùng scratch-vm do rủi ro giấy phép AGPL – xem báo cáo Sprint 1).
  const runLabel = (label: string) => {
    const ws = wsRef.current; if (!ws) return;
    const s = { ...spriteRef.current };
    const num = (b: import("blockly/core").Block, name: string) => Number(b.getInputTargetBlock(name)?.getFieldValue("NUM") ?? 0);
    for (const top of ws.getTopBlocks(true)) {
      if (top.type !== "ml_whenclassified" || top.getFieldValue("LABEL") !== label) continue;
      let steps = 0;
      for (let b = top.getNextBlock(); b && steps++ < 200; b = b.getNextBlock()) {
        if (b.type === "motion_movesteps") s.x = Math.max(-120, Math.min(120, s.x + num(b, "STEPS")));
        if (b.type === "motion_turnright") s.rot += num(b, "DEGREES");
        if (b.type === "looks_changesizeby") s.size = Math.max(30, Math.min(220, s.size + num(b, "CHANGE")));
        if (b.type === "looks_say") s.say = String(b.getInputTargetBlock("MESSAGE")?.getFieldValue("TEXT") ?? "");
      }
    }
    setSprite(s);
  };
  const runRef = useRef(runLabel); runRef.current = runLabel;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const SB = await import("scratch-blocks");
      if (disposed || !host.current) return;
      const Blockly = SB as unknown as typeof import("blockly/core");
      const found = localLabels(new URLSearchParams(location.search).get("project") ?? "PRJ-02") ?? DEFAULT_LABELS;
      setLabels(found); labelsRef.current = found;
      const opts = found.map((l) => [l, l] as [string, string]);
      Blockly.Blocks["ml_whenclassified"] = { init(this: import("blockly/core").Block) { this.jsonInit({ message0: "khi mô hình nhận ra %1", args0: [{ type: "field_dropdown", name: "LABEL", options: opts }], extensions: ["colours_sensing", "shape_hat"] }); } };
      try { SB.ScratchMsgs.setLocale("vi"); } catch { SB.ScratchMsgs.setLocale("en"); }
      const style = (c: string) => ({ colourPrimary: c, colourSecondary: c, colourTertiary: c });
      const theme = Blockly.Theme.defineTheme("aibuddy-aa", {
        name: "aibuddy-aa",
        blockStyles: { ...Object.fromEntries(Object.entries(blockPalette).map(([k, c]) => [k, style(c)])), textField: { colourPrimary: "#FFFFFF", colourSecondary: "#FFFFFF", colourTertiary: "#9CA3AF" } },
      } as never);
      const num = (type: string, input: string, field: string, v: number | string) => ({ kind: "block", type, inputs: { [input]: { shadow: { type: field === "TEXT" ? "text" : "math_number", fields: { [field]: v } } } } });
      const ws = SB.inject(host.current, {
        theme, media: "/blockly-media/", sounds: false, scrollbars: true,
        toolbox: { kind: "categoryToolbox", contents: [
          { kind: "category", name: "Mô hình AI", colour: blockPalette.sensing, secondaryColour: blockPalette.sensing, contents: [{ kind: "block", type: "ml_whenclassified" }] },
          { kind: "category", name: "Chuyển động", colour: blockPalette.motion, secondaryColour: blockPalette.motion, contents: [num("motion_movesteps", "STEPS", "NUM", 10), num("motion_turnright", "DEGREES", "NUM", 15)] },
          { kind: "category", name: "Hiển thị", colour: blockPalette.looks, secondaryColour: blockPalette.looks, contents: [num("looks_say", "MESSAGE", "TEXT", "Xin chào!"), num("looks_changesizeby", "CHANGE", "NUM", 10)] },
        ] },
      } as never);
      wsRef.current = ws;
      // Móc kiểm thử E2E (chỉ khi có ?e2e=1): nạp chương trình khối bằng JSON.
      if (new URLSearchParams(location.search).get("e2e") === "1")
        (window as unknown as Record<string, unknown>).__loadProgram = (p: unknown) => Blockly.serialization.workspaces.load(p as never, ws);
    })();
    return () => { disposed = true; wsRef.current?.dispose(); wsRef.current = null; };
  }, []);

  // Chế độ camera: dùng mô hình đã huấn luyện (lưu cục bộ) để điều khiển nhân vật.
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stopLive = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setLive(false); };
  useEffect(() => stopLive, []);
  async function startLive() {
    if (!me.cameraAllowed) return;
    const project = q.get("project") ?? "PRJ-02";
    await initBackend();
    const tf = await import("@tensorflow/tfjs");
    const ml = await import("@aibuddy/ml-core");
    let model: import("@tensorflow/tfjs").LayersModel;
    try { model = await tf.loadLayersModel(modelKey(project)); } catch { alert("Con chưa dạy máy xong. Hãy vào Xưởng dạy máy trước nhé!"); return; }
    const emb: Embedder = await ml.loadEmbedder();
    stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
    if (video.current) { video.current.srcObject = stream.current; await video.current.play(); }
    setLive(true);
    let last = "";
    while (stream.current) {
      const p = ml.predict(model, await emb.embed(video.current!));
      const name = labelsRef.current[p.label] ?? "";
      if (p.confidence > 0.7 && name !== last) { last = name; setCurrent(name); runRef.current(name); }
      await new Promise((r) => setTimeout(r, 400));
    }
    emb.dispose(); model.dispose();
  }

  return (
    <div className="stack">
      <h1>🧩 Sân chơi khối lệnh</h1>
      <p>Kéo khối <strong>“khi mô hình nhận ra …”</strong> rồi nối các khối chuyển động. Bấm nút bên dưới để giả vờ máy nhận ra một nhãn, hoặc dùng camera với mô hình con đã dạy.</p>
      <div ref={host} data-testid="workspace" style={{ height: 380, border: "2px solid #9ca3af", borderRadius: 12 }} />
      <div className="card stack">
        <svg viewBox="-150 -60 300 120" width="100%" style={{ maxWidth: 480, background: "#f0f9ff", borderRadius: 12 }} role="img" aria-label={`Nhân vật ở vị trí ${sprite.x}`}>
          <g transform={`translate(${sprite.x},0) rotate(${sprite.rot}) scale(${sprite.size / 100})`}><text fontSize="40" textAnchor="middle" dominantBaseline="middle" data-testid="sprite">🤖</text></g>
          {sprite.say && <text y="-42" textAnchor="middle" fontSize="12">{sprite.say}</text>}
        </svg>
        <p data-testid="sprite-state">x = {sprite.x}, xoay = {sprite.rot}°, cỡ = {sprite.size}%</p>
        <div className="row">
          {labels.map((l) => <button key={l} className="btn" onClick={() => { setCurrent(l); runLabel(l); }}>Giả vờ nhận ra “{l}”</button>)}
          <button className="btn" onClick={() => setSprite({ x: 0, rot: 0, size: 100, say: "" })}>Đặt lại</button>
        </div>
        {me.cameraAllowed && <div className="row">{!live ? <button className="btn btn-primary" onClick={startLive}>📷 Dùng camera</button> : <button className="btn btn-danger" onClick={stopLive}>Tắt camera</button>}{live && <span><span className="lamp" aria-hidden /> Camera đang bật · nhận ra: <strong>{current || "…"}</strong></span>}</div>}
        <video ref={video} muted playsInline style={{ display: live ? "block" : "none", maxWidth: 240, borderRadius: 12 }} aria-label="Hình từ camera" />
      </div>
      <button className="btn btn-primary" onClick={async () => { stopLive(); if (lessonId && stepId) await post(`/api/v1/child/lessons/${lessonId}/steps`, { stepId }); router.push(lessonId ? `/play/lesson?id=${lessonId}&at=${idx + 1}` : "/play/home"); }}>Xong</button>
    </div>
  );
}

export default function Page() { return <ChildGate><Suspense><Blocks /></Suspense></ChildGate>; }
