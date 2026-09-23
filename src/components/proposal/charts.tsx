"use client";

import { useState } from "react";
import { brl, fmtNum } from "@/lib/pricing";

/** Geração mensal (barras) × consumo (linha tracejada). Um único eixo em kWh. */
export function GenerationChart({ data }: { data: { month: string; generation: number; consumption: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const pad = { l: 44, r: 8, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => Math.max(d.generation, d.consumption))) * 1.12;
  const step = niceStep(max / 4);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const bw = iw / data.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const hasConsumption = data.some((d) => d.consumption > 0);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#1F5A8C]" /> Geração estimada
        </span>
        {hasConsumption && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-[#B8862B]" /> Seu consumo
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Geração mensal estimada em kWh">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t ? "0" : undefined} strokeWidth={t ? 1 : 1.5} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-400 text-[11px]">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.2;
          const w = bw * 0.6;
          const h = Math.max(0, pad.t + ih - y(d.generation));
          const r = Math.min(4, w / 2, h);
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
              <path
                d={`M${x},${pad.t + ih} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                fill="#1F5A8C"
                opacity={hover === null || hover === i ? 1 : 0.45}
                className="transition-opacity"
              />
              <text x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[11px]">
                {d.month}
              </text>
            </g>
          );
        })}
        {hasConsumption && (
          <polyline
            points={data.map((d, i) => `${pad.l + i * bw + bw / 2},${y(d.consumption)}`).join(" ")}
            fill="none"
            stroke="#B8862B"
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-xl bg-ink-950 px-3 py-2 text-xs text-white shadow-lift"
          style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%` }}
        >
          <p className="font-semibold">{data[hover].month}</p>
          <p className="tnum text-ink-300">Geração: {fmtNum(data[hover].generation)} kWh</p>
          {hasConsumption && <p className="tnum text-ink-300">Consumo: {fmtNum(data[hover].consumption)} kWh</p>}
        </div>
      )}
    </div>
  );
}

/** Saldo acumulado ano a ano (investimento negativo → retorno positivo). */
export function CashflowChart({ data, payback }: { data: { year: number; cumulative: number }[]; payback: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const pad = { l: 64, r: 8, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(0, ...data.map((d) => d.cumulative));
  const min = Math.min(0, ...data.map((d) => d.cumulative));
  const span = Math.max(1, max - min) * 1.08;
  const step = niceStep(span / 4);
  const top = Math.ceil((max * 1.04) / step) * step;
  // Parte negativa (investimento) mostrada na proporção real, sem espaço vazio.
  const bottom = min < 0 ? Math.min(min * 1.15, -step * 0.25) : 0;
  const range = Math.max(1, top - bottom);
  const y = (v: number) => pad.t + ((top - v) / range) * ih;
  const ticks: number[] = [];
  for (let t = Math.ceil(bottom / step) * step; t <= top + 1; t += step) ticks.push(t);
  const bw = iw / data.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Retorno acumulado em 25 anos">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-400 text-[11px]">
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const y0 = y(0);
          const y1 = y(d.cumulative);
          const pos = d.cumulative >= 0;
          const h = Math.abs(y1 - y0);
          const r = Math.min(3, w / 2, h);
          const path = pos
            ? `M${x},${y0} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`
            : `M${x},${y0} v${h - r} q0,${r} ${r},${r} h${w - 2 * r} q${r},0 ${r},${-r} v${-(h - r)} z`;
          return (
            <g key={d.year} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
              <path d={path} fill={pos ? "#059669" : "#94a3b8"} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-opacity" />
              {(d.year === 1 || d.year % 5 === 0) && (
                <text x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[11px]">
                  {d.year === 1 ? "Ano 1" : d.year}
                </text>
              )}
            </g>
          );
        })}
        {payback > 0 && payback <= 25 && (
          <g pointerEvents="none">
            <line x1={pad.l + payback * bw} x2={pad.l + payback * bw} y1={pad.t} y2={pad.t + ih} stroke="#0c1220" strokeDasharray="3 4" />
            <text x={pad.l + payback * bw + 6} y={pad.t + 12} className="fill-ink-800 text-[11px] font-semibold">
              Investimento pago
            </text>
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-xl bg-ink-950 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lift"
          style={{ left: `${Math.min(88, Math.max(12, ((pad.l + hover * bw + bw / 2) / W) * 100))}%` }}
        >
          <p className="font-semibold">Ano {data[hover].year}</p>
          <p className="tnum text-ink-300">Saldo acumulado: {brl(data[hover].cumulative, 0)}</p>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function compact(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${fmtNum(abs / 1_000_000, 1)} mi`;
  if (abs >= 1000) return `${sign}R$ ${fmtNum(abs / 1000)} mil`;
  return `${sign}R$ ${fmtNum(abs)}`;
}
