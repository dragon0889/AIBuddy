"use client";
import { useEffect, useState } from "react";

type Phase = { name: string; ms: number };
type Result = {
  backend: string;
  samples: number;
  classes: number;
  epochs: number;
  phases: Phase[];
  trainMs: number;
  totalMs: number;
  testAccuracy: number;
  finalLoss: number;
  leakedTensors: number;
  network: { url: string; method: string; hasBody: boolean }[];
  error?: string;
};

declare global {
  interface Window {
    __spikeResult?: Result;
    __runSpike?: (opts?: { backend?: string; perClass?: number; epochs?: number }) => Promise<Result>;
  }
}

const SHAPES = ["circle", "square", "triangle"] as const;

/** Ảnh tổng hợp: hình khác nhau, màu/vị trí/kích thước ngẫu nhiên (thay cho webcam khi chạy tự động). */
function drawSample(canvas: HTMLCanvasElement, cls: number, rnd: () => number) {
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `hsl(${Math.floor(rnd() * 360)} 20% ${70 + rnd() * 25}%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const hue = [0, 120, 220][cls]! + rnd() * 25;
  ctx.fillStyle = `hsl(${hue} 80% 45%)`;
  const s = 40 + rnd() * 50;
  const x = 20 + rnd() * (canvas.width - s - 40);
  const y = 20 + rnd() * (canvas.height - s - 40);
  ctx.beginPath();
  if (SHAPES[cls] === "circle") ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  else if (SHAPES[cls] === "square") ctx.rect(x, y, s, s);
  else { ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath(); }
  ctx.fill();
}

async function runSpike(opts: { backend?: string; perClass?: number; epochs?: number } = {}): Promise<Result> {
  const requests: Result["network"] = [];
  const origFetch = window.fetch.bind(window);
  // Ghi lại mọi request từ trang trong lúc chạy (kiểm chứng ADR-0002: không có dữ liệu ảnh rời máy).
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    requests.push({ url, method: init?.method ?? "GET", hasBody: init?.body != null });
    return origFetch(input, init);
  };
  const perClass = opts.perClass ?? 30;
  const epochs = opts.epochs ?? 20;
  const phases: Phase[] = [];
  const lap = (name: string, t0: number) => phases.push({ name, ms: performance.now() - t0 });
  try {
    const tf = await import("@tensorflow/tfjs");
    const mlCore = await import("@aibuddy/ml-core");
    const want = opts.backend ?? "webgl";
    let t = performance.now();
    if (want === "wasm") {
      const wasm = await import("@tensorflow/tfjs-backend-wasm");
      wasm.setWasmPaths("/tfjs-wasm/");
    }
    const ok = await tf.setBackend(want);
    await tf.ready();
    // setBackend trả false (không ném lỗi) khi backend không khởi tạo được → phải coi là lỗi, tránh đo nhầm backend.
    if (!ok || tf.getBackend() !== want) throw new Error(`backend "${want}" unavailable (got ${tf.getBackend()})`);
    lap(`init backend (${tf.getBackend()})`, t);
    const baselineTensors = tf.memory().numTensors;

    t = performance.now();
    const embedder = await mlCore.loadEmbedder();
    lap("load MobileNet (2 MB, tự host)", t);

    // warm-up (biên dịch shader/khởi tạo) – tách riêng để đo công bằng
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 224;
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    drawSample(canvas, 0, rnd);
    t = performance.now();
    await embedder.embed(canvas);
    lap("warm-up 1 khung", t);

    t = performance.now();
    const samples: import("@aibuddy/ml-core").Sample[] = [];
    for (let c = 0; c < 3; c++)
      for (let i = 0; i < perClass; i++) {
        drawSample(canvas, c, rnd);
        samples.push({ embedding: await embedder.embed(canvas), label: c });
      }
    lap(`trích đặc trưng ${samples.length} khung`, t);

    const { train, test } = mlCore.splitStratified(samples, 0.2);
    const res = await mlCore.trainHead(train, { numClasses: 3, epochs });
    phases.push({ name: `huấn luyện đầu phân loại (${epochs} lần học)`, ms: res.trainMs });
    const testAccuracy = mlCore.accuracy(res.model, test);

    mlCore.disposeModel(res.model);
    embedder.dispose();
    // Bước giải phóng: xoá mẫu trong RAM (SRS 7.2 bước 4)
    samples.length = 0;
    canvas.width = canvas.height = 0;
    const result: Result = {
      backend: tf.getBackend(),
      samples: perClass * 3,
      classes: 3,
      epochs,
      phases,
      trainMs: res.trainMs,
      // Thời gian người dùng chờ sau khi bấm "Học": trích đặc trưng + huấn luyện (không tính tải mô hình/khởi tạo)
      totalMs: phases.filter((p) => p.name.startsWith("trích") || p.name.startsWith("huấn")).reduce((a, p) => a + p.ms, 0),
      testAccuracy,
      finalLoss: res.history.at(-1)?.loss ?? NaN,
      leakedTensors: tf.memory().numTensors - baselineTensors,
      network: requests,
    };
    return (window.__spikeResult = result);
  } catch (e) {
    return (window.__spikeResult = {
      backend: opts.backend ?? "?", samples: 0, classes: 0, epochs, phases, trainMs: 0, totalMs: 0,
      testAccuracy: 0, finalLoss: NaN, leakedTensors: -1, network: requests, error: String(e),
    });
  } finally {
    window.fetch = origFetch;
  }
}

export default function MlSpike() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.__runSpike = runSpike; }, []);
  return (
    <main style={{ padding: 16 }}>
      <h1>Spike ML (Sprint 1)</h1>
      <p>Chạy: ảnh tổng hợp → MobileNet → huấn luyện đầu phân loại. Kết quả hiển thị bên dưới; công cụ tự động gọi <code>window.__runSpike()</code>.</p>
      <button disabled={busy} onClick={async () => { setBusy(true); setResult(await runSpike({ backend: new URLSearchParams(location.search).get("backend") ?? "webgl" })); setBusy(false); }}>
        {busy ? "Đang chạy…" : "Chạy benchmark"}
      </button>
      <pre data-testid="result">{result ? JSON.stringify(result, null, 2) : "chưa chạy"}</pre>
    </main>
  );
}
