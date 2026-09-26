"use client";

import { useMemo, type ReactNode } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TECHS } from "@/lib/sim/storage";
import type { SimResult } from "@/lib/sim/types";
import { avg, bucketIndex, C, hhmm, Legend, n1, n2 } from "./common";

const AXIS = { fontSize: 11, fill: "#6d6985" };
const MAX_POINTS = 900;

interface Point {
  x: number;
  i: number;
  [k: string]: number;
}

/** Série reduzida (média por janela) — o gráfico mostra no máximo ~900 pontos. */
function useBuckets(r: SimResult) {
  return useMemo(() => {
    const s = r.series;
    const b = bucketIndex(s.t.length, MAX_POINTS);
    const rows: Point[] = b.map(([a, z]) => {
      const p: Point = {
        x: a,
        i: a,
        pvUsed: avg(s.pvUsed, a, z),
        curtailed: avg(s.curtailed, a, z),
        pvAvail: avg(s.pvAvail, a, z),
        load: avg(s.loadFixed, a, z) + avg(s.loadFlex, a, z),
        fixed: avg(s.loadFixed, a, z),
        flex: avg(s.loadFlex, a, z),
        import: avg(s.gridImport, a, z),
        export: -avg(s.gridExport, a, z),
        gen: avg(s.gen, a, z),
        unserved: avg(s.unserved, a, z),
        ghi: avg(s.ghi, a, z),
        poa: avg(s.poa, a, z),
        tAmb: avg(s.tAmb, a, z),
        tCell: avg(s.tCell, a, z),
        water: avg(s.waterTemp, a, z),
      };
      s.soc.forEach((arr, k) => (p[`soc${k}`] = avg(arr, a, z) * 100));
      s.storagePower.forEach((arr, k) => (p[`st${k}`] = avg(arr, a, z)));
      return p;
    });
    // faixas com eventos de rede (para sombrear)
    const bands: { a: number; z: number; kind: number }[] = [];
    let cur: { a: number; z: number; kind: number } | null = null;
    for (let i = 0; i < s.flags.length; i++) {
      const k = s.flags[i] & 7;
      if (k && cur && cur.kind === k) cur.z = i;
      else {
        if (cur) bands.push(cur);
        cur = k ? { a: i, z: i, kind: k } : null;
      }
    }
    if (cur) bands.push(cur);
    return { rows, bands, size: b[0] ? b[0][1] - b[0][0] : 1 };
  }, [r]);
}

function useTick(r: SimResult) {
  return (x: number) => {
    const s = r.series;
    const i = Math.max(0, Math.min(s.t.length - 1, Math.round(x)));
    const day = Math.floor(s.t[i] / 24);
    return r.scenario.sim.days <= 2 ? hhmm(s.hour[i]) : r.daily[day]?.label ?? "";
  };
}

function Frame({ title, sub, legend, children, height = 220 }: { title: string; sub?: ReactNode; legend?: ReactNode; children: ReactNode; height?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <div className="text-[14px] font-bold text-ink-900">{title}</div>
          {sub && <div className="text-[12px] text-ink-500">{sub}</div>}
        </div>
        {legend}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

interface TipRow {
  label: string;
  value: string;
  color: string;
}

function Tip({ active, rows, head }: { active?: boolean; rows: TipRow[]; head: string }) {
  if (!active) return null;
  return (
    <div className="min-w-[170px] rounded-xl bg-white px-3 py-2 text-[12px] shadow-lift ring-1 ring-ink-200">
      <div className="mb-1 font-bold text-ink-900">{head}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-ink-600">
            <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className="tnum font-semibold text-ink-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function headOf(r: SimResult, x: number) {
  const s = r.series;
  const i = Math.max(0, Math.min(s.t.length - 1, Math.round(x)));
  return `${r.daily[Math.floor(s.t[i] / 24)]?.label ?? ""} · ${hhmm(s.hour[i])}`;
}

type ChartProps = { r: SimResult; cursor: number; onCursor: (i: number) => void };

function commonAxes(r: SimResult, tick: (x: number) => string) {
  return [
    <CartesianGrid key="g" stroke="#f0eff5" vertical={false} />,
    <XAxis key="x" dataKey="x" type="number" domain={[0, r.series.t.length - 1]} tickFormatter={tick} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e3ee" }} minTickGap={40} />,
  ];
}

const handleClick = (onCursor: (i: number) => void) => (e: unknown) => {
  const x = (e as { activeLabel?: number | string } | null)?.activeLabel;
  if (x !== undefined && x !== null) onCursor(Number(x));
};

function Bands({ bands }: { bands: { a: number; z: number; kind: number }[] }) {
  return (
    <>
      {bands.map((b, k) => (
        <ReferenceArea key={k} x1={b.a} x2={b.z + 1} fill={b.kind & 4 ? "#e11d48" : b.kind & 2 ? "#f59e0b" : "#9a97ae"} fillOpacity={0.1} strokeOpacity={0} ifOverflow="hidden" />
      ))}
    </>
  );
}

/* --------------------------------------------------------- Energia solar */

export function SolarChart({ r, cursor, onCursor }: ChartProps) {
  const { rows, bands } = useBuckets(r);
  const tick = useTick(r);
  return (
    <Frame
      title="Geração solar: aproveitada × desperdiçada"
      sub="kW médios · faixas sombreadas = corte de injeção (cinza), GD desligada (âmbar), apagão (vermelho)"
      legend={
        <Legend
          items={[
            { color: C.pv, label: "Solar aproveitada" },
            { color: C.curtailed, label: "Solar cortada", hatch: true },
            { color: C.load, label: "Consumo", dashed: true },
          ]}
        />
      }
    >
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} onClick={handleClick(onCursor)}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={C.curtailed} fillOpacity={0.18} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={C.curtailed} strokeWidth="2.5" />
            </pattern>
          </defs>
          {commonAxes(r, tick)}
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => n1(v)} />
          <Bands bands={bands} />
          <Tooltip
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!p) return null;
              return (
                <Tip
                  active={active}
                  head={headOf(r, Number(label))}
                  rows={[
                    { label: "Solar disponível", value: `${n2(p.pvAvail)} kW`, color: C.pv },
                    { label: "Aproveitada", value: `${n2(p.pvUsed)} kW`, color: C.pv },
                    { label: "Cortada", value: `${n2(p.curtailed)} kW`, color: C.curtailed },
                    { label: "Consumo", value: `${n2(p.load)} kW`, color: C.load },
                  ]}
                />
              );
            }}
          />
          <Area type="monotone" dataKey="pvUsed" stackId="pv" stroke={C.pv} strokeWidth={1.5} fill={C.pv} fillOpacity={0.35} isAnimationActive={false} />
          <Area type="monotone" dataKey="curtailed" stackId="pv" stroke={C.curtailed} strokeWidth={1} fill="url(#hatch)" isAnimationActive={false} />
          <Line type="monotone" dataKey="load" stroke={C.load} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
          <ReferenceLine x={cursor} stroke="#1c1234" strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------ Balanço de fontes */

export function SupplyChart({ r, cursor, onCursor }: ChartProps) {
  const { rows, bands } = useBuckets(r);
  const tick = useTick(r);
  const hasSt = r.scenario.storage.length > 0;
  const hasGen = r.scenario.generator.enabled;
  const data = useMemo(
    () =>
      rows.map((p) => {
        const st = r.scenario.storage.reduce((a, _, k) => a + p[`st${k}`], 0);
        return { ...p, fromPv: Math.min(p.pvUsed, p.load), fromBat: Math.max(0, -st), toBat: -Math.max(0, st) } as Point;
      }),
    [rows, r],
  );
  return (
    <Frame
      title="De onde vem e para onde vai a energia"
      sub="Acima do zero: fontes que atendem as cargas. Abaixo: energia enviada para a rede e para o armazenamento."
      legend={
        <Legend
          items={[
            { color: C.pv, label: "Solar direto" },
            ...(hasSt ? [{ color: C.storage, label: "Armazenamento" }] : []),
            { color: C.import, label: "Rede (compra)" },
            ...(hasGen ? [{ color: C.gen, label: "Gerador" }] : []),
            { color: C.export, label: "Injeção" },
          ]}
        />
      }
      height={240}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} onClick={handleClick(onCursor)} stackOffset="sign">
          {commonAxes(r, tick)}
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => n1(v)} />
          <Bands bands={bands} />
          <ReferenceLine y={0} stroke="#cfccdc" />
          <Tooltip
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p) return null;
              return (
                <Tip
                  active={active}
                  head={headOf(r, Number(label))}
                  rows={[
                    { label: "Solar direto", value: `${n2(p.fromPv)} kW`, color: C.pv },
                    ...(hasSt ? [{ label: "Descarga", value: `${n2(p.fromBat)} kW`, color: C.storage }, { label: "Carga", value: `${n2(-p.toBat)} kW`, color: C.storage }] : []),
                    { label: "Compra da rede", value: `${n2(p.import)} kW`, color: C.import },
                    ...(hasGen ? [{ label: "Gerador", value: `${n2(p.gen)} kW`, color: C.gen }] : []),
                    { label: "Injeção", value: `${n2(-p.export)} kW`, color: C.export },
                    ...(p.unserved > 0.001 ? [{ label: "Não atendido", value: `${n2(p.unserved)} kW`, color: "#e11d48" }] : []),
                  ]}
                />
              );
            }}
          />
          <Area type="stepAfter" dataKey="fromPv" stackId="s" stroke="none" fill={C.pv} fillOpacity={0.8} isAnimationActive={false} />
          {hasSt && <Area type="stepAfter" dataKey="fromBat" stackId="s" stroke="none" fill={C.storage} fillOpacity={0.85} isAnimationActive={false} />}
          {hasGen && <Area type="stepAfter" dataKey="gen" stackId="s" stroke="none" fill={C.gen} fillOpacity={0.85} isAnimationActive={false} />}
          <Area type="stepAfter" dataKey="import" stackId="s" stroke="none" fill={C.import} fillOpacity={0.8} isAnimationActive={false} />
          {hasSt && <Area type="stepAfter" dataKey="toBat" stackId="s" stroke="none" fill={C.storage} fillOpacity={0.45} isAnimationActive={false} />}
          <Area type="stepAfter" dataKey="export" stackId="s" stroke="none" fill={C.export} fillOpacity={0.7} isAnimationActive={false} />
          <ReferenceLine x={cursor} stroke="#1c1234" strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ---------------------------------------------------------------- SOC */

export function SocChart({ r, cursor, onCursor }: ChartProps) {
  const { rows, bands } = useBuckets(r);
  const tick = useTick(r);
  const units = r.scenario.storage;
  const hasWater = rows.some((p) => Number.isFinite(p.water));
  if (!units.length && !hasWater) return null;
  return (
    <>
      {!!units.length && (
        <Frame
          title="Estado de carga do armazenamento"
          sub="% da capacidade · linha tracejada = SOC mínimo"
          legend={<Legend items={units.map((u) => ({ color: TECHS[u.tech].color, label: u.name }))} />}
          height={180}
        >
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} onClick={handleClick(onCursor)}>
              {commonAxes(r, tick)}
              <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v}%`} />
              <Bands bands={bands} />
              <Tooltip
                content={({ active, payload, label }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!p) return null;
                  return <Tip active={active} head={headOf(r, Number(label))} rows={units.map((u, k) => ({ label: u.name, value: `${n1(p[`soc${k}`])}%`, color: TECHS[u.tech].color }))} />;
                }}
              />
              {units.map((u, k) => (
                <Line key={u.id} type="monotone" dataKey={`soc${k}`} stroke={TECHS[u.tech].color} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
              {units.map((u) => (
                <ReferenceLine key={`m${u.id}`} y={u.socMin * 100} stroke={TECHS[u.tech].color} strokeDasharray="4 4" strokeOpacity={0.7} />
              ))}
              <ReferenceLine x={cursor} stroke="#1c1234" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </Frame>
      )}
      {hasWater && (
        <Frame title="Temperatura da água no boiler (bateria térmica)" sub="°C no tanque" legend={<Legend items={[{ color: C.flex, label: "Água do boiler" }]} />} height={160}>
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} onClick={handleClick(onCursor)}>
              {commonAxes(r, tick)}
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v}°`} domain={["dataMin - 3", "dataMax + 3"]} />
              <Tooltip
                content={({ active, payload, label }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!p) return null;
                  return <Tip active={active} head={headOf(r, Number(label))} rows={[{ label: "Boiler", value: `${n1(p.water)} °C`, color: C.flex }]} />;
                }}
              />
              <Line type="monotone" dataKey="water" stroke={C.flex} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceLine x={cursor} stroke="#1c1234" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </Frame>
      )}
    </>
  );
}

/* ------------------------------------------------------------- Recurso */

export function WeatherChart({ r, cursor, onCursor }: ChartProps) {
  const { rows } = useBuckets(r);
  const tick = useTick(r);
  return (
    <Frame
      title="Recurso solar"
      sub="W/m² · irradiância global horizontal e no plano dos módulos"
      legend={
        <Legend
          items={[
            { color: C.pv, label: "No plano (POA)" },
            { color: C.curtailed, label: "Horizontal (GHI)", dashed: true },
          ]}
        />
      }
      height={170}
    >
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} onClick={handleClick(onCursor)}>
          {commonAxes(r, tick)}
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!p) return null;
              return (
                <Tip
                  active={active}
                  head={headOf(r, Number(label))}
                  rows={[
                    { label: "POA", value: `${Math.round(p.poa)} W/m²`, color: C.pv },
                    { label: "GHI", value: `${Math.round(p.ghi)} W/m²`, color: C.curtailed },
                    { label: "Ar", value: `${n1(p.tAmb)} °C`, color: "#cfccdc" },
                    { label: "Célula", value: `${n1(p.tCell)} °C`, color: "#cfccdc" },
                  ]}
                />
              );
            }}
          />
          <Area type="monotone" dataKey="poa" stroke={C.pv} strokeWidth={2} fill={C.pv} fillOpacity={0.12} isAnimationActive={false} />
          <Line type="monotone" dataKey="ghi" stroke={C.curtailed} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          <ReferenceLine x={cursor} stroke="#1c1234" strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ---------------------------------------------------------- Diário */

export function DailyChart({ r }: { r: SimResult }) {
  const data = r.daily;
  if (data.length < 3) return null;
  return (
    <Frame
      title="Energia por dia"
      sub="kWh/dia · solar aproveitada + cortada = disponível"
      legend={
        <Legend
          items={[
            { color: C.pv, label: "Aproveitada" },
            { color: C.curtailed, label: "Cortada", hatch: true },
            { color: C.load, label: "Consumo", dashed: true },
          ]}
        />
      }
      height={200}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barCategoryGap={data.length > 60 ? 0 : 2}>
          <defs>
            <pattern id="hatch-d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={C.curtailed} fillOpacity={0.18} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={C.curtailed} strokeWidth="2.5" />
            </pattern>
          </defs>
          <CartesianGrid stroke="#f0eff5" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e3ee" }} minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: "#f0eff5" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p) return null;
              return (
                <Tip
                  active={active}
                  head={p.label}
                  rows={[
                    { label: "Aproveitada", value: `${n1(p.pvUsed)} kWh`, color: C.pv },
                    { label: "Cortada", value: `${n1(p.curtailed)} kWh`, color: C.curtailed },
                    { label: "Consumo", value: `${n1(p.load)} kWh`, color: C.load },
                    { label: "Compra", value: `${n1(p.import)} kWh`, color: C.import },
                    { label: "Injeção", value: `${n1(p.export)} kWh`, color: C.export },
                    ...(p.events > 0 ? [{ label: "Horas com evento", value: `${n1(p.events)} h`, color: "#e11d48" }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="pvUsed" stackId="d" fill={C.pv} isAnimationActive={false} />
          <Bar dataKey="curtailed" stackId="d" fill="url(#hatch-d)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line type="monotone" dataKey="load" stroke={C.load} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}
