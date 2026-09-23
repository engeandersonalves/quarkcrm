/* Ilustrações vetoriais da proposta — leves, nítidas na impressão e sem dependências. */

type P = { className?: string };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function quad(tl: number[], tr: number[], br: number[], bl: number[], u: number, v: number) {
  const top = [lerp(tl[0], tr[0], u), lerp(tl[1], tr[1], u)];
  const bot = [lerp(bl[0], br[0], u), lerp(bl[1], br[1], u)];
  return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)];
}

/** Painéis em perspectiva dentro de um quadrilátero (face do telhado). */
function PanelGrid({ tl, tr, br, bl, cols, rows }: { tl: number[]; tr: number[]; br: number[]; bl: number[]; cols: number; rows: number }) {
  const gap = 0.035;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const u0 = c / cols + gap / 2;
      const u1 = (c + 1) / cols - gap / 2;
      const v0 = r / rows + gap;
      const v1 = (r + 1) / rows - gap;
      const pts = [quad(tl, tr, br, bl, u0, v0), quad(tl, tr, br, bl, u1, v0), quad(tl, tr, br, bl, u1, v1), quad(tl, tr, br, bl, u0, v1)];
      const mid = [quad(tl, tr, br, bl, (u0 + u1) / 2, v0), quad(tl, tr, br, bl, (u0 + u1) / 2, v1)];
      const hmid = [quad(tl, tr, br, bl, u0, (v0 + v1) / 2), quad(tl, tr, br, bl, u1, (v0 + v1) / 2)];
      cells.push(
        <g key={`${r}-${c}`}>
          <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="url(#panelGrad)" stroke="#93C5FD" strokeWidth="0.8" />
          <line x1={mid[0][0]} y1={mid[0][1]} x2={mid[1][0]} y2={mid[1][1]} stroke="#60A5FA" strokeWidth="0.6" opacity="0.7" />
          <line x1={hmid[0][0]} y1={hmid[0][1]} x2={hmid[1][0]} y2={hmid[1][1]} stroke="#60A5FA" strokeWidth="0.6" opacity="0.7" />
        </g>,
      );
    }
  return <>{cells}</>;
}

export function HeroScene({ className }: P) {
  return (
    <svg viewBox="0 0 480 340" className={className} role="img" aria-label="Casa com placas solares num dia de sol">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BAE6FD" />
          <stop offset="1" stopColor="#FEF9C3" />
        </linearGradient>
        <radialGradient id="sunGrad" cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#FEF08A" />
          <stop offset="0.6" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </radialGradient>
        <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E3A8A" />
          <stop offset="0.5" stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
        <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <clipPath id="skyClip">
          <rect width="480" height="340" rx="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#skyClip)">
        <rect width="480" height="340" fill="url(#sky)" />
        {/* Sol */}
        <g className="origin-[392px_78px] animate-[spin_40s_linear_infinite]">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={392 + Math.cos(a) * 50} y1={78 + Math.sin(a) * 50} x2={392 + Math.cos(a) * 66} y2={78 + Math.sin(a) * 66} stroke="#FBBF24" strokeWidth="6" strokeLinecap="round" />;
          })}
        </g>
        <circle cx="392" cy="78" r="40" fill="url(#sunGrad)" />
        <circle cx="380" cy="72" r="4" fill="#92400E" />
        <circle cx="402" cy="72" r="4" fill="#92400E" />
        <path d="M378 88 q14 12 28 0" stroke="#92400E" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="372" cy="86" r="5" fill="#FB923C" opacity="0.5" />
        <circle cx="412" cy="86" r="5" fill="#FB923C" opacity="0.5" />
        {/* Nuvens */}
        <g fill="#fff">
          <ellipse cx="90" cy="70" rx="42" ry="18" />
          <ellipse cx="116" cy="58" rx="26" ry="20" />
          <ellipse cx="72" cy="60" rx="20" ry="15" />
          <ellipse cx="250" cy="44" rx="30" ry="12" opacity="0.9" />
          <ellipse cx="268" cy="36" rx="18" ry="13" opacity="0.9" />
        </g>
        {/* Raios até as placas */}
        <g stroke="#FBBF24" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" opacity="0.9">
          <line x1="360" y1="110" x2="300" y2="150" />
          <line x1="352" y1="100" x2="262" y2="142" />
          <line x1="370" y1="118" x2="330" y2="170" />
        </g>
        {/* Colinas */}
        <path d="M0 268 Q120 222 240 256 T480 240 V340 H0 Z" fill="#86EFAC" />
        <path d="M0 292 Q140 262 260 288 T480 280 V340 H0 Z" fill="#4ADE80" />
        {/* Árvore */}
        <rect x="66" y="222" width="12" height="46" rx="4" fill="#92400E" />
        <circle cx="72" cy="212" r="28" fill="#22C55E" />
        <circle cx="54" cy="224" r="18" fill="#16A34A" />
        <circle cx="92" cy="222" r="18" fill="#16A34A" />
        {/* Casa */}
        <rect x="150" y="176" width="200" height="104" rx="6" fill="#FFF7ED" />
        <rect x="150" y="176" width="200" height="10" fill="#FED7AA" />
        <polygon points="132,182 186,112 314,112 368,182" fill="url(#roofGrad)" />
        <polygon points="132,182 186,112 190,112 138,182" fill="#FDBA74" opacity="0.5" />
        <PanelGrid tl={[196, 122]} tr={[304, 122]} br={[336, 172]} bl={[164, 172]} cols={4} rows={2} />
        {/* Faíscas de energia */}
        <g fill="#FACC15">
          <path d="M246 96 l-8 14 h7 l-4 12 l12 -16 h-7 l5 -10 z" />
          <path d="M318 98 l-5 9 h5 l-3 8 l8 -11 h-5 l3 -6 z" />
        </g>
        {/* Porta e janelas */}
        <rect x="232" y="214" width="36" height="66" rx="5" fill="#0EA5E9" />
        <circle cx="260" cy="248" r="2.5" fill="#FDE68A" />
        <rect x="170" y="204" width="44" height="36" rx="5" fill="#FDE68A" />
        <path d="M192 204 v36 M170 222 h44" stroke="#FFF7ED" strokeWidth="3" />
        <rect x="286" y="204" width="44" height="36" rx="5" fill="#FDE68A" />
        <path d="M308 204 v36 M286 222 h44" stroke="#FFF7ED" strokeWidth="3" />
        {/* Inversor na parede */}
        <rect x="336" y="228" width="10" height="16" rx="2" fill="#E2E8F0" stroke="#94A3B8" />
        {/* Caminho */}
        <path d="M240 280 Q236 310 214 340 H290 Q266 310 262 280 Z" fill="#FDE68A" opacity="0.8" />
        {/* Flores */}
        {[120, 140, 372, 392, 412].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={292} x2={x} y2={278} stroke="#15803D" strokeWidth="2" />
            <circle cx={x} cy={276} r={5} fill={["#F472B6", "#FACC15", "#F472B6", "#A78BFA", "#FACC15"][i]} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ----------------------------------------------------- Como funciona */

export function SunIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={48 + Math.cos(a) * 30} y1={48 + Math.sin(a) * 30} x2={48 + Math.cos(a) * 42} y2={48 + Math.sin(a) * 42} stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />;
      })}
      <circle cx="48" cy="48" r="24" fill="#FBBF24" />
      <circle cx="41" cy="45" r="3" fill="#92400E" />
      <circle cx="55" cy="45" r="3" fill="#92400E" />
      <path d="M40 54 q8 7 16 0" stroke="#92400E" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PanelIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <defs>
        <linearGradient id="pg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E3A8A" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect x="44" y="60" width="8" height="24" rx="2" fill="#94A3B8" />
      <rect x="30" y="82" width="36" height="6" rx="3" fill="#64748B" />
      <polygon points="18,22 78,22 88,62 8,62" fill="url(#pg2)" stroke="#BFDBFE" strokeWidth="2" strokeLinejoin="round" />
      <path d="M33 22 L28 62 M48 22 V62 M63 22 L68 62 M13 42 H83" stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M24 26 l10 0 l-2 8 l-10 0 z" fill="#fff" opacity="0.35" />
    </svg>
  );
}

export function InverterIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="22" y="12" width="52" height="72" rx="10" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" />
      <rect x="30" y="22" width="36" height="20" rx="4" fill="#0F172A" />
      <path d="M50 25 l-7 9 h5 l-3 6 l8 -9 h-5 l3 -6 z" fill="#FACC15" />
      <circle cx="36" cy="54" r="3" fill="#22C55E" />
      <circle cx="46" cy="54" r="3" fill="#CBD5E1" />
      <rect x="30" y="64" width="36" height="4" rx="2" fill="#CBD5E1" />
      <rect x="30" y="72" width="24" height="4" rx="2" fill="#CBD5E1" />
    </svg>
  );
}

export function HouseIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <polygon points="10,46 48,14 86,46" fill="#F97316" />
      <rect x="18" y="44" width="60" height="42" rx="4" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="2" />
      <rect x="40" y="60" width="16" height="26" rx="3" fill="#0EA5E9" />
      <rect x="24" y="54" width="12" height="12" rx="2" fill="#FDE68A" />
      <rect x="60" y="54" width="12" height="12" rx="2" fill="#FDE68A" />
      <circle cx="48" cy="34" r="7" fill="#FEF08A" stroke="#F59E0B" strokeWidth="2" />
      <path d="M45 42 h6" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MeterIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="18" y="14" width="60" height="68" rx="10" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="2" />
      <circle cx="48" cy="42" r="18" fill="#fff" stroke="#0EA5E9" strokeWidth="2" />
      <path d="M48 42 L58 34" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 70 h14 m-5 -5 l5 5 l-5 5" stroke="#16A34A" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 70 h-14 m5 -5 l-5 5 l5 5" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoonCoinIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M58 16 a30 30 0 1 0 22 46 a24 24 0 1 1 -22 -46 z" fill="#C7D2FE" />
      <circle cx="30" cy="66" r="16" fill="#FACC15" stroke="#CA8A04" strokeWidth="3" />
      <text x="30" y="72" textAnchor="middle" fontSize="16" fontWeight="800" fill="#854D0E">
        $
      </text>
      <circle cx="74" cy="22" r="2" fill="#A5B4FC" />
      <circle cx="84" cy="36" r="1.5" fill="#A5B4FC" />
    </svg>
  );
}

/* ------------------------------------------------------------ Conta */

export function BillIllo({ amount, tone, className }: { amount: string; tone: "before" | "after"; className?: string }) {
  const accent = tone === "before" ? "#EF4444" : "#16A34A";
  return (
    <svg viewBox="0 0 160 200" className={className} role="img" aria-label={`Conta de ${amount}`}>
      <path d="M16 8 H144 a8 8 0 0 1 8 8 V180 l-12 12 l-12 -12 l-12 12 l-12 -12 l-12 12 l-12 -12 l-12 12 l-12 -12 l-12 12 l-12 -12 l-12 12 l-8 -8 V16 a8 8 0 0 1 8 -8 z" fill="#fff" stroke="#E2E8F0" strokeWidth="2" />
      <rect x="8" y="8" width="144" height="30" rx="8" fill={accent} opacity="0.12" />
      <circle cx="26" cy="23" r="7" fill={accent} opacity="0.8" />
      <rect x="40" y="18" width="60" height="5" rx="2.5" fill={accent} opacity="0.5" />
      <rect x="40" y="26" width="40" height="4" rx="2" fill={accent} opacity="0.3" />
      {[56, 70, 84, 98].map((y) => (
        <g key={y}>
          <rect x="22" y={y} width="70" height="5" rx="2.5" fill="#E2E8F0" />
          <rect x="112" y={y} width="26" height="5" rx="2.5" fill="#CBD5E1" />
        </g>
      ))}
      <rect x="18" y="120" width="124" height="44" rx="10" fill={accent} opacity="0.1" />
      <text x="80" y="136" textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748B">
        TOTAL A PAGAR
      </text>
      <text x="80" y="156" textAnchor="middle" fontSize="18" fontWeight="800" fill={accent}>
        {amount}
      </text>
    </svg>
  );
}

export function PiggyIllo({ className }: P) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <circle cx="62" cy="14" r="11" fill="#FACC15" stroke="#CA8A04" strokeWidth="2.5" />
      <text x="62" y="19" textAnchor="middle" fontSize="12" fontWeight="800" fill="#854D0E">
        $
      </text>
      <ellipse cx="58" cy="58" rx="40" ry="30" fill="#F9A8D4" />
      <circle cx="94" cy="52" r="12" fill="#F472B6" />
      <circle cx="91" cy="50" r="2" fill="#831843" />
      <circle cx="97" cy="50" r="2" fill="#831843" />
      <circle cx="70" cy="46" r="3.5" fill="#831843" />
      <path d="M44 30 l6 -10 l6 12 z" fill="#F472B6" />
      <rect x="52" y="30" width="20" height="4" rx="2" fill="#BE185D" />
      <rect x="30" y="80" width="10" height="14" rx="4" fill="#F472B6" />
      <rect x="68" y="80" width="10" height="14" rx="4" fill="#F472B6" />
      <path d="M18 56 q-10 -4 -6 -12" stroke="#F472B6" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------------------------- Equipamentos */

export function StructureIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <polygon points="8,70 88,70 76,86 20,86" fill="#FB923C" />
      <rect x="14" y="40" width="68" height="6" rx="3" fill="#94A3B8" />
      <rect x="14" y="56" width="68" height="6" rx="3" fill="#94A3B8" />
      {[24, 48, 72].map((x) => (
        <g key={x}>
          <rect x={x - 3} y="34" width="6" height="36" rx="2" fill="#64748B" />
          <circle cx={x} cy="43" r="3" fill="#CBD5E1" />
          <circle cx={x} cy="59" r="3" fill="#CBD5E1" />
        </g>
      ))}
    </svg>
  );
}

export function ToolsIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M20 74 L56 38" stroke="#64748B" strokeWidth="10" strokeLinecap="round" />
      <path d="M58 22 a16 16 0 0 0 16 22 l-8 -8 l4 -10 l10 -4 l8 8 a16 16 0 0 0 -22 -16 z" fill="#94A3B8" />
      <rect x="44" y="52" width="40" height="12" rx="4" fill="#F59E0B" transform="rotate(45 64 58)" />
      <path d="M22 30 h18 v10 h-18 z" fill="#0EA5E9" />
      <rect x="28" y="40" width="6" height="18" rx="2" fill="#0369A1" />
    </svg>
  );
}

export function ShieldIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M48 8 L80 20 V46 C80 66 66 80 48 88 C30 80 16 66 16 46 V20 Z" fill="#22C55E" />
      <path d="M48 16 L72 25 V46 C72 61 62 72 48 79 Z" fill="#16A34A" />
      <path d="M34 48 l10 10 l20 -22" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ----------------------------------------------------------- Planeta */

export function TreeIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="43" y="56" width="10" height="30" rx="3" fill="#92400E" />
      <circle cx="48" cy="40" r="26" fill="#22C55E" />
      <circle cx="32" cy="50" r="14" fill="#16A34A" />
      <circle cx="64" cy="50" r="14" fill="#16A34A" />
      <circle cx="40" cy="30" r="4" fill="#86EFAC" />
    </svg>
  );
}

export function CarIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 58 l8 -18 a8 8 0 0 1 7 -5 h38 a8 8 0 0 1 7 5 l8 18 v14 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 z" fill="#38BDF8" />
      <path d="M26 56 l6 -14 h32 l6 14 z" fill="#E0F2FE" />
      <circle cx="30" cy="76" r="9" fill="#0F172A" />
      <circle cx="66" cy="76" r="9" fill="#0F172A" />
      <circle cx="30" cy="76" r="3.5" fill="#94A3B8" />
      <circle cx="66" cy="76" r="3.5" fill="#94A3B8" />
      <path d="M78 24 q10 4 6 14" stroke="#86EFAC" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIllo({ className }: P) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <circle cx="48" cy="48" r="36" fill="#38BDF8" />
      <path d="M28 28 q10 -4 16 4 q4 8 -4 12 q-8 2 -6 10 q2 8 -8 8 q-8 -4 -10 -14 q0 -12 12 -20 z" fill="#4ADE80" />
      <path d="M58 20 q12 6 16 18 q-6 2 -10 -2 q-6 -2 -8 4 q-4 -10 2 -20 z" fill="#4ADE80" />
      <path d="M56 60 q10 -4 14 4 q-2 10 -12 14 q-6 -8 -2 -18 z" fill="#4ADE80" />
      <circle cx="36" cy="30" r="3" fill="#fff" opacity="0.6" />
    </svg>
  );
}
