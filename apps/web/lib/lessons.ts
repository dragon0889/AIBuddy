export type I18n = { vi: string; en?: string };
export type LessonStep =
  | { id: string; type: "story"; mascot?: string; text: I18n }
  | { id: string; type: "choice"; prompt: I18n; options: { text: I18n; correct: boolean; feedback?: I18n }[] }
  | { id: string; type: "drag_drop"; prompt: I18n; items: { label: I18n; target: string }[]; targets: { id: string; label: I18n }[] }
  | { id: string; type: "short_text"; prompt: I18n; acceptable?: string[] }
  | { id: string; type: "spot_ai_mistake"; aiAnswer: I18n; facts: I18n[]; wrongParts: string[]; feedback: I18n }
  | { id: string; type: "discussion"; prompt: I18n; parentTips: I18n }
  | { id: string; type: "unplugged"; instructions: I18n; materials: I18n[] }
  | { id: string; type: "ml_task"; project: string; labels: I18n[] }
  | { id: string; type: "block_task"; goal: I18n };
export type Lesson = { id: string; level: 1 | 2 | 3; pillar: string; title: I18n; minutes: number; outcomes: string[]; steps: LessonStep[]; requiresCamera: boolean };
export type LessonListItem = { id: string; level: number; pillar: string; title: string; minutes: number; outcomes: string[]; requiresCamera: boolean; locked: boolean; status: "new" | "in_progress" | "completed"; stepIndex: number };

export const pillarName: Record<string, string> = {
  perception: "Máy cảm nhận", representation: "Máy suy luận", learning: "Máy học", interaction: "Trò chuyện với máy", societal: "AI và xã hội", responsible_ai: "Dùng AI có trách nhiệm",
};
export const pillarEmoji: Record<string, string> = { perception: "👀", representation: "🌳", learning: "🧠", interaction: "💬", societal: "🌍", responsible_ai: "🛡️" };

/** Chia câu trả lời AI thành các cụm có thể bấm; mỗi cụm là một câu. */
export function chunkAnswer(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}
/** Cụm đã chọn → danh sách "wrongParts" gửi lên máy chủ (cụm chứa phần sai nào thì gửi phần sai đó; cụm không chứa gì → gửi chính cụm). */
export function markedToParts(marked: string[], wrongParts: string[]): string[] {
  const out = new Set<string>();
  for (const chunk of marked) {
    const hits = wrongParts.filter((w) => chunk.includes(w));
    if (hits.length) hits.forEach((h) => out.add(h)); else out.add(chunk);
  }
  return [...out];
}
