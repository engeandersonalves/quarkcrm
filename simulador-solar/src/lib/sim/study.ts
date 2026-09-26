/** Estudos automáticos: varredura paramétrica e Monte Carlo sobre o clima. */
import { simulate } from "./engine.ts";
import { makeStorage } from "./storage.ts";
import type { Scenario, SimKPIs } from "./types.ts";

export interface SweepParam {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  apply: (s: Scenario, v: number) => Scenario;
}

const clone = (s: Scenario): Scenario => JSON.parse(JSON.stringify(s));

export const SWEEP_PARAMS: SweepParam[] = [
  {
    id: "storage", label: "Capacidade de armazenamento", unit: "kWh", min: 0, max: 30,
    apply: (s, v) => {
      const c = clone(s);
      if (!c.storage.length) {
        if (v > 0) c.storage = [makeStorage("lfp", v)];
        return c;
      }
      const first = c.storage[0];
      const r = v / Math.max(first.capacityKWh, 1e-9);
      if (v <= 0) c.storage = c.storage.slice(1);
      else c.storage[0] = { ...first, capacityKWh: v, chargeKW: first.chargeKW * r, dischargeKW: first.dischargeKW * r, capex: first.capex * r };
      return c;
    },
  },
  { id: "kwp", label: "Potência FV", unit: "kWp", min: 1, max: 20, apply: (s, v) => ({ ...clone(s), pv: { ...s.pv, kWp: v } }) },
  { id: "inverter", label: "Potência do inversor", unit: "kW", min: 1, max: 15, apply: (s, v) => ({ ...clone(s), inverter: { ...s.inverter, acKW: v } }) },
  {
    id: "export", label: "Limite de exportação", unit: "kW", min: 0, max: 10,
    apply: (s, v) => ({ ...clone(s), grid: { ...s.grid, mode: "export-limit", exportLimitKW: v } }),
  },
  {
    id: "curtailHours", label: "Duração do corte de GD (todo dia, centrado 12h30)", unit: "h", min: 0, max: 8,
    apply: (s, v) => {
      const c = clone(s);
      c.grid.events = c.grid.events.filter((e) => e.id !== "sweep");
      if (v > 0) c.grid.events.push({ id: "sweep", kind: "curtailment", start: 12.5 - v / 2, end: 12.5 + v / 2, days: "todos", probability: 1, exportFraction: 0, months: [] });
      return c;
    },
  },
  { id: "tilt", label: "Inclinação dos módulos", unit: "°", min: 0, max: 60, apply: (s, v) => ({ ...clone(s), pv: { ...s.pv, tilt: v } }) },
  { id: "azimuth", label: "Azimute (0 = Norte)", unit: "°", min: 0, max: 355, apply: (s, v) => ({ ...clone(s), pv: { ...s.pv, azimuth: v } }) },
  { id: "cloud", label: "Nebulosidade", unit: "×", min: 0, max: 2, apply: (s, v) => ({ ...clone(s), sim: { ...s.sim, cloudiness: v } }) },
  {
    id: "load", label: "Consumo base diário", unit: "kWh/dia", min: 2, max: 40,
    apply: (s, v) => {
      const c = clone(s);
      const p = c.loads.find((l) => l.kind === "profile");
      if (p && p.kind === "profile") p.dailyKWh = v;
      return c;
    },
  },
];

export interface Metric {
  id: keyof SimKPIs | "storageCycles" | "lcos";
  label: string;
  unit: string;
  pct?: boolean;
}

export const METRICS: Metric[] = [
  { id: "curtailedPct", label: "Energia solar desperdiçada", unit: "%", pct: true },
  { id: "curtailedKWh", label: "Energia cortada", unit: "kWh" },
  { id: "selfConsumption", label: "Autoconsumo", unit: "%", pct: true },
  { id: "selfSufficiency", label: "Autossuficiência", unit: "%", pct: true },
  { id: "eventRecoveredKWh", label: "Energia salva durante cortes", unit: "kWh" },
  { id: "importKWh", label: "Energia importada", unit: "kWh" },
  { id: "exportKWh", label: "Energia injetada", unit: "kWh" },
  { id: "unservedKWh", label: "Carga não atendida", unit: "kWh" },
  { id: "savingsYear", label: "Economia anualizada", unit: "R$/ano" },
  { id: "peakImportKW", label: "Pico de demanda da rede", unit: "kW" },
  { id: "specificYield", label: "Produtividade", unit: "kWh/kWp" },
  { id: "storageCycles", label: "Ciclos da bateria", unit: "ciclos" },
  { id: "lcos", label: "Custo nivelado do armazenamento", unit: "R$/kWh" },
];

export function metricValue(k: SimKPIs, id: Metric["id"]): number {
  if (id === "storageCycles") return k.storage.reduce((a, s) => a + s.cycles, 0);
  if (id === "lcos") return k.storage[0]?.lcos ?? 0;
  const v = k[id as keyof SimKPIs];
  return typeof v === "number" ? v : 0;
}

export function linspace(a: number, b: number, n: number) {
  if (n <= 1) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/** Roda o cenário para cada valor do parâmetro e devolve os KPIs. */
export function sweep(s: Scenario, param: SweepParam, values: number[]) {
  return values.map((v) => ({ x: v, kpis: simulate(param.apply(s, v)).kpis }));
}

/** Monte Carlo: o mesmo sistema sob N sequências de clima diferentes. */
export function monteCarlo(s: Scenario, runs: number) {
  const out: SimKPIs[] = [];
  for (let r = 0; r < runs; r++) out.push(simulate({ ...clone(s), sim: { ...s.sim, seed: s.sim.seed + 1000 + r * 7919 } }).kpis);
  return out;
}

export function stats(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / Math.max(n, 1);
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1));
  const q = (p: number) => (n ? v[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))] : 0);
  return { mean, sd, min: v[0] ?? 0, max: v[n - 1] ?? 0, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}
