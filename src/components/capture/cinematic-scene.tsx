/* Cena de abertura: alvorada sobre uma fazenda solar (vetorial, sem depender de fotos). */

const W = 1600;
const H = 900;
const HORIZON = 600;
const VX = 1060; // ponto de fuga (embaixo do sol)

/** Fileiras de placas em perspectiva, do horizonte até a frente da cena. */
function panelRows() {
  const rows: React.ReactNode[] = [];
  const count = 11;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    const y = HORIZON + 6 + Math.pow(t, 1.9) * (H - HORIZON + 140);
    const h = 3 + Math.pow(t, 2.1) * 120; // altura da fileira cresce perto da câmera
    const spread = 260 + Math.pow(t, 1.5) * 2600; // largura cresce na perspectiva
    const tables = 6 + Math.round(t * 6);
    const gap = 6 + t * 60;
    const tw = (spread - gap * (tables - 1)) / tables;
    const left = VX - spread / 2;
    const tilt = h * 0.55;
    for (let k = 0; k < tables; k++) {
      const x = left + k * (tw + gap);
      const lean = ((x + tw / 2 - VX) / spread) * h * 0.9; // inclinação lateral em direção ao ponto de fuga
      const d = `M${x + lean} ${y - h} L${x + tw + lean} ${y - h} L${x + tw} ${y} L${x} ${y} Z`;
      rows.push(
        <g key={`${i}-${k}`}>
          <path d={d} fill="url(#cs-panel)" />
          {/* reflexo do sol na borda superior */}
          <path d={`M${x + lean} ${y - h} L${x + tw + lean} ${y - h}`} stroke="url(#cs-glint)" strokeWidth={Math.max(0.6, h * 0.035)} opacity={0.55 + t * 0.4} />
          {h > 26 &&
            Array.from({ length: 3 }, (_, c) => {
              const f = (c + 1) / 4;
              return <path key={c} d={`M${x + lean * (1 - f) + 0} ${y - h + h * f} L${x + tw + lean * (1 - f)} ${y - h + h * f}`} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />;
            })}
          {/* suporte */}
          {h > 18 && <rect x={x + tw * 0.15} y={y} width={Math.max(1, tw * 0.02)} height={tilt * 0.35} fill="#000" opacity="0.6" />}
        </g>,
      );
    }
  }
  return rows;
}

export function SunriseScene({ className, rise = true }: { className?: string; rise?: boolean }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04030a" />
          <stop offset="0.32" stopColor="#120a26" />
          <stop offset="0.5" stopColor="#3a1640" />
          <stop offset="0.6" stopColor="#8a2f3b" />
          <stop offset="0.66" stopColor="#e0712f" />
          <stop offset="0.7" stopColor="#ffc46b" />
        </linearGradient>
        <radialGradient id="cs-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.35" stopColor="#ffe9a3" />
          <stop offset="0.6" stopColor="#ffbb55" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cs-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ff8a3d" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cs-ray" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff1c2" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff1c2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cs-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2550" />
          <stop offset="0.35" stopColor="#141029" />
          <stop offset="1" stopColor="#07060f" />
        </linearGradient>
        <linearGradient id="cs-glint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffb35c" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#ffe3a0" />
          <stop offset="1" stopColor="#ffb35c" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="cs-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b0f1f" />
          <stop offset="0.25" stopColor="#0b0812" />
          <stop offset="1" stopColor="#040308" />
        </linearGradient>
        <linearGradient id="cs-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#050409" stopOpacity="0" />
          <stop offset="1" stopColor="#050409" />
        </linearGradient>
        <filter id="cs-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#cs-sky)" />

      {/* estrelas que somem com o dia */}
      <g className="cs-stars" fill="#fff">
        {Array.from({ length: 70 }, (_, i) => {
          const x = (i * 397) % W;
          const y = (i * 131) % 330;
          return <circle key={i} cx={x} cy={y} r={i % 7 === 0 ? 1.4 : 0.8} opacity={0.25 + ((i * 17) % 50) / 100} />;
        })}
      </g>

      {/* sol nascendo */}
      <g className={rise ? "cs-rise" : undefined}>
        <circle cx={VX} cy={HORIZON - 20} r="520" fill="url(#cs-glow)" />
        <g className="cs-rays" style={{ transformOrigin: `${VX}px ${HORIZON - 20}px` }} filter="url(#cs-blur)" opacity="0.55">
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${VX} ${HORIZON - 20} L${VX + 1100} ${HORIZON - 80} L${VX + 1100} ${HORIZON + 40} Z`} fill="url(#cs-ray)" transform={`rotate(${180 + i * (180 / 13)} ${VX} ${HORIZON - 20})`} opacity={i % 2 ? 0.5 : 0.9} />
          ))}
        </g>
        <circle cx={VX} cy={HORIZON - 20} r="150" fill="url(#cs-sun)" />
        <circle cx={VX} cy={HORIZON - 20} r="62" fill="#fffbe9" />
      </g>

      {/* névoa no horizonte e serra */}
      <rect x="0" y={HORIZON - 40} width={W} height="90" fill="#ffb066" opacity="0.12" filter="url(#cs-blur)" />
      <path d={`M0 ${HORIZON - 8} C 200 ${HORIZON - 40}, 340 ${HORIZON - 30}, 520 ${HORIZON - 12} S 820 ${HORIZON - 34}, 1000 ${HORIZON - 6} S 1380 ${HORIZON - 30}, ${W} ${HORIZON - 10} L ${W} ${H} L 0 ${H} Z`} fill="#2a1428" />
      <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill="url(#cs-ground)" />

      {/* fazenda solar */}
      <g>{panelRows()}</g>

      {/* poeira na luz */}
      <g fill="#ffe7b0">
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} className="cs-dust" cx={(i * 211) % W} cy={HORIZON - 260 + ((i * 73) % 360)} r={i % 3 ? 1.6 : 2.6} opacity="0.5" style={{ animationDelay: `${(i % 9) * -1.3}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
        ))}
      </g>

      <rect width={W} height={H} fill="url(#cs-fade)" />
    </svg>
  );
}
