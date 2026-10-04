/** Biểu đồ đường SVG đơn giản (trợ năng: có aria-label và bảng giá trị cuối). */
export function LineChart({ title, values, max, color }: { title: string; values: number[]; max?: number; color: string }) {
  const W = 260, H = 100;
  const m = max ?? Math.max(1e-6, ...values);
  const pts = values.map((v, i) => `${values.length === 1 ? W / 2 : (i * W) / (values.length - 1)},${H - (Math.min(v, m) / m) * (H - 6) - 3}`).join(" ");
  const last = values.at(-1);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title}: ${last !== undefined ? last.toFixed(2) : "chưa có"}`} style={{ background: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 8 }}>
        <polyline fill="none" stroke={color} strokeWidth="3" points={pts} />
      </svg>
      <figcaption>{title}{last !== undefined ? `: ${last.toFixed(2)}` : ""}</figcaption>
    </figure>
  );
}
