import { useId } from "react";
import type { Mount, Place } from "@/lib/store";

/** Ilustrações vetoriais da loja (leves, nítidas e no tema preto). */

function useIds() {
  const id = useId().replace(/:/g, "");
  return (k: string) => `${k}${id}`;
}

/** Grade de placas solares em perspectiva sobre um quadrilátero. */
function Panels({ p, cols, rows, id }: { p: [number, number][]; cols: number; rows: number; id: string }) {
  const [a, b, c, d] = p; // topo-esq, topo-dir, baixo-dir, baixo-esq
  const lerp = (u: [number, number], v: [number, number], t: number): [number, number] => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const pt = (x: number, y: number) => lerp(lerp(a, b, x), lerp(d, c, x), y);
  const cells = [];
  const g = 0.035;
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++) {
      const x0 = col / cols + g / cols,
        x1 = (col + 1) / cols - g / cols,
        y0 = r / rows + g / rows,
        y1 = (r + 1) / rows - g / rows;
      const q = [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)].map((v) => v.join(",")).join(" ");
      cells.push(<polygon key={`${r}-${col}`} points={q} fill={`url(#${id})`} stroke="#ffffff1a" strokeWidth=".4" />);
    }
  return <g>{cells}</g>;
}

function PanelDefs({ id, shine }: { id: string; shine: string }) {
  return (
    <>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#34343a" />
        <stop offset=".45" stopColor="#16161a" />
        <stop offset="1" stopColor="#09090b" />
      </linearGradient>
      <linearGradient id={shine} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".5" stopColor="#fff" stopOpacity=".22" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

function Sky({ k, glow = "#F3EA3B" }: { k: (s: string) => string; glow?: string }) {
  return (
    <>
      <defs>
        <radialGradient id={k("sun")} cx=".78" cy=".2" r=".55">
          <stop offset="0" stopColor={glow} stopOpacity=".38" />
          <stop offset=".5" stopColor={glow} stopOpacity=".08" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill="#000" />
      <rect width="320" height="200" fill={`url(#${k("sun")})`} />
      <circle cx="250" cy="42" r="15" fill="#FFE45C" />
      <circle cx="250" cy="42" r="24" fill="#FFE45C" opacity=".14" />
    </>
  );
}

export function PlaceArt({ place, className }: { place: Place | "offgrid"; className?: string }) {
  const k = useIds();
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <PanelDefs id={k("pv")} shine={k("sh")} />
        <linearGradient id={k("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#161618" />
        </linearGradient>
        <linearGradient id={k("side")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f1f22" />
          <stop offset="1" stopColor="#0d0d0f" />
        </linearGradient>
        <linearGradient id={k("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2a12" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id={k("win")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9A3" />
          <stop offset="1" stopColor="#F3B53B" />
        </linearGradient>
      </defs>
      <Sky k={k} />
      <ellipse cx="160" cy="196" rx="190" ry="26" fill={`url(#${k("ground")})`} />

      {place === "casa" && (
        <g>
          <polygon points="70,112 160,112 160,178 70,178" fill={`url(#${k("wall")})`} />
          <polygon points="160,112 236,96 236,166 160,178" fill={`url(#${k("side")})`} />
          <polygon points="56,116 112,62 176,62 160,112" fill="#3a2a22" />
          <polygon points="112,62 176,62 250,96 236,100 160,112" fill="#4a3428" />
          <Panels id={k("pv")} cols={4} rows={2} p={[[124, 67], [176, 67], [232, 95], [168, 107]]} />
          <polygon points="124,67 176,67 232,95 168,107" fill={`url(#${k("sh")})`} opacity=".5" />
          <rect x="88" y="132" width="22" height="18" rx="2" fill={`url(#${k("win")})`} />
          <rect x="122" y="140" width="20" height="38" rx="2" fill="#0d0d0f" />
          <polygon points="180,128 214,121 214,140 180,147" fill={`url(#${k("win")})`} opacity=".85" />
        </g>
      )}

      {place === "comercio" && (
        <g>
          <polygon points="52,92 200,92 200,178 52,178" fill={`url(#${k("wall")})`} />
          <polygon points="200,92 262,80 262,168 200,178" fill={`url(#${k("side")})`} />
          <polygon points="52,92 114,80 262,80 200,92" fill="#2f2f33" />
          <Panels id={k("pv")} cols={6} rows={2} p={[[70, 89], [118, 82], [250, 82], [196, 90]]} />
          <rect x="62" y="108" width="128" height="14" rx="3" fill="#9BD373" />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={62 + i * 16} y="108" width="8" height="14" fill="#F3EA3B" opacity=".9" />
          ))}
          <rect x="66" y="128" width="72" height="40" rx="2" fill={`url(#${k("win")})`} opacity=".85" />
          <rect x="146" y="128" width="40" height="50" rx="2" fill="#0d0d0f" />
          <rect x="70" y="97" width="60" height="7" rx="2" fill="#fff" opacity=".85" />
        </g>
      )}

      {(place === "rural" || place === "offgrid") && (
        <g>
          <path d="M0 150 Q 80 120 160 142 T 320 132 V200 H0z" fill="#0f1a0b" />
          <polygon points="196,108 260,108 260,170 196,170" fill="#5a1f1a" />
          <polygon points="186,112 228,78 270,112" fill="#3a1411" />
          <rect x="216" y="134" width="24" height="36" fill="#2a0e0c" />
          <path d="M216 134 L240 170 M240 134 L216 170" stroke="#7a2a22" strokeWidth="2" />
          {[0, 1, 2].map((r) => (
            <g key={r} transform={`translate(${r * 10} ${r * 18})`}>
              <Panels id={k("pv")} cols={5} rows={1} p={[[22, 118], [150, 118], [160, 132], [14, 132]]} />
              <rect x="30" y="132" width="2" height="10" fill="#555" />
              <rect x="140" y="132" width="2" height="10" fill="#555" />
            </g>
          ))}
          {place === "offgrid" && (
            <g>
              <rect x="270" y="138" width="28" height="36" rx="4" fill="#1c1c1e" stroke="#9BD373" strokeWidth="1.5" />
              <rect x="280" y="134" width="8" height="5" rx="1" fill="#9BD373" />
              <rect x="275" y="158" width="18" height="11" rx="2" fill="#30D158" />
              <rect x="275" y="145" width="18" height="10" rx="2" fill="#30D158" opacity=".6" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

/** Tipos de telhado/estrutura (cartões de escolha). */
export function MountArt({ mount, className }: { mount: Mount; className?: string }) {
  const k = useIds();
  const roof: Record<Mount, React.ReactNode> = {
    ceramico: (
      <>
        <polygon points="10,70 60,30 110,70" fill="#8a4a32" />
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M${16 + i * 4} ${65 - i * 5} L${104 - i * 4} ${65 - i * 5}`} stroke="#5e2f1f" strokeWidth="1.4" />
        ))}
      </>
    ),
    fibrocimento: (
      <>
        <polygon points="10,70 60,34 110,70" fill="#9a9aa0" />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${22 + i * 9} 70 L${44 + i * 4.5} 46`} stroke="#6e6e74" strokeWidth="1.6" />
        ))}
      </>
    ),
    metalico: (
      <>
        <polygon points="10,70 60,34 110,70" fill="#7f8b96" />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${22 + i * 9} 70 L${44 + i * 4.5} 46`} stroke="#c8d2dc" strokeWidth="1.1" opacity=".7" />
        ))}
      </>
    ),
    laje: <rect x="10" y="62" width="100" height="10" rx="1" fill="#6e6e74" />,
    solo: <path d="M0 76 Q 60 64 120 76 V90 H0z" fill="#2a4a1a" />,
    carport: (
      <>
        <rect x="22" y="44" width="3" height="34" fill="#aeaeb2" />
        <rect x="96" y="44" width="3" height="34" fill="#aeaeb2" />
        <rect x="38" y="64" width="44" height="12" rx="5" fill="#FF453A" />
        <circle cx="48" cy="77" r="4" fill="#111" />
        <circle cx="72" cy="77" r="4" fill="#111" />
      </>
    ),
  };
  const panel: Record<Mount, [number, number][]> = {
    ceramico: [[34, 52], [86, 52], [96, 62], [24, 62]],
    fibrocimento: [[34, 52], [86, 52], [96, 62], [24, 62]],
    metalico: [[34, 52], [86, 52], [96, 62], [24, 62]],
    laje: [[22, 42], [98, 42], [102, 58], [18, 58]],
    solo: [[18, 48], [102, 48], [108, 64], [12, 64]],
    carport: [[14, 36], [106, 36], [110, 46], [10, 46]],
  };
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden>
      <defs>
        <PanelDefs id={k("pv")} shine={k("sh")} />
      </defs>
      {roof[mount]}
      {mount === "laje" && (
        <>
          <path d="M28 62 L28 52 M92 62 L92 52 M60 62 L60 52" stroke="#aeaeb2" strokeWidth="2" />
        </>
      )}
      {mount === "solo" && <path d="M24 70 L24 60 M96 70 L96 60" stroke="#aeaeb2" strokeWidth="2" />}
      <Panels id={k("pv")} cols={4} rows={1} p={panel[mount]} />
      <polygon points={panel[mount].map((v) => v.join(",")).join(" ")} fill={`url(#${k("sh")})`} opacity=".6" />
    </svg>
  );
}

export function ChargerArt({ kind, className }: { kind: "AC" | "DC"; className?: string }) {
  const k = useIds();
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden>
      <defs>
        <linearGradient id={k("b")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3a3e" />
          <stop offset=".5" stopColor="#1c1c1e" />
          <stop offset="1" stopColor="#0a0a0b" />
        </linearGradient>
        <radialGradient id={k("g")} cx=".5" cy=".4" r=".6">
          <stop offset="0" stopColor="#9BD373" stopOpacity=".35" />
          <stop offset="1" stopColor="#9BD373" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="160" fill={`url(#${k("g")})`} />
      {kind === "AC" ? (
        <g>
          <rect x="50" y="22" width="60" height="86" rx="16" fill={`url(#${k("b")})`} stroke="#ffffff22" />
          <rect x="62" y="36" width="36" height="22" rx="6" fill="#000" />
          <path d="M82 40 l-8 9 h6 l-3 7 9-10 h-6z" fill="#9BD373" />
          <rect x="66" y="70" width="28" height="4" rx="2" fill="#30D158" />
          <circle cx="80" cy="92" r="7" fill="#000" stroke="#ffffff33" />
          <path d="M80 99 C 80 130, 120 120, 120 146" fill="none" stroke="#1c1c1e" strokeWidth="6" strokeLinecap="round" />
          <path d="M80 99 C 80 130, 120 120, 120 146" fill="none" stroke="#3a3a3e" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <rect x="48" y="14" width="64" height="134" rx="14" fill={`url(#${k("b")})`} stroke="#ffffff22" />
          <rect x="58" y="26" width="44" height="34" rx="6" fill="#000" />
          <text x="80" y="48" textAnchor="middle" fontSize="12" fontWeight="700" fill="#9BD373" fontFamily="system-ui">80%</text>
          <rect x="58" y="68" width="44" height="4" rx="2" fill="#F3EA3B" />
          <circle cx="68" cy="96" r="8" fill="#000" stroke="#ffffff33" />
          <circle cx="92" cy="96" r="8" fill="#000" stroke="#ffffff33" />
          <rect x="62" y="128" width="36" height="8" rx="4" fill="#30D158" opacity=".8" />
        </g>
      )}
    </svg>
  );
}

const MOTO_COLORS: Record<string, [string, string]> = {
  "m-urb": ["#9BD373", "#4E8A2E"],
  "m-city": ["#F3EA3B", "#C9A400"],
  "m-sport": ["#FF453A", "#9E1A12"],
  "m-cargo": ["#FF9F0A", "#B36200"],
};

export function MotoArt({ id, className }: { id: string; className?: string }) {
  const k = useIds();
  const [c1, c2] = MOTO_COLORS[id] ?? ["#9BD373", "#4E8A2E"];
  const sport = id === "m-sport";
  const cargo = id === "m-cargo";
  return (
    <svg viewBox="0 0 200 130" className={className} aria-hidden>
      <defs>
        <linearGradient id={k("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <radialGradient id={k("glow")} cx=".5" cy=".7" r=".6">
          <stop offset="0" stopColor={c1} stopOpacity=".25" />
          <stop offset="1" stopColor={c1} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="130" fill={`url(#${k("glow")})`} />
      <ellipse cx="100" cy="118" rx="70" ry="5" fill="#000" opacity=".8" />
      {/* rodas */}
      {[52, 150].map((x) => (
        <g key={x}>
          <circle cx={x} cy="96" r="20" fill="#0a0a0b" stroke="#2c2c2e" strokeWidth="5" />
          <circle cx={x} cy="96" r="8" fill="#3a3a3e" />
          <circle cx={x} cy="96" r="3" fill={c1} />
        </g>
      ))}
      {/* corpo */}
      {sport ? (
        <path d="M44 84 L70 60 L110 56 L132 44 L150 50 L160 72 L128 84 L96 92 Z" fill={`url(#${k("body")})`} />
      ) : (
        <path d="M40 90 Q 44 70 70 70 L104 70 L112 52 L126 48 L150 92 L132 92 Q 120 74 104 86 L74 90 Z" fill={`url(#${k("body")})`} />
      )}
      {/* banco */}
      <path d={sport ? "M78 56 Q 96 46 116 52 L110 58 L80 62 Z" : "M58 66 Q 80 58 100 64 L98 70 L60 72 Z"} fill="#111" />
      {/* guidão e farol */}
      <path d="M128 48 L136 26 M130 26 L146 24" stroke="#d1d1d6" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="146" cy="40" rx="6" ry="4" fill="#FFF6C2" />
      <path d="M150 40 L176 32 L176 48 Z" fill="#FFF6C2" opacity=".18" />
      {/* bateria */}
      <rect x="78" y="76" width="26" height="12" rx="3" fill="#1c1c1e" stroke={c1} strokeWidth="1" />
      <path d="M92 78 l-4 4 h3 l-2 4 5-5 h-3z" fill={c1} />
      {cargo && (
        <g>
          <rect x="28" y="40" width="40" height="30" rx="5" fill="#1c1c1e" stroke="#ffffff22" />
          <rect x="34" y="47" width="28" height="4" rx="2" fill={c1} />
        </g>
      )}
    </svg>
  );
}
