/* Renderizações realistas de produto (usadas quando não há foto real cadastrada) e diagrama técnico. */

import type { SVGProps } from "react";

type R = SVGProps<SVGSVGElement>;

/** Módulo monocristalino half-cell, vista frontal com moldura de alumínio e reflexo no vidro. */
export function ModuleRender(props: R) {
  const cols = 6;
  const rows = 20;
  const x0 = 12;
  const y0 = 12;
  const w = 196;
  const h = 416;
  const gap = 1.6;
  const mid = 6; // faixa central entre as duas metades
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - mid - gap * (rows + 2)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = x0 + gap + c * (cw + gap);
      const y = y0 + gap + r * (ch + gap) + (r >= rows / 2 ? mid : 0);
      cells.push(<rect key={`${r}-${c}`} x={x} y={y} width={cw} height={ch} rx="0.8" fill="url(#cell)" />);
    }
  const busbars = [];
  for (let c = 0; c < cols; c++)
    for (let b = 1; b <= 4; b++) {
      const x = x0 + gap + c * (cw + gap) + (cw * b) / 5;
      busbars.push(<line key={`${c}-${b}`} x1={x} y1={y0 + 2} x2={x} y2={y0 + h - 2} stroke="#8a95a5" strokeWidth="0.35" opacity="0.45" />);
    }
  return (
    <svg viewBox="0 0 220 452" {...props}>
      <defs>
        <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1f4" />
          <stop offset="0.5" stopColor="#aeb6c0" />
          <stop offset="1" stopColor="#dfe3e8" />
        </linearGradient>
        <linearGradient id="cell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2536" />
          <stop offset="1" stopColor="#0a0f19" />
        </linearGradient>
        <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="modShadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b1220" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="444" rx="96" ry="7" fill="url(#modShadow)" />
      <rect x="4" y="4" width="212" height="432" rx="4" fill="url(#frame)" />
      <rect x="10" y="10" width="200" height="420" rx="1.5" fill="#0d1422" />
      {cells}
      {busbars}
      <line x1={x0} y1={y0 + h / 2} x2={x0 + w} y2={y0 + h / 2} stroke="#c9d0d8" strokeWidth="1.2" opacity="0.7" />
      <polygon points="10,10 150,10 10,230" fill="url(#glare)" />
      <rect x="10" y="10" width="200" height="420" rx="1.5" fill="none" stroke="#2a3446" strokeWidth="0.8" />
    </svg>
  );
}

const BRAND_COLORS: Record<string, string> = {
  growatt: "#E4751B",
  deye: "#0A5DAA",
  huawei: "#C7000B",
  fronius: "#E2001A",
  sungrow: "#0B5CAD",
  goodwe: "#D7141A",
  weg: "#00579D",
  saj: "#D6001C",
  solis: "#00508C",
  chint: "#0053A0",
  solaredge: "#E30613",
  hoymiles: "#0F6ACD",
  apsystems: "#00923F",
  enphase: "#F37321",
};

/** Inversor string de parede, com display, LEDs, chave CC e conectores. */
export function InverterRender({ brand = "", power = "", ...props }: R & { brand?: string; power?: string }) {
  const key = brand.toLowerCase().replace(/[^a-z]/g, "");
  const color = Object.entries(BRAND_COLORS).find(([k]) => key.includes(k))?.[1] ?? "#1C1234";
  return (
    <svg viewBox="0 0 240 320" {...props}>
      <defs>
        <linearGradient id="invBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f7f8fa" />
          <stop offset="0.75" stopColor="#eceff3" />
          <stop offset="1" stopColor="#d3d8df" />
        </linearGradient>
        <linearGradient id="invTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lcd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1a24" />
          <stop offset="1" stopColor="#0a1117" />
        </linearGradient>
        <radialGradient id="invShadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b1220" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="306" rx="100" ry="9" fill="url(#invShadow)" />
      {/* suporte de parede */}
      <rect x="44" y="14" width="152" height="10" rx="3" fill="#9aa3ad" />
      {/* corpo */}
      <rect x="26" y="20" width="188" height="248" rx="18" fill="url(#invBody)" stroke="#c4cad2" />
      <rect x="26" y="20" width="188" height="70" rx="18" fill="url(#invTop)" />
      <rect x="200" y="40" width="10" height="210" rx="5" fill="#c9cfd6" opacity="0.7" />
      {/* marca */}
      <text x="46" y="60" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="17" letterSpacing="1.5" fill={color}>
        {(brand || "INVERSOR").toUpperCase().slice(0, 12)}
      </text>
      <rect x="46" y="68" width="40" height="2.5" rx="1" fill={color} opacity="0.8" />
      {/* display */}
      <rect x="62" y="98" width="116" height="62" rx="8" fill="url(#lcd)" stroke="#2b3845" />
      <text x="120" y="126" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="17" fill="#6ee7b7">
        {power || "5.0 kW"}
      </text>
      <text x="120" y="143" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fill="#5eead4" opacity="0.7">
        ON-GRID · NORMAL
      </text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={76 + i * 15} y="149" width="10" height={3 + i * 0.6} rx="1" fill="#34d399" opacity={0.35 + i * 0.1} />
      ))}
      {/* LEDs */}
      <circle cx="98" cy="180" r="4" fill="#22c55e" />
      <circle cx="120" cy="180" r="4" fill="#d1d5db" />
      <circle cx="142" cy="180" r="4" fill="#d1d5db" />
      {/* linhas de ventilação */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="70" y={206 + i * 9} width="100" height="3" rx="1.5" fill="#d6dbe1" />
      ))}
      {/* base com conectores */}
      <rect x="40" y="262" width="160" height="16" rx="5" fill="#bfc6ce" />
      {[58, 76, 94, 112].map((x) => (
        <rect key={x} x={x} y="276" width="9" height="18" rx="3" fill="#1f2937" />
      ))}
      <circle cx="156" cy="284" r="11" fill="#111827" />
      <rect x="150" y="281" width="12" height="6" rx="2" fill="#dc2626" />
      <rect x="176" y="276" width="10" height="16" rx="3" fill="#374151" />
    </svg>
  );
}

/** Diagrama técnico do sistema on-grid (padrão de engenharia, linhas finas). */
export function SystemDiagram({ brand, className }: { brand?: string; className?: string }) {
  const ink = "#1C1234";
  const muted = "#64748B";
  const node = (x: number, label: string, sub: string) => (
    <g>
      <text x={x} y="184" textAnchor="middle" fontSize="13" fontWeight="700" fill={ink} fontFamily="inherit">
        {label}
      </text>
      <text x={x} y="201" textAnchor="middle" fontSize="11" fill={muted} fontFamily="inherit">
        {sub}
      </text>
    </g>
  );
  const arrow = (x1: number, x2: number, y: number, label: string, color = ink) => (
    <g>
      <line x1={x1} y1={y} x2={x2 - 6} y2={y} stroke={color} strokeWidth="2" />
      <polygon points={`${x2},${y} ${x2 - 9},${y - 5} ${x2 - 9},${y + 5}`} fill={color} />
      <text x={(x1 + x2) / 2} y={y - 9} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={muted} fontFamily="inherit" letterSpacing="0.5">
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 1000 220" className={className} role="img" aria-label="Diagrama do sistema fotovoltaico conectado à rede">
      <ModuleRender x="34" y="18" width="50" height="136" />
      <ModuleRender x="88" y="18" width="50" height="136" />
      {node(86, "Placas solares", "Luz → energia")}
      {arrow(158, 262, 88, "CC")}
      <InverterRender x="262" y="26" width="116" height="146" brand={brand} power="" />
      {node(320, "Inversor", "Converte CC em CA")}
      {arrow(386, 482, 88, "CA")}
      <g>
        <rect x="488" y="42" width="96" height="108" rx="8" fill="#F1F5F9" stroke="#CBD5E1" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={503 + i * 17} y="62" width="12" height="32" rx="2" fill="#fff" stroke="#94A3B8" />
            <rect x={506 + i * 17} y="68" width="6" height="10" rx="1" fill={i === 0 ? "#16A34A" : "#475569"} />
          </g>
        ))}
        <rect x="503" y="106" width="66" height="28" rx="3" fill="#E2E8F0" />
      </g>
      {node(536, "Quadro de energia", "Abastece o imóvel")}
      {arrow(598, 712, 72, "EXCEDENTE", "#15803D")}
      <g>
        <line x1="712" y1="108" x2="606" y2="108" stroke="#B45309" strokeWidth="2" />
        <polygon points="598,108 607,103 607,113" fill="#B45309" />
        <text x="655" y="127" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={muted} letterSpacing="0.5">
          CRÉDITOS À NOITE
        </text>
      </g>
      <g>
        <rect x="718" y="40" width="98" height="110" rx="10" fill="#fff" stroke="#CBD5E1" />
        <rect x="733" y="56" width="68" height="30" rx="4" fill="#0F172A" />
        <text x="767" y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill="#FDE68A" fontFamily="monospace">
          00427
        </text>
        <text x="767" y="104" textAnchor="middle" fontSize="10" fill={muted}>
          bidirecional
        </text>
        <circle cx="767" cy="128" r="8" fill="#E2E8F0" />
      </g>
      {node(767, "Medidor", "Entrada e saída")}
      {arrow(826, 900, 90, "")}
      <g stroke={ink} strokeWidth="2.5" fill="none" strokeLinecap="round">
        <line x1="940" y1="36" x2="940" y2="150" />
        <line x1="914" y1="52" x2="966" y2="52" />
        <line x1="920" y1="74" x2="960" y2="74" />
        <line x1="940" y1="150" x2="922" y2="150" />
        <line x1="940" y1="150" x2="958" y2="150" />
      </g>
      {node(940, "Rede", "Distribuidora")}
    </svg>
  );
}

/** Carregador veicular de parede (wallbox) com cabo e conector Tipo 2. */
export function WallboxRender({ power = "22 kW", ...props }: R & { power?: string }) {
  return (
    <svg viewBox="0 0 240 320" {...props}>
      <defs>
        <linearGradient id="wbBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a3442" />
          <stop offset="0.6" stopColor="#1a212c" />
          <stop offset="1" stopColor="#10151d" />
        </linearGradient>
        <linearGradient id="wbFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#dfe4ea" />
        </linearGradient>
        <radialGradient id="wbShadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b1220" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wbLed" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9BD373" stopOpacity="0" />
          <stop offset="0.5" stopColor="#9BD373" />
          <stop offset="1" stopColor="#9BD373" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="306" rx="96" ry="8" fill="url(#wbShadow)" />
      {/* corpo */}
      <rect x="52" y="18" width="136" height="200" rx="26" fill="url(#wbBody)" />
      <rect x="62" y="28" width="116" height="180" rx="20" fill="url(#wbFace)" />
      {/* anel de LED */}
      <rect x="84" y="56" width="72" height="4" rx="2" fill="url(#wbLed)" />
      <text x="120" y="100" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="22" fill="#1C1234">
        {power}
      </text>
      <text x="120" y="116" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.5" letterSpacing="1.5" fill="#64748b">
        AC · MODO 3
      </text>
      <circle cx="120" cy="150" r="18" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M116 140 L110 152 H119 L114 162 L128 147 H120 L125 140 Z" fill="#3F9C6A" />
      <rect x="96" y="184" width="48" height="6" rx="3" fill="#cbd5e1" />
      {/* cabo */}
      <path d="M120 218 C120 250 70 244 70 276 C70 292 96 296 150 290" fill="none" stroke="#111827" strokeWidth="7" strokeLinecap="round" />
      {/* conector tipo 2 */}
      <g transform="translate(150 272)">
        <rect x="0" y="4" width="46" height="28" rx="12" fill="#1f2937" />
        <circle cx="34" cy="18" r="10" fill="#374151" />
        {[
          [30, 13],
          [38, 13],
          [34, 21],
          [29, 21],
          [39, 21],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#9ca3af" />
        ))}
      </g>
    </svg>
  );
}

/** Diagrama do S.A.V.E: ponto de conexão → quadro de proteção → wallbox (+ tomada e emergência). */
export function SaveDiagram({
  distance,
  power,
  panel = true,
  emergency = true,
  socket = true,
  className,
}: {
  distance: number;
  power: string;
  panel?: boolean;
  emergency?: boolean;
  socket?: boolean;
  className?: string;
}) {
  const ink = "#1C1234";
  const muted = "#64748B";
  const node = (x: number, label: string, sub: string) => (
    <g>
      <text x={x} y="186" textAnchor="middle" fontSize="13" fontWeight="700" fill={ink}>
        {label}
      </text>
      <text x={x} y="203" textAnchor="middle" fontSize="11" fill={muted}>
        {sub}
      </text>
    </g>
  );
  const wire = (x1: number, x2: number, label: string) => (
    <g>
      <line x1={x1} y1="92" x2={x2 - 6} y2="92" stroke={ink} strokeWidth="2.5" />
      <polygon points={`${x2},92 ${x2 - 9},87 ${x2 - 9},97`} fill={ink} />
      <text x={(x1 + x2) / 2} y="82" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={muted} letterSpacing="0.5">
        {label}
      </text>
    </g>
  );
  const boardX = panel ? 330 : -1;
  return (
    <svg viewBox="0 0 1000 220" className={className} role="img" aria-label="Diagrama de ligação do carregador veicular">
      {/* ponto de conexão (quadro existente) */}
      <g>
        <rect x="40" y="40" width="100" height="108" rx="8" fill="#F1F5F9" stroke="#CBD5E1" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={55 + i * 18} y="60" width="12" height="32" rx="2" fill="#fff" stroke="#94A3B8" />
            <rect x={58 + i * 18} y="66" width="6" height="10" rx="1" fill="#475569" />
          </g>
        ))}
        <rect x="55" y="104" width="70" height="28" rx="3" fill="#E2E8F0" />
      </g>
      {node(90, "Ponto de conexão", "Quadro existente")}

      {panel ? (
        <>
          {wire(150, 320, "CIRCUITO DEDICADO")}
          <g>
            <rect x={boardX} y="34" width="120" height="118" rx="8" fill="#fff" stroke={ink} strokeWidth="2" />
            <rect x={boardX + 12} y="46" width="96" height="10" rx="2" fill="#F3EA3B" />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={boardX + 16 + i * 32} y="66" width="22" height="40" rx="3" fill="#F1F5F9" stroke="#94A3B8" />
                <rect x={boardX + 22 + i * 32} y="74" width="10" height="14" rx="1.5" fill={i === 1 ? "#9BD373" : "#3F9C6A"} />
              </g>
            ))}
            <text x={boardX + 60} y="130" textAnchor="middle" fontSize="10" fontWeight="700" fill={muted} letterSpacing="1">
              DISJ · DR · DPS
            </text>
          </g>
          {node(boardX + 60, "Quadro de proteção", "Disjuntores, DR e DPS")}
          {wire(460, 690, `${distance} m · NBR 5410`)}
        </>
      ) : (
        wire(150, 690, `${distance} m · NBR 5410`)
      )}

      <WallboxRender x="690" y="10" width="120" height="160" power={power} />
      {node(750, "Carregador", `${power} · Tipo 2`)}

      {(emergency || socket) && (
        <g>
          <line x1="815" y1="92" x2="870" y2="92" stroke={muted} strokeWidth="1.5" strokeDasharray="4 4" />
          {emergency && (
            <g>
              <rect x="880" y="36" width="72" height="56" rx="8" fill="#FDE047" stroke="#CA8A04" />
              <circle cx="916" cy="64" r="17" fill="#DC2626" />
              <circle cx="916" cy="64" r="11" fill="#EF4444" />
              <text x="916" y="108" textAnchor="middle" fontSize="11" fontWeight="700" fill={ink}>
                Emergência
              </text>
            </g>
          )}
          {socket && (
            <g>
              <rect x="884" y={emergency ? 120 : 50} width="64" height="44" rx="8" fill="#2563EB" />
              <circle cx="916" cy={emergency ? 142 : 72} r="13" fill="#1E3A8A" />
              {[-6, 0, 6].map((dx) => (
                <circle key={dx} cx={916 + dx} cy={(emergency ? 142 : 72) + (dx === 0 ? -5 : 3)} r="2" fill="#93C5FD" />
              ))}
              <text x="916" y={emergency ? 182 : 112} textAnchor="middle" fontSize="11" fontWeight="700" fill={ink}>
                Tomada IEC 60309
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
