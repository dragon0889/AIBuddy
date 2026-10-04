"use client";
/** Chọn backend TF.js: WASM (SIMD) mặc định theo benchmark Sprint 1 (D1), rồi WebGL, cuối cùng CPU. */
export async function initBackend(): Promise<string> {
  const tf = await import("@tensorflow/tfjs");
  const wasm = await import("@tensorflow/tfjs-backend-wasm");
  wasm.setWasmPaths("/tfjs-wasm/"); // tự host, không dùng CDN
  for (const b of ["wasm", "webgl", "cpu"]) {
    try {
      if ((await tf.setBackend(b)) && tf.getBackend() === b) { await tf.ready(); return b; }
    } catch { /* thử backend kế tiếp */ }
  }
  throw new Error("no TF.js backend available");
}
