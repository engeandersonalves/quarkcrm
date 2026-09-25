"use client";

import { useState } from "react";
import { imageUrl } from "@/lib/inspiration";
import { cx } from "../ui";

/** Fundo cinematográfico: foto com zoom lento, escurecida, com granulado — ou arte própria se a foto falhar. */
export function CinematicBackdrop({ src, className, dim = "strong" }: { src?: string; className?: string; dim?: "strong" | "medium" }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cx("absolute inset-0 overflow-hidden bg-[#0E0920]", className)}>
      <SkylineArt />
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={imageUrl(src)}
          alt=""
          onError={() => setFailed(true)}
          className="animate-ken-burns absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
          onLoad={(e) => e.currentTarget.classList.replace("opacity-0", "opacity-100")}
        />
      )}
      <div
        className={cx(
          "absolute inset-0",
          dim === "strong"
            ? "bg-[radial-gradient(ellipse_at_center,rgba(7,8,12,0.35)_0%,rgba(7,8,12,0.85)_70%,#0E0920_100%)]"
            : "bg-gradient-to-r from-[#0E0920]/95 via-[#0E0920]/70 to-[#0E0920]/20",
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0E0920] via-transparent to-[#0E0920]/40" />
    </div>
  );
}


/** Skyline noturno em preto e ouro — usado como base e reserva das fotos. */
export function SkylineArt() {
  const buildings = [
    [0, 62, 40], [36, 48, 30], [62, 70, 26], [84, 40, 34], [114, 78, 22], [132, 55, 38], [166, 86, 24], [186, 50, 30],
    [212, 66, 28], [236, 92, 20], [252, 58, 36], [284, 74, 26], [306, 44, 40], [342, 82, 22], [360, 60, 30], [386, 70, 26],
  ];
  return (
    <svg viewBox="0 0 412 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E0920" />
          <stop offset="0.6" stopColor="#1C1234" />
          <stop offset="1" stopColor="#2A2046" />
        </linearGradient>
        <radialGradient id="glow" cx="0.72" cy="0.35" r="0.5">
          <stop offset="0" stopColor="#F3EA3B" stopOpacity="0.35" />
          <stop offset="1" stopColor="#F3EA3B" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="412" height="200" fill="url(#nightSky)" />
      <rect width="412" height="200" fill="url(#glow)" />
      <circle cx="298" cy="62" r="16" fill="#F3EA3B" opacity="0.85" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 97) % 412} cy={(i * 53) % 90} r={i % 3 ? 0.4 : 0.7} fill="#F6F1A0" opacity={0.3 + (i % 4) * 0.15} />
      ))}
      {buildings.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={200 - h} width={w} height={h} fill={i % 2 ? "#120C24" : "#160F2C"} />
          {Array.from({ length: Math.floor(h / 9) }, (_, r) =>
            Array.from({ length: Math.floor(w / 7) }, (_, c) =>
              (r * 7 + c * 3 + i) % 4 === 0 ? <rect key={`${r}-${c}`} x={x + 3 + c * 7} y={200 - h + 5 + r * 9} width="3" height="4" fill="#9BD373" opacity="0.7" /> : null,
            ),
          )}
        </g>
      ))}
    </svg>
  );
}
