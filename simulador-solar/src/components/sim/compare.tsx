"use client";

import { Layers, Pin, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui";
import { simulate } from "@/lib/sim/engine";
import { METRICS, metricValue, type Metric } from "@/lib/sim/study";
import type { Scenario, SimKPIs } from "@/lib/sim/types";
import { C, n1, n2, Pick } from "./common";
import { STRATEGIES } from "./editor";

export interface Snapshot {
  id: string;
  name: string;
  scenario: Scenario;
  kpis: SimKPIs;
}

const fmt = (m: Metric, v: number) => (m.pct ? `${n1(v * 100)}%` : Math.abs(v) >= 100 ? Math.round(v).toLocaleString("pt-BR") : n2(v));

export function Compare({
  current,
  currentKpis,
  snaps,
  setSnaps,
  onLoad,
}: {
  current: Scenario;
  currentKpis: SimKPIs;
  snaps: Snapshot[];
  setSnaps: (fn: (s: Snapshot[]) => Snapshot[]) => void;
  onLoad: (s: Scenario) => void;
}) {
  const [metric, setMetric] = useState<Metric["id"]>("curtailedPct");
  const m = METRICS.find((x) => x.id === metric)!;
  const all = [...snaps, { id: "atual", name: `${current.name} (atual)`, scenario: current, kpis: currentKpis }];

  const pin = () => setSnaps((s) => [...s, { id: `${Date.now()}`, name: current.name, scenario: JSON.parse(JSON.stringify(current)), kpis: currentKpis }]);

  const variants = (kind: "estrategias" | "armazenamento" | "rede") => {
    const make = (name: string, sc: Scenario): Snapshot => ({ id: `${Date.now()}-${name}`, name, scenario: sc, kpis: simulate(sc).kpis });
    const base = JSON.parse(JSON.stringify(current)) as Scenario;
    let out: Snapshot[] = [];
    if (kind === "estrategias") out = STRATEGIES.map((st) => make(st.label, { ...base, control: { ...base.control, strategy: st.value } }));
    if (kind === "armazenamento")
      out = [
        make("Sem armazenamento", { ...base, storage: [] }),
        make("Sem cargas flexíveis", { ...base, loads: base.loads.filter((l) => l.kind === "profile" || l.kind === "appliance" || (l.kind === "motor" && !l.solarOnly)) }),
        make("Com tudo (atual)", base),
      ];
    if (kind === "rede")
      out = (["on-grid", "zero-grid", "export-limit", "off-grid"] as const).map((mode) =>
        make({ "on-grid": "On-grid", "zero-grid": "Zero grid", "export-limit": "Limite de injeção", "off-grid": "Off-grid" }[mode], { ...base, grid: { ...base.grid, mode } }),
      );
    setSnaps(() => out);
  };

  const data = all.map((s) => ({ name: s.name, v: metricValue(s.kpis, m.id) * (m.pct ? 100 : 1), current: s.id === "atual" }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={pin}>
          <Pin className="h-3.5 w-3.5" /> Fixar cenário atual
        </Button>
        <Button size="sm" variant="secondary" onClick={() => variants("estrategias")}>
          <Wand2 className="h-3.5 w-3.5" /> Comparar estratégias de controle
        </Button>
        <Button size="sm" variant="secondary" onClick={() => variants("armazenamento")}>
          <Layers className="h-3.5 w-3.5" /> Com × sem armazenamento
        </Button>
        <Button size="sm" variant="secondary" onClick={() => variants("rede")}>
          <Layers className="h-3.5 w-3.5" /> Modos de conexão
        </Button>
        {!!snaps.length && (
          <Button size="sm" variant="ghost" onClick={() => setSnaps(() => [])}>
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[14px] font-bold text-ink-900">{m.label}</div>
            <div className="text-[12px] text-ink-500">{m.unit} · barra escura = cenário atual</div>
          </div>
          <Pick label="Indicador" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.id, label: x.label }))} className="w-64" />
        </div>
        <div style={{ height: Math.max(140, data.length * 38) }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={6}>
              <CartesianGrid stroke="#f0eff5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6d6985" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 12, fill: "#3b3160" }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "#f7f6fa" }} formatter={(v) => [`${n2(Number(v))} ${m.unit}`, m.label]} />
              <Bar dataKey="v" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.current ? C.load : C.import} />
                ))}
                <LabelList dataKey="v" position="right" formatter={(v: unknown) => n1(Number(v))} style={{ fontSize: 11, fill: "#3b3160", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-ink-100 text-[11px] font-semibold text-ink-500">
              <th className="sticky left-0 bg-white px-4 py-2 text-left">Indicador</th>
              {all.map((s) => (
                <th key={s.id} className="max-w-[160px] px-3 py-2 text-right align-bottom">
                  <div className="line-clamp-2">{s.name}</div>
                  {s.id !== "atual" && (
                    <div className="mt-1 flex justify-end gap-2 font-normal">
                      <button type="button" className="text-sun-700 hover:underline" onClick={() => onLoad(JSON.parse(JSON.stringify(s.scenario)))}>
                        abrir
                      </button>
                      <button type="button" className="text-rose-600 hover:underline" onClick={() => setSnaps((x) => x.filter((y) => y.id !== s.id))}>
                        remover
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tnum">
            {METRICS.map((mm) => {
              const vals = all.map((s) => metricValue(s.kpis, mm.id));
              return (
                <tr key={mm.id} className={mm.id === metric ? "bg-sun-50/60" : "border-t border-ink-50"}>
                  <td className="sticky left-0 bg-inherit px-4 py-1.5 font-medium text-ink-700">
                    {mm.label} <span className="text-ink-400">({mm.unit})</span>
                  </td>
                  {vals.map((v, k) => (
                    <td key={k} className="px-3 py-1.5 text-right">
                      {fmt(mm, v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
