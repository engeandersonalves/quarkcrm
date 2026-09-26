"use client";

import { Dices, Download, Play } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui";
import { simulate } from "@/lib/sim/engine";
import { linspace, METRICS, metricValue, stats, SWEEP_PARAMS, type Metric } from "@/lib/sim/study";
import type { Scenario, SimKPIs } from "@/lib/sim/types";
import { C, Legend, n1, n2, Num, Pick } from "./common";
import { download, slug } from "./results";

const AXIS = { fontSize: 11, fill: "#6d6985" };
const tick = () => new Promise((r) => setTimeout(r, 0));

export function Studies({ s }: { s: Scenario }) {
  return (
    <div className="flex flex-col gap-4">
      <Sweep s={s} />
      <MonteCarlo s={s} />
    </div>
  );
}

function Sweep({ s }: { s: Scenario }) {
  const [pid, setPid] = useState("storage");
  const p = SWEEP_PARAMS.find((x) => x.id === pid)!;
  const [from, setFrom] = useState(p.min);
  const [to, setTo] = useState(p.max);
  const [steps, setSteps] = useState(11);
  const [metric, setMetric] = useState<Metric["id"]>("curtailedPct");
  const [metric2, setMetric2] = useState<Metric["id"]>("selfSufficiency");
  const [rows, setRows] = useState<{ x: number; kpis: SimKPIs }[]>([]);
  const [busy, setBusy] = useState(0);

  const run = async () => {
    const xs = linspace(from, to, Math.max(2, Math.min(60, Math.round(steps))));
    const out: { x: number; kpis: SimKPIs }[] = [];
    for (let k = 0; k < xs.length; k++) {
      setBusy((k + 1) / xs.length);
      await tick();
      out.push({ x: xs[k], kpis: simulate(p.apply(s, xs[k])).kpis });
    }
    setRows(out);
    setBusy(0);
  };

  const m1 = METRICS.find((x) => x.id === metric)!;
  const m2 = METRICS.find((x) => x.id === metric2)!;
  const val = (k: SimKPIs, m: Metric) => metricValue(k, m.id) * (m.pct ? 100 : 1);
  const data = rows.map((r) => ({ x: r.x, a: val(r.kpis, m1), b: val(r.kpis, m2) }));

  const csv = () => {
    const head = [`${p.label} (${p.unit})`, ...METRICS.map((m) => `${m.label} (${m.unit})`)];
    const lines = [head.join(";"), ...rows.map((r) => [r.x, ...METRICS.map((m) => val(r.kpis, m))].map((v) => String(Math.round(v * 1000) / 1000).replace(".", ",")).join(";"))];
    download(`varredura-${p.id}-${slug(s.name)}.csv`, "﻿" + lines.join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70">
      <div className="text-[15px] font-bold text-ink-900">Varredura paramétrica (análise de sensibilidade)</div>
      <p className="mb-3 text-[12.5px] text-ink-500">Roda o cenário atual várias vezes variando um parâmetro. Ex.: quantos kWh de bateria zeram o desperdício sob corte de GD?</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Pick
          label="Parâmetro"
          value={pid}
          onChange={(v) => {
            const np = SWEEP_PARAMS.find((x) => x.id === v)!;
            setPid(v);
            setFrom(np.min);
            setTo(np.max);
          }}
          options={SWEEP_PARAMS.map((x) => ({ value: x.id, label: x.label }))}
          className="col-span-2"
        />
        <Num label="De" unit={p.unit} value={from} onChange={setFrom} />
        <Num label="Até" unit={p.unit} value={to} onChange={setTo} />
        <Num label="Pontos" digits={0} value={steps} onChange={setSteps} />
        <Pick label="Indicador A" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.id, label: x.label }))} />
        <Pick label="Indicador B" value={metric2} onChange={setMetric2} options={METRICS.map((x) => ({ value: x.id, label: x.label }))} />
        <div className="flex items-end gap-2">
          <Button size="md" onClick={run} loading={busy > 0} className="h-9">
            <Play className="h-3.5 w-3.5" /> {busy > 0 ? `${Math.round(busy * 100)}%` : "Rodar"}
          </Button>
          {!!rows.length && (
            <Button size="icon" variant="secondary" onClick={csv} aria-label="Baixar CSV" className="h-9 w-9">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!!rows.length && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            { m: m1, key: "a", color: C.import },
            { m: m2, key: "b", color: C.storage },
          ].map(({ m, key, color }) => (
            <div key={key}>
              <div className="mb-1 flex items-baseline justify-between">
                <div className="text-[13px] font-bold text-ink-800">{m.label}</div>
                <Legend items={[{ color, label: `${m.unit} × ${p.unit}` }]} />
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer>
                  <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                    <CartesianGrid stroke="#f0eff5" vertical={false} />
                    <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} tickFormatter={(v) => n1(v)} axisLine={{ stroke: "#e5e3ee" }} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => n1(v)} />
                    <Tooltip formatter={(v) => [`${n2(Number(v))} ${m.unit}`, m.label]} labelFormatter={(x) => `${p.label}: ${n2(Number(x))} ${p.unit}`} />
                    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 4, fill: color, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MonteCarlo({ s }: { s: Scenario }) {
  const [runs, setRuns] = useState(40);
  const [metric, setMetric] = useState<Metric["id"]>("selfSufficiency");
  const [res, setRes] = useState<SimKPIs[]>([]);
  const [busy, setBusy] = useState(0);
  const m = METRICS.find((x) => x.id === metric)!;

  const run = async () => {
    const n = Math.max(5, Math.min(500, Math.round(runs)));
    const out: SimKPIs[] = [];
    for (let r = 0; r < n; r++) {
      if (r % 2 === 0) {
        setBusy((r + 1) / n);
        await tick();
      }
      out.push(simulate({ ...s, sim: { ...s.sim, seed: s.sim.seed + 1000 + r * 7919 } }).kpis);
    }
    setRes(out);
    setBusy(0);
  };

  const vals = res.map((k) => metricValue(k, m.id) * (m.pct ? 100 : 1));
  const st = stats(vals);
  const bins = 14;
  const span = st.max - st.min || 1;
  const hist = Array.from({ length: bins }, (_, b) => ({ x: st.min + (span * (b + 0.5)) / bins, n: 0 }));
  for (const v of vals) hist[Math.min(bins - 1, Math.floor(((v - st.min) / span) * bins))].n++;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70">
      <div className="text-[15px] font-bold text-ink-900">Monte Carlo do clima</div>
      <p className="mb-3 text-[12.5px] text-ink-500">
        O mesmo sistema sob N sequências diferentes de dias limpos e nublados. Mostra a incerteza do resultado (P10/P50/P90) — essencial para um trabalho científico.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Num label="Rodadas" digits={0} value={runs} onChange={setRuns} />
        <Pick label="Indicador" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.id, label: x.label }))} className="col-span-2" />
        <div className="flex items-end">
          <Button onClick={run} loading={busy > 0} className="h-9">
            <Dices className="h-3.5 w-3.5" /> {busy > 0 ? `${Math.round(busy * 100)}%` : "Rodar"}
          </Button>
        </div>
      </div>
      {!!res.length && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="h-[200px]">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 8, right: 8, bottom: 4, left: -16 }} barCategoryGap={2}>
                <CartesianGrid stroke="#f0eff5" vertical={false} />
                <XAxis dataKey="x" tick={AXIS} tickLine={false} tickFormatter={(v) => n1(v)} axisLine={{ stroke: "#e5e3ee" }} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: "#f7f6fa" }} formatter={(v) => [`${v} rodadas`, "Frequência"]} labelFormatter={(x) => `≈ ${n2(Number(x))} ${m.unit}`} />
                <Bar dataKey="n" fill={C.import} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="tnum h-fit text-[12.5px]">
            <tbody>
              {(
                [
                  ["Média", st.mean],
                  ["Desvio-padrão", st.sd],
                  ["P10 (pessimista)", st.p10],
                  ["P50 (mediana)", st.p50],
                  ["P90 (otimista)", st.p90],
                  ["Mínimo", st.min],
                  ["Máximo", st.max],
                ] as const
              ).map(([k, v]) => (
                <tr key={k} className="border-b border-ink-50">
                  <td className="py-1 pr-3 text-ink-500">{k}</td>
                  <td className="py-1 text-right font-semibold text-ink-900">
                    {n2(v)} <span className="font-normal text-ink-400">{m.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
