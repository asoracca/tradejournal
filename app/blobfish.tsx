export function Blobfish({ level, width = 140, caption, pct }: { level: number; width?: number; caption?: string; pct?: number }) {
  const r = Math.max(0, Math.min(level, 4));
  const fat = 1 + r * 0.11;
  const fill = r < 1 ? "#f9a8d4" : r < 2 ? "#f472b6" : r < 3 ? "#fb7185" : "#ef4444";
  const dark = r < 1 ? "#db2777" : r < 2 ? "#be185d" : r < 3 ? "#e11d48" : "#991b1b";
  const smile = 12 - r * 10;
  const my = 120;
  const mouth = "M 84 " + my + " Q 111 " + (my - smile).toFixed(1) + " 138 " + my;
  const base = caption ?? (r === 0 ? "Plan a trade" : r < 1 ? "Low risk" : r < 2 ? "Moderate" : r < 3 ? "High risk" : "Extreme risk");
  const label = base + (pct && pct > 0 ? " · " + pct.toFixed(1) + "%" : "");
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 222 175" width={width} className="blob-float">
        <ellipse cx="58" cy="124" rx="24" ry="12" fill={fill} transform="rotate(-22 58 124)" />
        <ellipse cx="164" cy="124" rx="24" ry="12" fill={fill} transform="rotate(22 164 124)" />
        <g transform={"translate(111,100) scale(" + fat.toFixed(3) + ",1) translate(-111,-100)"}>
          <path d="M111 34 C 58 34, 34 96, 45 128 C 56 152, 166 152, 177 128 C 188 96, 164 34, 111 34 Z" fill={fill} />
          <ellipse cx="86" cy="68" rx="13" ry="9" fill="#ffffff" opacity="0.55" />
          <circle cx="93" cy="96" r="5" fill="#3b1d2a" />
          <circle cx="129" cy="96" r="5" fill="#3b1d2a" />
          <path d={mouth} stroke={dark} strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      <span className="mt-2 font-semibold" style={{ color: fill }}>{label}</span>
    </div>
  );
}
