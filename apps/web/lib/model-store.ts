"use client";
/** Mô hình huấn luyện được lưu **cục bộ** (IndexedDB của trình duyệt), không gửi lên máy chủ (Q1 chưa quyết → mặc định an toàn). */
const PREFIX = "aibuddy-model-";

export const modelKey = (project: string) => `indexeddb://${PREFIX}${project}`;

export async function saveLocalModel(project: string, model: { save: (url: string) => Promise<unknown> }, labels: string[]) {
  await model.save(modelKey(project));
  localStorage.setItem(`${PREFIX}${project}-labels`, JSON.stringify(labels));
}

export function localLabels(project: string): string[] | null {
  try { const s = localStorage.getItem(`${PREFIX}${project}-labels`); return s ? JSON.parse(s) : null; } catch { return null; }
}

export async function clearLocalModels() {
  try {
    const tf = await import("@tensorflow/tfjs");
    const models = await tf.io.listModels();
    for (const url of Object.keys(models)) if (url.includes(PREFIX)) await tf.io.removeModel(url);
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* không có model hoặc bộ nhớ bị chặn */ }
}
