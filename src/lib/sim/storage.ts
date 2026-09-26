/**
 * Biblioteca de tecnologias de armazenamento.
 * Valores típicos de literatura/catálogo, arredondados — servem de ponto de partida
 * e podem (devem) ser ajustados ao equipamento real estudado.
 */
import type { StorageTech, StorageUnit } from "./types.ts";

export interface TechInfo {
  tech: StorageTech;
  label: string;
  short: string;
  color: string;
  /** Eficiência de ida e volta típica (carga × descarga). */
  roundTrip: number;
  socMin: number;
  /** Relação potência/energia típica (C-rate, 1/h). */
  cRate: number;
  selfDischargePctDay: number;
  cycleLife: number;
  calendarFadePctYear: number;
  /** Custo típico de investimento no Brasil (R$/kWh instalado). */
  costPerKWh: number;
  notes: string;
}

export const TECHS: Record<StorageTech, TechInfo> = {
  lfp: {
    tech: "lfp", label: "Lítio-ferro-fosfato (LFP)", short: "LFP", color: "#6cc690",
    roundTrip: 0.95, socMin: 0.1, cRate: 0.5, selfDischargePctDay: 0.07, cycleLife: 6000, calendarFadePctYear: 1.5, costPerKWh: 2800,
    notes: "Padrão atual em residências e usinas: seguro, longa vida, sem cobalto.",
  },
  nmc: {
    tech: "nmc", label: "Lítio NMC", short: "NMC", color: "#4f8fe0",
    roundTrip: 0.93, socMin: 0.1, cRate: 1, selfDischargePctDay: 0.08, cycleLife: 3000, calendarFadePctYear: 2, costPerKWh: 3000,
    notes: "Mais densa (carros elétricos), menor vida em ciclos e maior sensibilidade térmica.",
  },
  lead: {
    tech: "lead", label: "Chumbo-ácido (AGM/Gel)", short: "Chumbo", color: "#8b8fa3",
    roundTrip: 0.8, socMin: 0.5, cRate: 0.2, selfDischargePctDay: 0.1, cycleLife: 1200, calendarFadePctYear: 4, costPerKWh: 1200,
    notes: "Barata e reciclável, mas só aceita ~50% de descarga e degrada rápido no calor.",
  },
  sodium: {
    tech: "sodium", label: "Íon-sódio", short: "Na-íon", color: "#e0a04f",
    roundTrip: 0.9, socMin: 0.05, cRate: 1, selfDischargePctDay: 0.1, cycleLife: 4000, calendarFadePctYear: 1.8, costPerKWh: 2300,
    notes: "Tecnologia emergente (China): sem lítio, boa em temperaturas extremas.",
  },
  flow: {
    tech: "flow", label: "Fluxo redox de vanádio", short: "Fluxo", color: "#9b6cd6",
    roundTrip: 0.72, socMin: 0.02, cRate: 0.25, selfDischargePctDay: 0.3, cycleLife: 15000, calendarFadePctYear: 0.5, costPerKWh: 3500,
    notes: "Energia e potência independentes (tanques × pilha); ideal para longa duração.",
  },
  supercap: {
    tech: "supercap", label: "Supercapacitor", short: "Supercap", color: "#e05a8a",
    roundTrip: 0.95, socMin: 0.05, cRate: 60, selfDischargePctDay: 20, cycleLife: 500000, calendarFadePctYear: 1, costPerKWh: 60000,
    notes: "Potência altíssima por segundos/minutos: partida de motores, suavizar nuvens.",
  },
  gravity: {
    tech: "gravity", label: "Bateria gravitacional (blocos/torre)", short: "Gravitacional", color: "#c7a340",
    roundTrip: 0.8, socMin: 0, cRate: 0.25, selfDischargePctDay: 0, cycleLife: 35000, calendarFadePctYear: 0.1, costPerKWh: 2500,
    notes: "Eleva massas com motor e devolve pelo gerador ao descer (E = m·g·h). Sem autodescarga, vida longa. Ex.: projeto de torre em Rudong (China).",
  },
  pumped: {
    tech: "pumped", label: "Reservatório bombeado (mini-hidro)", short: "Hidro bombeada", color: "#3fa6c9",
    roundTrip: 0.72, socMin: 0.05, cRate: 0.15, selfDischargePctDay: 0.05, cycleLife: 50000, calendarFadePctYear: 0.1, costPerKWh: 1800,
    notes: "Bombeia água para cima e turbina na volta (E = ρ·V·g·h). Viável em sítios com desnível.",
  },
  hydrogen: {
    tech: "hydrogen", label: "Hidrogênio verde (eletrolisador + célula)", short: "H₂", color: "#7fb3d5",
    roundTrip: 0.35, socMin: 0, cRate: 0.1, selfDischargePctDay: 0.02, cycleLife: 20000, calendarFadePctYear: 1, costPerKWh: 1500,
    notes: "Baixa eficiência (~35%), mas armazena por meses sem perdas: sazonal.",
  },
};

const G = 9.81;

/** Energia potencial gravitacional útil (kWh) de uma massa em toneladas elevada a h metros. */
export const gravityKWh = (massT: number, heightM: number) => (massT * 1000 * G * heightM) / 3.6e6;
/** Energia de um reservatório (kWh) com volume em m³ e desnível em metros. */
export const pumpedKWh = (volumeM3: number, heightM: number) => (volumeM3 * 1000 * G * heightM) / 3.6e6;
/** Energia química do hidrogênio (PCI 33,3 kWh/kg). */
export const hydrogenKWh = (kg: number) => kg * 33.3;

let seq = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Cria uma unidade de armazenamento com os parâmetros típicos da tecnologia. */
export function makeStorage(tech: StorageTech, capacityKWh: number, over: Partial<StorageUnit> = {}): StorageUnit {
  const t = TECHS[tech];
  const eta = Math.sqrt(t.roundTrip);
  const power = Math.max(0.1, capacityKWh * t.cRate);
  return {
    id: newId("st"),
    name: `${t.short} ${fmt(capacityKWh)} kWh`,
    tech,
    capacityKWh,
    chargeKW: power,
    dischargeKW: power,
    etaCharge: eta,
    etaDischarge: eta,
    socMin: t.socMin,
    socMax: 1,
    socInitial: 0.5,
    selfDischargePctDay: t.selfDischargePctDay,
    cycleLife: t.cycleLife,
    calendarFadePctYear: t.calendarFadePctYear,
    capex: Math.round(capacityKWh * t.costPerKWh),
    priority: 1,
    ...over,
  };
}

function fmt(n: number) {
  return n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString().replace(".", ",");
}
