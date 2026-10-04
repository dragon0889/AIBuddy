/** Bud – bạn robot (SVG tự vẽ, không dùng tài nguyên bên ngoài). */
export function Mascot({ mood = "happy" }: { mood?: "happy" | "think" | "oops" }) {
  const mouth = mood === "oops" ? "M26 50 Q36 44 46 50" : mood === "think" ? "M28 48 L44 48" : "M26 46 Q36 56 46 46";
  return (
    <svg className="mascot" viewBox="0 0 72 72" role="img" aria-label="Bud, bạn robot">
      <line x1="36" y1="6" x2="36" y2="14" stroke="#374151" strokeWidth="3" /><circle cx="36" cy="6" r="4" fill="#f59e0b" />
      <rect x="10" y="14" width="52" height="46" rx="14" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="3" />
      <circle cx="26" cy="32" r="6" fill="#fff" /><circle cx="46" cy="32" r="6" fill="#fff" />
      <circle cx="27" cy="33" r="3" fill="#111827" /><circle cx="47" cy="33" r="3" fill="#111827" />
      <path d={mouth} fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
