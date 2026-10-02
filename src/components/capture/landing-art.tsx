/* Ilustrações vetoriais da landing page (carregam na hora, sem depender de fotos). */

const panelRows = (x: number, y: number, cols: number, rows: number, w: number, h: number, gap = 3, skew = 0) =>
  Array.from({ length: rows * cols }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const px = x + c * (w + gap) + r * skew;
    const py = y + r * (h + gap);
    return <rect key={i} x={px} y={py} width={w} height={h} rx="1.5" fill="url(#lp-cell)" stroke="#9BD373" strokeOpacity="0.35" strokeWidth="0.6" />;
  });

function Defs() {
  return (
    <defs>
      <linearGradient id="lp-cell" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3a4a8f" />
        <stop offset="0.55" stopColor="#1d2a5c" />
        <stop offset="1" stopColor="#0f1838" />
      </linearGradient>
      <linearGradient id="lp-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a1d4d" />
        <stop offset="1" stopColor="#120b24" />
      </linearGradient>
      <radialGradient id="lp-sun" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFF6B0" />
        <stop offset="0.5" stopColor="#F3EA3B" />
        <stop offset="1" stopColor="#F3EA3B" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="lp-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f1fb" />
        <stop offset="1" stopColor="#d9d3ea" />
      </linearGradient>
      <linearGradient id="lp-energy" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#F3EA3B" />
        <stop offset="1" stopColor="#6CC690" />
      </linearGradient>
    </defs>
  );
}

/** Casa com placas no telhado, sol girando e energia fluindo. */
export function SolarHouseArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <Defs />
      <rect width="400" height="300" fill="url(#lp-sky)" />
      <g className="lp-spin" style={{ transformOrigin: "320px 70px" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="318" y="14" width="4" height="22" rx="2" fill="#F3EA3B" opacity="0.55" transform={`rotate(${i * 30} 320 70)`} />
        ))}
      </g>
      <circle cx="320" cy="70" r="46" fill="url(#lp-sun)" />
      <circle cx="320" cy="70" r="20" fill="#FFF3A0" />
      <path d="M0 250 Q200 220 400 250 L400 300 L0 300 Z" fill="#1b3a2b" />
      <path d="M0 262 Q200 236 400 262 L400 300 L0 300 Z" fill="#245a3c" />
      {/* casa */}
      <rect x="92" y="168" width="190" height="92" rx="4" fill="url(#lp-wall)" />
      <path d="M72 172 L187 96 L302 172 Z" fill="#3b2f5e" />
      <g transform="translate(118 118) skewX(-34) scale(1 0.62)">{panelRows(40, 0, 5, 3, 22, 30, 3)}</g>
      <rect x="120" y="198" width="38" height="62" rx="3" fill="#1C1234" />
      <rect x="182" y="196" width="34" height="28" rx="3" fill="#9fd3ff" opacity="0.8" />
      <rect x="230" y="196" width="34" height="28" rx="3" fill="#9fd3ff" opacity="0.8" />
      {/* inversor e fluxo */}
      <rect x="300" y="196" width="34" height="44" rx="6" fill="#f4f1fb" stroke="#9BD373" strokeWidth="2" />
      <circle cx="317" cy="210" r="4" fill="#6CC690" className="lp-blink" />
      <path d="M282 214 H300" stroke="url(#lp-energy)" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 6" className="lp-flow" />
      <path d="M220 120 C 270 120, 300 150, 317 196" fill="none" stroke="url(#lp-energy)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 7" className="lp-flow" />
    </svg>
  );
}

/** Carregador de parede (wallbox) com carro elétrico carregando. */
export function EvChargerArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <Defs />
      <rect width="400" height="300" fill="url(#lp-sky)" />
      <rect x="0" y="232" width="400" height="68" fill="#1a1530" />
      <rect x="0" y="230" width="400" height="4" fill="#2f2650" />
      {/* parede e wallbox */}
      <rect x="40" y="40" width="90" height="192" fill="#251c45" />
      <rect x="62" y="88" width="46" height="70" rx="10" fill="#f4f1fb" />
      <rect x="70" y="100" width="30" height="14" rx="3" fill="#1C1234" />
      <circle cx="85" cy="132" r="7" fill="#2F7BF6" className="lp-blink" />
      <path d="M85 158 C 85 200, 150 200, 168 186" fill="none" stroke="#1C1234" strokeWidth="6" strokeLinecap="round" />
      <path d="M85 158 C 85 200, 150 200, 168 186" fill="none" stroke="#7CC4FF" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 7" className="lp-flow" />
      {/* carro */}
      <path d="M150 214 C 152 186, 178 170, 214 166 L 290 164 C 318 164, 340 178, 356 196 L 372 200 C 380 202, 382 214, 378 220 L 156 222 Z" fill="#e9e5f6" />
      <path d="M200 172 L 222 152 C 230 146, 240 144, 252 144 L 296 144 C 310 144, 322 152, 332 164 Z" fill="#cfc7ea" />
      <path d="M212 168 L 228 154 L 262 154 L 262 168 Z" fill="#7CC4FF" opacity="0.8" />
      <path d="M270 168 L 270 154 L 300 154 C 308 154, 316 160, 320 168 Z" fill="#7CC4FF" opacity="0.8" />
      <circle cx="196" cy="222" r="20" fill="#1C1234" />
      <circle cx="196" cy="222" r="9" fill="#9a97ae" />
      <circle cx="330" cy="222" r="20" fill="#1C1234" />
      <circle cx="330" cy="222" r="9" fill="#9a97ae" />
      {/* bateria */}
      <g transform="translate(250 92)">
        <rect width="74" height="34" rx="8" fill="#120b24" stroke="#7CC4FF" strokeWidth="2" />
        <rect x="74" y="11" width="6" height="12" rx="2" fill="#7CC4FF" />
        <rect x="6" y="6" width="44" height="22" rx="4" fill="#7CC4FF" className="lp-charge" />
        <text x="37" y="23" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="sans-serif">⚡</text>
      </g>
    </svg>
  );
}

/** Eletroposto de carga rápida com cobertura solar. */
export function StationArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <Defs />
      <rect width="400" height="300" fill="url(#lp-sky)" />
      <rect x="0" y="236" width="400" height="64" fill="#1a1530" />
      {[60, 150, 240, 330].map((x) => (
        <rect key={x} x={x - 16} y="250" width="32" height="4" rx="2" fill="#F3EA3B" opacity="0.5" />
      ))}
      {/* cobertura com placas */}
      <path d="M30 78 L 370 58 L 370 74 L 30 94 Z" fill="#2f2650" />
      <g transform="translate(40 62) skewY(-3.4)">{panelRows(0, 0, 11, 1, 27, 12, 3)}</g>
      <rect x="70" y="92" width="8" height="144" fill="#3b3160" />
      <rect x="320" y="74" width="8" height="162" fill="#3b3160" />
      {/* carregadores */}
      {[130, 230].map((x, i) => (
        <g key={x} transform={`translate(${x} 140)`}>
          <rect width="44" height="96" rx="10" fill="#f4f1fb" />
          <rect x="7" y="10" width="30" height="22" rx="4" fill="#1C1234" />
          <rect x="11" y="16" width={i ? 14 : 20} height="10" rx="2" fill="#6CC690" className="lp-charge" />
          <circle cx="22" cy="50" r="6" fill="#1FA36A" className="lp-blink" />
          <rect x="16" y="66" width="12" height="20" rx="3" fill="#cfc7ea" />
        </g>
      ))}
      <text x="200" y="40" textAnchor="middle" fontSize="15" fontWeight="800" fill="#F3EA3B" fontFamily="sans-serif" letterSpacing="3">CARGA RÁPIDA</text>
      <path d="M152 236 v-8 M252 236 v-8" stroke="#6CC690" strokeWidth="3" />
    </svg>
  );
}

/** Placas sendo limpas: gotas, brilho e geração voltando. */
export function CleaningArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <Defs />
      <rect width="400" height="300" fill="url(#lp-sky)" />
      <g transform="translate(60 110) skewX(-24) scale(1 0.8)">{panelRows(40, 0, 6, 3, 40, 52, 5)}</g>
      {/* metade suja */}
      <g transform="translate(60 110) skewX(-24) scale(1 0.8)" opacity="0.65">
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={40 + (i % 3) * 45} y={Math.floor(i / 3) * 57} width="40" height="52" rx="1.5" fill="#8a6d3b" opacity={0.35 + (i % 2) * 0.15} />
        ))}
      </g>
      {/* rodo */}
      <g className="lp-sweep">
        <rect x="196" y="88" width="10" height="132" rx="5" fill="#7DE3F0" transform="rotate(-24 201 154)" />
        <rect x="186" y="62" width="6" height="60" rx="3" fill="#cfc7ea" transform="rotate(-24 189 92)" />
      </g>
      {[[230, 70], [260, 96], [292, 62], [318, 90], [248, 124]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q6 9 0 14 q-6 -5 0 -14z`} fill="#7DE3F0" className="lp-drop" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
      {/* geração */}
      <g transform="translate(300 220)">
        <rect width="80" height="40" rx="10" fill="#120b24" stroke="#6CC690" strokeWidth="2" />
        <text x="40" y="26" textAnchor="middle" fontSize="15" fontWeight="800" fill="#9BD373" fontFamily="sans-serif">+25%</text>
      </g>
    </svg>
  );
}

/** Painel de gestão de energia: créditos, rateio e conta caindo. */
export function ManagementArt({ className }: { className?: string }) {
  const bars = [120, 96, 78, 60, 44, 34];
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <Defs />
      <rect width="400" height="300" fill="url(#lp-sky)" />
      <rect x="40" y="40" width="320" height="220" rx="18" fill="#1d1538" stroke="#ffffff" strokeOpacity="0.08" />
      <rect x="60" y="60" width="120" height="12" rx="6" fill="#ffffff" opacity="0.18" />
      <rect x="60" y="80" width="80" height="8" rx="4" fill="#ffffff" opacity="0.1" />
      {bars.map((h, i) => (
        <rect key={i} x={70 + i * 34} y={230 - h} width="22" height={h} rx="6" fill="url(#lp-energy)" opacity={0.45 + i * 0.1} className="lp-grow" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${81 + i * 34}px 230px` }} />
      ))}
      <path d="M70 120 C 120 128, 160 150, 200 168 S 260 200, 280 206" fill="none" stroke="#F3EA3B" strokeWidth="2.5" strokeDasharray="5 6" className="lp-flow" />
      {/* donut de rateio */}
      <g transform="translate(310 130)">
        <circle r="34" fill="none" stroke="#3b3160" strokeWidth="12" />
        <circle r="34" fill="none" stroke="#6CC690" strokeWidth="12" strokeDasharray="120 214" transform="rotate(-90)" />
        <circle r="34" fill="none" stroke="#F3EA3B" strokeWidth="12" strokeDasharray="60 214" strokeDashoffset="-122" transform="rotate(-90)" />
        <text y="5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="sans-serif">rateio</text>
      </g>
      <rect x="262" y="196" width="80" height="44" rx="10" fill="#120b24" stroke="#9BD373" strokeOpacity="0.6" />
      <text x="302" y="223" textAnchor="middle" fontSize="13" fontWeight="800" fill="#9BD373" fontFamily="sans-serif">−78%</text>
    </svg>
  );
}
