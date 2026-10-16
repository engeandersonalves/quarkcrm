"use client";

import { useId, type ReactNode } from "react";

/**
 * Ícones 3D em SVG: volume com degradê, face de extrusão mais escura, brilho especular
 * e sombra projetada. Leves (sem imagens) e nítidos em qualquer tamanho.
 */
type P = { size?: number; className?: string };

function Svg({ size = 48, className, children, label }: P & { children: (id: (k: string) => string) => ReactNode; label: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (k: string) => `${uid}-${k}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={label}>
      <defs>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={id("soft")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      {children(id)}
    </svg>
  );
}

const Shadow = ({ id, cx = 32, cy = 58, rx = 18, o = 0.28 }: { id: (k: string) => string; cx?: number; cy?: number; rx?: number; o?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={3.2} fill="#0B0618" opacity={o} filter={`url(#${id("blur")})`} />
);

export function Sun3D(p: P) {
  return (
    <Svg {...p} label="Sol">
      {(id) => (
        <>
          <defs>
            <radialGradient id={id("core")} cx="38%" cy="32%" r="70%">
              <stop offset="0" stopColor="#FFF9C4" />
              <stop offset="0.45" stopColor="#FFD43B" />
              <stop offset="1" stopColor="#FF8A00" />
            </radialGradient>
            <linearGradient id={id("ray")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFE066" />
              <stop offset="1" stopColor="#FF9F1C" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={16} />
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 45} 32 30)`}>
              <rect x="29" y="3.5" width="6" height="11" rx="3" fill="#E07800" transform="translate(0.8 1.4)" />
              <rect x="29" y="3.5" width="6" height="11" rx="3" fill={`url(#${id("ray")})`} />
            </g>
          ))}
          <circle cx="32.8" cy="31.6" r="14" fill="#D96D00" />
          <circle cx="32" cy="30" r="14" fill={`url(#${id("core")})`} />
          <ellipse cx="27" cy="24.5" rx="6" ry="3.6" fill="#fff" opacity="0.75" filter={`url(#${id("soft")})`} transform="rotate(-25 27 24.5)" />
        </>
      )}
    </Svg>
  );
}

export function Bolt3D(p: P) {
  const d = "M37 4 L13 35 H29 L24 60 L51 25 H35 L41 4 Z";
  return (
    <Svg {...p} label="Energia">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("g")} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#E9FF8F" />
              <stop offset="0.5" stopColor="#9BD373" />
              <stop offset="1" stopColor="#3E9E5A" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={15} />
          <path d={d} fill="#2B6B3E" transform="translate(2.2 2.6)" />
          <path d={d} fill={`url(#${id("g")})`} />
          <path d="M37 4 L13 35 H20" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.65" />
          <path d="M36 9 L19 31" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.35" filter={`url(#${id("soft")})`} />
        </>
      )}
    </Svg>
  );
}

export function Panel3D(p: P) {
  const A = [7, 37], B = [33, 23], C = [58, 35], D = [32, 49];
  const lerp = (u: number[], v: number[], t: number) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const pts = (...xs: number[][]) => xs.map((x) => x.join(",")).join(" ");
  return (
    <Svg {...p} label="Placa solar">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("cell")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5B8DEF" />
              <stop offset="0.55" stopColor="#2346A8" />
              <stop offset="1" stopColor="#14245E" />
            </linearGradient>
            <linearGradient id={id("frame")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E7E9F0" />
              <stop offset="1" stopColor="#8D93A6" />
            </linearGradient>
          </defs>
          <Shadow id={id} cy={58} rx={20} />
          <path d="M31 50 L31 57 M27 57 H36" stroke="#8D93A6" strokeWidth="2.6" strokeLinecap="round" />
          <polygon points={pts(A, D, [D[0], D[1] + 4], [A[0], A[1] + 4])} fill="#7A8094" />
          <polygon points={pts(D, C, [C[0], C[1] + 4], [D[0], D[1] + 4])} fill="#5E6478" />
          <polygon points={pts(A, B, C, D)} fill={`url(#${id("frame")})`} />
          <polygon points={pts(lerp(A, C, 0.04), lerp(B, D, 0.06), lerp(C, A, 0.04), lerp(D, B, 0.06))} fill={`url(#${id("cell")})`} />
          {[1 / 3, 2 / 3].map((t) => (
            <line key={`a${t}`} x1={lerp(A, D, t)[0]} y1={lerp(A, D, t)[1]} x2={lerp(B, C, t)[0]} y2={lerp(B, C, t)[1]} stroke="#9DB6F2" strokeWidth="0.8" opacity="0.75" />
          ))}
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={`b${t}`} x1={lerp(A, B, t)[0]} y1={lerp(A, B, t)[1]} x2={lerp(D, C, t)[0]} y2={lerp(D, C, t)[1]} stroke="#9DB6F2" strokeWidth="0.8" opacity="0.75" />
          ))}
          <polygon points={pts(lerp(A, B, 0.15), lerp(A, B, 0.42), lerp(D, C, 0.18), lerp(D, C, 0.0))} fill="#fff" opacity="0.22" />
        </>
      )}
    </Svg>
  );
}

export function Leaf3D(p: P) {
  const d = "M52 7 C 26 6 10 22 12 47 C 13 53 18 56 23 54 C 45 50 56 32 52 7 Z";
  return (
    <Svg {...p} label="Folha">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("g")} x1="0.9" y1="0" x2="0.1" y2="1">
              <stop offset="0" stopColor="#D8FF8A" />
              <stop offset="0.5" stopColor="#6CC690" />
              <stop offset="1" stopColor="#23824F" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={16} />
          <path d={d} fill="#1D6B42" transform="translate(1.8 2.4)" />
          <path d={d} fill={`url(#${id("g")})`} />
          <path d="M17 51 C 26 38 36 26 48 12" stroke="#1F7A48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M27 38 L22 31 M33 31 L30 22 M39 24 L39 16 M31 35 L39 34 M37 28 L45 27" stroke="#1F7A48" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
          <path d="M18 40 C 18 26 28 14 44 11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.4" filter={`url(#${id("soft")})`} />
        </>
      )}
    </Svg>
  );
}

export function Coin3D(p: P) {
  const coin = (cx: number, cy: number, id: (k: string) => string, glyph?: boolean) => (
    <g>
      <path d={`M${cx - 17} ${cy} v6 a17 6.5 0 0 0 34 0 v-6`} fill="#B07800" />
      <ellipse cx={cx} cy={cy} rx={17} ry={6.5} fill={`url(#${id("face")})`} />
      <ellipse cx={cx} cy={cy} rx={12.5} ry={4.6} fill="none" stroke="#C98A00" strokeWidth="1.2" />
      {glyph && (
        <text x={cx} y={cy + 3.2} textAnchor="middle" fontSize="9" fontWeight="800" fill="#9A6400" fontFamily="system-ui, sans-serif">
          R$
        </text>
      )}
    </g>
  );
  return (
    <Svg {...p} label="Economia">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("face")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFF1A8" />
              <stop offset="0.5" stopColor="#FFC93C" />
              <stop offset="1" stopColor="#E09B00" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={19} />
          {coin(29, 45, id)}
          {coin(33, 37, id)}
          {coin(30, 28, id)}
          {coin(34, 19, id, true)}
          <ellipse cx="28" cy="17" rx="7" ry="2" fill="#fff" opacity="0.65" filter={`url(#${id("soft")})`} />
        </>
      )}
    </Svg>
  );
}

export function Inverter3D(p: P) {
  return (
    <Svg {...p} label="Inversor">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("front")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D5D8E3" />
            </linearGradient>
            <linearGradient id={id("side")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#A9AEC0" />
              <stop offset="1" stopColor="#7E8499" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={20} />
          <polygon points="12,17 22,10 54,10 44,17" fill="#F2F3F8" />
          <polygon points="44,17 54,10 54,46 44,53" fill={`url(#${id("side")})`} />
          <rect x="12" y="17" width="32" height="36" rx="3" fill={`url(#${id("front")})`} />
          <rect x="17" y="22" width="22" height="11" rx="2" fill="#1C1234" />
          <path d="M19.5 30 l4 -4 l3 2.5 l5 -5 l3.5 2" stroke="#9BD373" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="40" r="2" fill="#3FBF6A" />
          <circle cx="26" cy="40" r="2" fill="#F5B700" opacity="0.8" />
          <rect x="17" y="45" width="22" height="2.4" rx="1.2" fill="#C2C6D3" />
          <rect x="14" y="19" width="4" height="30" rx="2" fill="#fff" opacity="0.6" />
        </>
      )}
    </Svg>
  );
}

export function Calendar3D(p: P) {
  return (
    <Svg {...p} label="Calendário">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("top")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8E6CF7" />
              <stop offset="1" stopColor="#5B34D6" />
            </linearGradient>
            <linearGradient id={id("page")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#E3E1EC" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={20} />
          <rect x="11.5" y="15" width="43" height="41" rx="8" fill="#B9B5CB" />
          <rect x="10" y="13" width="43" height="41" rx="8" fill={`url(#${id("page")})`} />
          <path d="M10 21 a8 8 0 0 1 8 -8 h27 a8 8 0 0 1 8 8 v4 H10 Z" fill={`url(#${id("top")})`} />
          <rect x="20" y="8" width="4.5" height="10" rx="2.2" fill="#3A2A6E" />
          <rect x="38.5" y="8" width="4.5" height="10" rx="2.2" fill="#3A2A6E" />
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={16 + c * 8} y={30 + r * 7} width="5" height="4" rx="1.2" fill={r === 1 && c === 2 ? "#9BD373" : "#CFCBDD"} />))}
          <rect x="12" y="15" width="16" height="3" rx="1.5" fill="#fff" opacity="0.4" />
        </>
      )}
    </Svg>
  );
}

export function Alert3D(p: P) {
  const d = "M32 8 C 34 8 35.5 9 36.6 11 L 56 46 C 58 50 56 54 51 54 H 13 C 8 54 6 50 8 46 L 27.4 11 C 28.5 9 30 8 32 8 Z";
  return (
    <Svg {...p} label="Atenção">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("g")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFE07A" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={20} />
          <path d={d} fill="#B86E00" transform="translate(1.5 2.5)" />
          <path d={d} fill={`url(#${id("g")})`} />
          <rect x="29" y="22" width="6" height="18" rx="3" fill="#5A3500" />
          <circle cx="32" cy="46" r="3.4" fill="#5A3500" />
          <path d="M30 13 L14 42" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.45" filter={`url(#${id("soft")})`} />
        </>
      )}
    </Svg>
  );
}

export function Gauge3D(p: P) {
  return (
    <Svg {...p} label="Desempenho">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("arc")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#F43F5E" />
              <stop offset="0.5" stopColor="#F5B700" />
              <stop offset="1" stopColor="#3FBF6A" />
            </linearGradient>
            <radialGradient id={id("dial")} cx="40%" cy="30%" r="80%">
              <stop offset="0" stopColor="#3A2D63" />
              <stop offset="1" stopColor="#140D29" />
            </radialGradient>
          </defs>
          <Shadow id={id} rx={20} />
          <circle cx="33" cy="35.5" r="23" fill="#0A0616" />
          <circle cx="32" cy="34" r="23" fill={`url(#${id("dial")})`} />
          <path d="M15 40 A 18 18 0 1 1 49 40" stroke={`url(#${id("arc")})`} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M32 34 L44 22" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="34" r="4" fill="#fff" />
          <ellipse cx="25" cy="20" rx="8" ry="3" fill="#fff" opacity="0.18" transform="rotate(-25 25 20)" />
        </>
      )}
    </Svg>
  );
}

export function House3D(p: P) {
  return (
    <Svg {...p} label="Usina">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("roof")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5B8DEF" />
              <stop offset="1" stopColor="#1B2F7A" />
            </linearGradient>
            <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#DCDDE7" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={22} />
          <polygon points="11,31 24,20 37,31 37,54 11,54" fill={`url(#${id("wall")})`} />
          <polygon points="37,31 56,25 56,48 37,54" fill="#B4B8C8" />
          <polygon points="24,19 43,13 59,24 38,31.5" fill="#6B3423" />
          <polygon points="27.5,19.8 43,15 55.5,23.6 39.5,28.8" fill={`url(#${id("roof")})`} />
          <path d="M33 17.4 L47.5 25.9 M38.5 15.8 L51.5 24.6 M30 22.3 L49 16.6" stroke="#9DB6F2" strokeWidth="0.7" opacity="0.8" />
          <polyline points="9,32.5 24,18.5 39,31.8" fill="none" stroke="#8A4630" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="20" y="42" width="7" height="12" rx="1" fill="#5B34D6" />
          <polygon points="42,37 51,34 51,40 42,43" fill="#9DB6F2" />
          <path d="M29 20.5 L42 16.4" stroke="#fff" strokeWidth="1" opacity="0.7" />
        </>
      )}
    </Svg>
  );
}

export function Plug3D(p: P) {
  return (
    <Svg {...p} label="Rede elétrica">
      {(id) => (
        <>
          <defs>
            <linearGradient id={id("g")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9EE6FF" />
              <stop offset="1" stopColor="#1E88E5" />
            </linearGradient>
          </defs>
          <Shadow id={id} rx={14} />
          <rect x="23" y="6" width="5" height="14" rx="2.5" fill="#9AA0B4" />
          <rect x="36" y="6" width="5" height="14" rx="2.5" fill="#9AA0B4" />
          <path d="M15 20 h34 v8 a17 17 0 0 1 -34 0 Z" fill="#115FA8" transform="translate(1.5 2)" />
          <path d="M15 20 h34 v8 a17 17 0 0 1 -34 0 Z" fill={`url(#${id("g")})`} />
          <rect x="28" y="44" width="8" height="12" rx="3" fill="#115FA8" />
          <path d="M34 24 l-5 8 h5 l-3 7" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="18" y="22" width="5" height="10" rx="2.5" fill="#fff" opacity="0.4" />
        </>
      )}
    </Svg>
  );
}

/** Ícone 3D sobre uma base de vidro (para cartões de indicadores). */
export function IconTile({ children, tone = "#9BD373", className = "" }: { children: ReactNode; tone?: string; className?: string }) {
  return (
    <span
      className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-1 ring-white/10 ${className}`}
      style={{ background: `radial-gradient(120% 120% at 30% 20%, ${tone}33, transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))` }}
    >
      {children}
    </span>
  );
}
