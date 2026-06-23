"use client";

import { useId } from "react";

export function Blobfish({ level, width = 140, caption, pct }: { level: number; width?: number; caption?: string; pct?: number }) {
  const r = Math.max(0, Math.min(level, 4));
  const fat = 1 + r * 0.11;
  const [c1, c2] = r < 1 ? ["#fbcfe8", "#f9a8d4"] : r < 2 ? ["#f9a8d4", "#f472b6"] : r < 3 ? ["#fb7185", "#fb923c"] : ["#ef4444", "#f97316"];
  const dark = r < 1 ? "#db2777" : r < 2 ? "#be185d" : r < 3 ? "#e11d48" : "#991b1b";
  const smile = 12 - r * 10;
  const my = 120;
  const mouth = "M 84 " + my + " Q 111 " + (my - smile).toFixed(1) + " 138 " + my;
  const base = caption ?? (r === 0 ? "Plan a trade" : r < 1 ? "Low risk" : r < 2 ? "Moderate" : r < 3 ? "High risk" : "Extreme risk");
  const label = base + (pct && pct > 0 ? " · " + pct.toFixed(1) + "%" : "");
  const uid = useId().replace(/:/g, "");
  const goo = "goo" + uid, grad = "grad" + uid;
  const P1 = "M111 34 C 58 34, 34 96, 45 128 C 56 152, 166 152, 177 128 C 188 96, 164 34, 111 34 Z";
  const P2 = "M111 24 C 42 42, 20 106, 50 138 C 64 162, 158 162, 172 132 C 204 100, 180 24, 111 24 Z";
  const P3 = "M111 42 C 68 24, 32 86, 40 122 C 50 152, 172 152, 184 124 C 190 86, 154 42, 111 42 Z";
  const P4 = "M111 30 C 52 30, 26 100, 44 134 C 58 158, 164 158, 178 130 C 196 98, 170 30, 111 30 Z";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 222 175" width={width} style={{ maxWidth: "92vw", height: "auto" }} className="blob-float">
        <defs>
          <filter id={goo}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -14" result="g" />
            <feBlend in="SourceGraphic" in2="g" />
          </filter>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1}><animate attributeName="stop-color" values={c1 + ";" + c2 + ";" + c1} dur="4s" repeatCount="indefinite" /></stop>
            <stop offset="1" stopColor={c2}><animate attributeName="stop-color" values={c2 + ";" + c1 + ";" + c2} dur="4s" repeatCount="indefinite" /></stop>
          </linearGradient>
        </defs>
        <g filter={"url(#" + goo + ")"}>
          <ellipse cx="56" cy="124" rx="26" ry="13" fill={"url(#" + grad + ")"} transform="rotate(-22 56 124)">
            <animate attributeName="cx" values="56;50;56" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="166" cy="124" rx="26" ry="13" fill={"url(#" + grad + ")"} transform="rotate(22 166 124)">
            <animate attributeName="cx" values="166;172;166" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <g transform={"translate(111,100) scale(" + fat.toFixed(3) + ",1) translate(-111,-100)"}>
            <path fill={"url(#" + grad + ")"} d={P1}>
              <animate attributeName="d" values={P1 + ";" + P2 + ";" + P3 + ";" + P4 + ";" + P1} dur="5s" repeatCount="indefinite" />
            </path>
          </g>
        </g>
        <g transform={"translate(111,100) scale(" + fat.toFixed(3) + ",1) translate(-111,-100)"}>
          <ellipse cx="86" cy="68" rx="13" ry="9" fill="#ffffff" opacity="0.5" />
          <circle cx="93" cy="96" r="5" fill="#3b1d2a" />
          <circle cx="129" cy="96" r="5" fill="#3b1d2a" />
          <path d={mouth} stroke={dark} strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      <span className="mt-2 font-semibold text-center" style={{ color: c2 }}>{label}</span>
    </div>
  );
}
