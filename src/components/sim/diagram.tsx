"use client";

import { BatteryCharging, Flame, Fuel, Home, Sun, Trash2, UtilityPole, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TECHS } from "@/lib/sim/storage";
import type { SimResult } from "@/lib/sim/types";
import { C, hhmm, n0, n1, n2 } from "./common";

/**
 * Diagrama unifilar simplificado com fluxos animados — como um "scope" do Simulink,
 * mas mostrando para onde vai cada kW no instante selecionado.
 */
export function FlowDiagram({ r, i }: { r: SimResult; i: number }) {
  const s = r.series;
  const sc = r.scenario;
  const idx = Math.max(0, Math.min(s.t.length - 1, i));
  const pvUsed = s.pvUsed[idx];
  const curt = s.curtailed[idx];
  const imp = s.gridImport[idx];
  const exp = s.gridExport[idx];
  const gen = s.gen[idx];
  const fixed = s.loadFixed[idx];
  const flex = s.loadFlex[idx];
  const unserved = s.unserved[idx];
  const stNet = s.storagePower.reduce((a, p) => a + p[idx], 0);
  const flags = s.flags[idx];
  const outage = (flags & 4) !== 0 || sc.grid.mode === "off-grid";
  const curtail = (flags & 1) !== 0;
  const trip = (flags & 2) !== 0;
  const maxP = Math.max(1, sc.pv.kWp, sc.inverter.acKW);
  const water = s.waterTemp[idx];
  const hasFlex = sc.loads.some((l) => l.enabled && ["pump", "ev", "waterheater", "deferrable"].includes(l.kind)) || sc.loads.some((l) => l.enabled && l.kind === "motor" && l.solarOnly);

  const socs = sc.storage.map((u, k) => ({ u, soc: s.soc[k][idx], p: s.storagePower[k][idx] }));

  return (
    <div className="relative">
      <svg viewBox="0 0 800 430" className="h-auto w-full" role="img" aria-label="Diagrama de fluxo de energia">
        <style>{`
          @keyframes flow { to { stroke-dashoffset: -24; } }
          .flow { stroke-dasharray: 8 16; animation: flow linear infinite; }
          .flow.rev { animation-direction: reverse; }
        `}</style>
        <defs>
          <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#e5e3ee" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="800" height="430" fill="url(#grid-dots)" />

        {/* barramento AC */}
        <rect x="370" y="150" width="60" height="120" rx="12" fill="#1c1234" />
        <text x="400" y="205" textAnchor="middle" className="fill-white text-[11px] font-bold">
          Barra
        </text>
        <text x="400" y="220" textAnchor="middle" className="fill-white/70 text-[10px]">
          AC
        </text>

        <Link d="M190 110 C 290 110, 300 175, 370 175" p={pvUsed} max={maxP} color={C.pv} label={`${n2(pvUsed)} kW`} lx={290} ly={128} />
        <Link d="M110 70 L 110 40 L 330 40" p={curt} max={maxP} color={C.curtailed} label={curt > 0.005 ? `${n2(curt)} kW cortados` : ""} lx={230} ly={32} />
        {!!sc.storage.length && <Link d="M190 330 C 290 330, 300 250, 370 250" p={-stNet} max={maxP} color={C.storage} label={`${n2(Math.abs(stNet))} kW`} lx={285} ly={318} />}
        {sc.generator.enabled && <Link d="M190 215 L 370 215" p={gen} max={maxP} color={C.gen} label={gen > 0 ? `${n2(gen)} kW` : ""} lx={280} ly={207} />}
        <Link d="M430 175 C 500 175, 510 110, 610 110" p={exp - imp} max={maxP} color={exp > imp ? C.export : C.import} label={`${n2(Math.abs(exp - imp))} kW`} lx={515} ly={128} />
        <Link d="M430 250 C 500 250, 510 330, 610 330" p={Math.max(0, fixed - unserved)} max={maxP} color={C.load} label={`${n2(Math.max(0, fixed - unserved))} kW`} lx={515} ly={318} />
        {hasFlex && <Link d="M400 270 L 400 350" p={flex} max={maxP} color={C.flex} label={`${n2(flex)} kW`} lx={440} ly={318} />}

        {/* nós */}
        <Node x={30} y={75} w={160} icon={Sun} color={C.pv} title="Solar FV" value={`${n2(s.pvAvail[idx])} kW`} sub={`${n0(s.poa[idx])} W/m² · célula ${n0(s.tCell[idx])} °C`} />
        <Node x={340} y={20} w={120} h={42} icon={Trash2} color={C.curtailed} title="Desperdício" value={curt > 0.005 ? `${n2(curt)} kW` : "0"} compact />
        <Node
          x={610}
          y={75}
          w={160}
          icon={UtilityPole}
          color={outage ? "#e11d48" : exp > imp ? C.export : C.import}
          title={sc.grid.mode === "off-grid" ? "Sem rede" : exp > 0.005 ? "Rede · injetando" : imp > 0.005 ? "Rede · comprando" : "Rede"}
          value={sc.grid.mode === "off-grid" ? "isolado" : outage ? "APAGÃO" : exp > 0.005 ? `↑ ${n2(exp)} kW` : imp > 0.005 ? `↓ ${n2(imp)} kW` : "0 kW"}
          sub={sc.grid.mode === "off-grid" ? "sistema isolado" : trip ? "GD desligada pelo operador" : curtail ? "Corte de injeção ativo" : `R$ ${n2(s.price[idx])}/kWh`}
          alert={(outage && sc.grid.mode !== "off-grid") || trip || curtail}
        />
        <Node
          x={610}
          y={295}
          w={160}
          icon={Home}
          color={C.load}
          title="Casa / cargas fixas"
          value={`${n2(fixed)} kW`}
          sub={unserved > 0.005 ? `FALTA ${n2(unserved)} kW` : `${n1(s.tAmb[idx])} °C lá fora`}
          alert={unserved > 0.005}
        />
        {hasFlex && (
          <Node
            x={320}
            y={350}
            w={160}
            icon={Flame}
            color={C.flex}
            title="Cargas flexíveis"
            value={`${n2(flex)} kW`}
            sub={Number.isFinite(water) ? `boiler ${n0(water)} °C` : "bomba · carro · máquinas"}
          />
        )}
        {sc.generator.enabled && <Node x={30} y={185} w={160} icon={Fuel} color={C.gen} title="Gerador" value={gen > 0 ? `${n2(gen)} kW` : "desligado"} />}
        {!!sc.storage.length && (
          <g>
            <rect x={30} y={280} width={160} height={40 + socs.length * 26} rx={14} fill="white" stroke="#e5e3ee" />
            <BatteryCharging x={42} y={290} width={20} height={20} color={C.storage} />
            <text x={68} y={304} className="fill-ink-900 text-[12px] font-bold">
              Armazenamento
            </text>
            {socs.map(({ u, soc, p }, k) => (
              <g key={u.id} transform={`translate(42 ${318 + k * 26})`}>
                <text x={0} y={0} className="fill-ink-600 text-[10px] font-semibold">
                  {TECHS[u.tech].short} {n0(soc * 100)}% {p > 0.01 ? "▲" : p < -0.01 ? "▼" : ""}
                </text>
                <rect x={0} y={4} width={136} height={7} rx={3.5} fill="#f0eff5" />
                <rect x={0} y={4} width={Math.max(0, Math.min(1, soc)) * 136} height={7} rx={3.5} fill={TECHS[u.tech].color} />
                <line x1={u.socMin * 136} x2={u.socMin * 136} y1={2} y2={13} stroke="#1c1234" strokeWidth={1} strokeDasharray="2 2" />
              </g>
            ))}
          </g>
        )}

        <g transform="translate(20 418)">
          <Zap x={0} y={-11} width={13} height={13} color="#6d6985" />
          <text x={18} y={0} className="fill-ink-500 text-[11px] font-semibold">
            {r.daily[Math.floor(s.t[idx] / 24)]?.label} · {hhmm(s.hour[idx])}
          </text>
        </g>
      </svg>
    </div>
  );
}

function Link({ d, p, max, color, label, lx, ly }: { d: string; p: number; max: number; color: string; label: string; lx: number; ly: number }) {
  const a = Math.abs(p);
  const on = a > 0.005;
  const w = on ? 2 + Math.min(1, a / max) * 8 : 1.5;
  const dur = on ? Math.max(0.35, 2.4 - (a / max) * 2) : 0;
  return (
    <g>
      <path d={d} fill="none" stroke="#e5e3ee" strokeWidth={Math.max(w, 3)} strokeLinecap="round" />
      {on && <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" className={`flow${p < 0 ? " rev" : ""}`} style={{ animationDuration: `${dur}s` }} />}
      {on && label && (
        <text x={lx} y={ly} textAnchor="middle" className="fill-ink-700 text-[11px] font-bold" style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 4 }}>
          {label}
        </text>
      )}
    </g>
  );
}

function Node({
  x,
  y,
  w,
  h = 70,
  icon: Icon,
  color,
  title,
  value,
  sub,
  alert,
  compact,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  icon: LucideIcon;
  color: string;
  title: string;
  value: string;
  sub?: string;
  alert?: boolean;
  compact?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} fill="white" stroke={alert ? "#e11d48" : "#e5e3ee"} strokeWidth={alert ? 2 : 1} />
      <rect x={x + 10} y={y + (compact ? 9 : 12)} width={24} height={24} rx={7} fill={color} opacity={0.14} />
      <Icon x={x + 14} y={y + (compact ? 13 : 16)} width={16} height={16} color={color} />
      {compact ? (
        <text x={x + 42} y={y + 26} className="fill-ink-700 text-[11px] font-bold">
          {value === "0" ? title : value}
        </text>
      ) : (
        <>
          <text x={x + 42} y={y + 24} className="fill-ink-500 text-[11px] font-semibold">
            {title}
          </text>
          <text x={x + 42} y={y + 42} className="fill-ink-900 text-[14px] font-bold">
            {value}
          </text>
          {sub && (
            <text x={x + 12} y={y + 60} className={alert ? "fill-rose-600 text-[10px] font-bold" : "fill-ink-400 text-[10px]"}>
              {sub}
            </text>
          )}
        </>
      )}
    </g>
  );
}
