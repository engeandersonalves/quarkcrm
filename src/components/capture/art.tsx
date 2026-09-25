/* Ilustrações realistas de cada tipo de cobertura (vetoriais: carregam na hora e nunca mostram o telhado errado). */

import type { RoofKey } from "@/lib/defaults";

function Sky({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9FD3FF" />
          <stop offset="1" stopColor="#E8F5FF" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.85" cy="0.05" r="0.5">
          <stop offset="0" stopColor="#FFF6C8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFF6C8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}-sky)`} />
      <rect width="400" height="300" fill={`url(#${id}-sun)`} />
    </>
  );
}

function Ceramic() {
  const rows = 9;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    const y = 70 + r * 26;
    const w = 34 + r * 3.2; // perspectiva: telhas maiores embaixo
    const offset = (r % 2) * (w / 2);
    for (let x = -60 + offset; x < 460; x += w) {
      tiles.push(
        <g key={`${r}-${x}`}>
          <path d={`M${x} ${y + 26} q ${w / 2} -22 ${w} 0 v 6 q ${-w / 2} -20 ${-w} 0 z`} fill="url(#cer-shadow)" opacity="0.55" />
          <path d={`M${x} ${y + 24} q ${w / 2} -30 ${w} 0 l -2 -22 q ${-w / 2 + 2} -26 ${-w + 4} 0 z`} fill="url(#cer-tile)" />
          <path d={`M${x + w * 0.3} ${y + 6} q ${w * 0.2} -8 ${w * 0.4} 0`} stroke="#FFD2B8" strokeOpacity="0.55" strokeWidth="2" fill="none" />
        </g>,
      );
    }
  }
  return (
    <>
      <defs>
        <linearGradient id="cer-tile" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9E3C1E" />
          <stop offset="0.45" stopColor="#D8693F" />
          <stop offset="0.7" stopColor="#E98A5E" />
          <stop offset="1" stopColor="#A9441F" />
        </linearGradient>
        <linearGradient id="cer-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A1206" />
          <stop offset="1" stopColor="#3A1206" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect y="60" width="400" height="240" fill="#7A2E14" />
      {tiles}
      <rect y="52" width="400" height="14" fill="#8C3517" />
      <rect y="52" width="400" height="4" fill="#C4592F" />
    </>
  );
}

function Fiber() {
  const waves = [];
  for (let x = -20; x < 420; x += 22) {
    waves.push(<rect key={x} x={x} y="60" width="22" height="240" fill="url(#fib-wave)" />);
  }
  return (
    <>
      <defs>
        <linearGradient id="fib-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7E868E" />
          <stop offset="0.3" stopColor="#C9CFD4" />
          <stop offset="0.5" stopColor="#E3E7EA" />
          <stop offset="0.75" stopColor="#A7AEB5" />
          <stop offset="1" stopColor="#7E868E" />
        </linearGradient>
        <linearGradient id="fib-age" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6B7075" stopOpacity="0" />
          <stop offset="1" stopColor="#4A5055" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <g transform="skewX(-8) translate(20 0)">{waves}</g>
      <rect y="60" width="400" height="240" fill="url(#fib-age)" />
      {[150, 235].map((y) => (
        <line key={y} x1="0" y1={y} x2="400" y2={y + 4} stroke="#5E656B" strokeOpacity="0.35" strokeWidth="2" />
      ))}
      {[120, 330, 90, 260].map((x, i) => (
        <circle key={i} cx={x} cy={110 + i * 45} r="3" fill="#5A6066" />
      ))}
    </>
  );
}

function Metal() {
  const ribs = [];
  for (let x = -40; x < 440; x += 48) {
    ribs.push(
      <g key={x}>
        <rect x={x} y="60" width="48" height="240" fill="url(#met-flat)" />
        <polygon points={`${x + 30},60 ${x + 36},60 ${x + 40},300 ${x + 30},300`} fill="url(#met-rib)" />
        <polygon points={`${x + 36},60 ${x + 42},60 ${x + 48},300 ${x + 40},300`} fill="#8C959E" />
      </g>,
    );
  }
  return (
    <>
      <defs>
        <linearGradient id="met-flat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E7ECF1" />
          <stop offset="1" stopColor="#B9C2CB" />
        </linearGradient>
        <linearGradient id="met-rib" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#CFD6DD" />
        </linearGradient>
        <linearGradient id="met-glare" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="skewX(-10) translate(26 0)">{ribs}</g>
      <rect y="60" width="400" height="240" fill="url(#met-glare)" />
      {[140, 230].map((y) => (
        <g key={y}>
          {[40, 130, 220, 310, 400].map((x) => (
            <circle key={x} cx={x - (y - 60) * 0.18} cy={y} r="2.5" fill="#6E7780" />
          ))}
        </g>
      ))}
    </>
  );
}

function Panel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cells = [];
  for (let c = 1; c < 6; c++) cells.push(<line key={`c${c}`} x1={x + (w * c) / 6} y1={y} x2={x + (w * c) / 6} y2={y + h} stroke="#3F5B86" strokeWidth="0.8" />);
  for (let r = 1; r < 3; r++) cells.push(<line key={`r${r}`} x1={x} y1={y + (h * r) / 3} x2={x + w} y2={y + (h * r) / 3} stroke="#3F5B86" strokeWidth="0.8" />);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="url(#pv)" stroke="#D9DEE5" strokeWidth="2" />
      {cells}
      <polygon points={`${x},${y} ${x + w * 0.45},${y} ${x},${y + h * 0.8}`} fill="#FFFFFF" opacity="0.18" />
    </g>
  );
}

function PvDefs() {
  return (
    <defs>
      <linearGradient id="pv" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#23385C" />
        <stop offset="1" stopColor="#0E1A2E" />
      </linearGradient>
    </defs>
  );
}

function Slab() {
  return (
    <>
      <PvDefs />
      <defs>
        <linearGradient id="slab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D5D3CE" />
          <stop offset="1" stopColor="#B9B6AF" />
        </linearGradient>
      </defs>
      {/* laje plana em perspectiva */}
      <polygon points="0,130 400,130 400,300 0,300" fill="url(#slab)" />
      {[160, 200, 250].map((y) => (
        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#A8A49C" strokeOpacity="0.5" />
      ))}
      {/* platibanda */}
      <rect y="118" width="400" height="14" fill="#E6E3DC" />
      <rect y="130" width="400" height="3" fill="#A29E95" />
      {/* módulos inclinados em estruturas */}
      {[
        [30, 150, 1],
        [215, 150, 1],
        [10, 215, 1.25],
        [220, 215, 1.25],
      ].map(([x, y, s], i) => (
        <g key={i}>
          <polygon points={`${x + 6},${y + 34 * s} ${x + 170 * s},${y + 34 * s} ${x + 176 * s},${y + 52 * s} ${x},${y + 52 * s}`} fill="#8E8A82" opacity="0.5" />
          <line x1={x + 20} y1={y + 30 * s} x2={x + 20} y2={y + 44 * s} stroke="#9CA3AB" strokeWidth="3" />
          <line x1={x + 160 * s} y1={y + 30 * s} x2={x + 160 * s} y2={y + 44 * s} stroke="#9CA3AB" strokeWidth="3" />
          <Panel x={x} y={y} w={176 * s} h={34 * s} />
        </g>
      ))}
    </>
  );
}

function Ground() {
  return (
    <>
      <PvDefs />
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9CCB6B" />
          <stop offset="1" stopColor="#4F8F3A" />
        </linearGradient>
      </defs>
      <path d="M0 140 Q 120 118 240 132 T 400 126 V 300 H 0 Z" fill="url(#grass)" />
      <path d="M0 150 Q 160 132 400 140" stroke="#B8DD8A" strokeOpacity="0.6" strokeWidth="2" fill="none" />
      {[
        [150, 0.55],
        [185, 0.75],
        [228, 1],
      ].map(([y, s]) =>
        Array.from({ length: Math.round(4 / s) + 1 }, (_, i) => {
          const w = 92 * s;
          const x = -10 + i * (w + 6);
          return (
            <g key={`${y}-${i}`}>
              <line x1={x + w * 0.2} y1={y + 26 * s} x2={x + w * 0.2} y2={y + 46 * s} stroke="#8A939C" strokeWidth={2.5 * s} />
              <line x1={x + w * 0.8} y1={y + 26 * s} x2={x + w * 0.8} y2={y + 46 * s} stroke="#8A939C" strokeWidth={2.5 * s} />
              <Panel x={x} y={y} w={w} h={30 * s} />
            </g>
          );
        }),
      )}
    </>
  );
}

export function RoofScene({ kind, className }: { kind: RoofKey; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <Sky id={kind} />
      {kind === "ceramic" && <Ceramic />}
      {kind === "fiber" && <Fiber />}
      {kind === "metal" && <Metal />}
      {kind === "slab" && <Slab />}
      {kind === "ground" && <Ground />}
    </svg>
  );
}
