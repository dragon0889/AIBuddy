"use client";
import { ApiError, post } from "./api";
import type { LessonStep } from "./lessons";

/** Đăng ký service worker (chỉ ở production/HTTPS hoặc localhost). */
export function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => { /* không bắt buộc */ });
}
export function clearLessonCache() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear" });
}

/** Chấm tại máy khi mất mạng (chỉ để cho trẻ phản hồi tức thì; máy chủ chấm lại và tính điểm khi đồng bộ). */
export function gradeLocal(step: LessonStep, answer: unknown): { correct: boolean | null; feedback?: string } {
  const a = (answer ?? {}) as Record<string, unknown>;
  if (step.type === "choice") { const o = step.options[Number(a.optionIndex)]; return { correct: !!o?.correct, feedback: o?.feedback?.vi }; }
  if (step.type === "spot_ai_mistake") { const m = (a.marked as string[]) ?? []; return { correct: step.wrongParts.length === m.length && step.wrongParts.every((w) => m.includes(w)), feedback: step.feedback.vi }; }
  if (step.type === "drag_drop") { const p = (a.placements as Record<string, string>) ?? {}; return { correct: step.items.every((it, i) => p[String(i)] === it.target) }; }
  return { correct: null };
}

type Queued = { childId: string; path: string; body: unknown };
const KEY = "aibuddy-sync-queue";
const read = (): Queued[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (q: Queued[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* đầy bộ nhớ */ } };

export const isNetworkError = (e: unknown) => !(e instanceof ApiError);
export function enqueue(childId: string, path: string, body: unknown) { write([...read(), { childId, path, body }]); }
export const pendingCount = (childId: string) => read().filter((q) => q.childId === childId).length;

/** Gửi lại các thao tác đã làm khi mất mạng, theo thứ tự. Dừng ở lỗi mạng; bỏ qua mục bị từ chối (4xx). */
export async function flushQueue(childId: string): Promise<number> {
  let sent = 0;
  for (;;) {
    const q = read();
    const i = q.findIndex((x) => x.childId === childId);
    if (i < 0) return sent;
    try { await post(q[i]!.path, q[i]!.body); sent++; }
    catch (e) { if (isNetworkError(e)) return sent; }
    const rest = read(); rest.splice(rest.findIndex((x) => x === q[i] || JSON.stringify(x) === JSON.stringify(q[i])), 1); write(rest);
  }
}
