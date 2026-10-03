/**
 * Design tokens theo cấp độ (docs/DESIGN.md §6).
 * Cỡ chữ: SRS 5.1 yêu cầu ≥16pt (tiểu học) và ≥14pt (THCS); 1pt = 4/3 px.
 * Vùng chạm ≥44px (đề xuất ở SRS_ADDENDUM/ADD-10), L1 dùng 56px.
 */
export type LevelKey = "l1" | "l2" | "l3";

export const pt = (n: number) => Math.round((n * 4) / 3 * 100) / 100;

export const levelTokens: Record<LevelKey, { fontPt: number; minTargetPx: number; radiusPx: number; mascot: "large" | "small" | "none" }> = {
  l1: { fontPt: 20, minTargetPx: 56, radiusPx: 20, mascot: "large" },
  l2: { fontPt: 16, minTargetPx: 48, radiusPx: 14, mascot: "small" },
  l3: { fontPt: 14, minTargetPx: 44, radiusPx: 10, mascot: "none" },
};

/** Màu: [nền, chữ] cần tương phản ≥ 4.5:1 (WCAG 2.1 AA, văn bản thường). */
export const palette = {
  bg: "#fffaf0",
  text: "#1f2937",
  primary: "#2563eb",
  onPrimary: "#ffffff",
  success: "#15803d",
  onSuccess: "#ffffff",
  warning: "#b45309",
  onWarning: "#ffffff",
  danger: "#b91c1c",
  onDanger: "#ffffff",
} as const;

export const contrastPairs: Array<[string, string]> = [
  [palette.bg, palette.text],
  [palette.primary, palette.onPrimary],
  [palette.success, palette.onSuccess],
  [palette.warning, palette.onWarning],
  [palette.danger, palette.onDanger],
];

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
