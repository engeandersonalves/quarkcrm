/** Cenários prontos para estudo — cada um responde a uma pergunta de pesquisa. */
import { cityById } from "./climate.ts";
import { loadTemplate } from "./loads.ts";
import { gravityKWh, makeStorage, newId, pumpedKWh } from "./storage.ts";
import type { GridEvent, Load, Scenario } from "./types.ts";

export function baseScenario(over: Partial<Scenario> = {}): Scenario {
  const city = cityById("natal");
  return {
    id: newId("sc"),
    name: "Novo cenário",
    description: "",
    site: { cityId: city.id, lat: city.lat, lon: city.lon, tz: -3, albedo: 0.2 },
    sim: { startDay: 244, days: 7, stepMin: 15, seed: 42, cloudiness: 1 },
    pv: { kWp: 6, tilt: 10, azimuth: 0, tempCoeff: -0.35, noct: 45, lossesPct: 8, ageYears: 0, degradationPctYear: 0.5, bifacial: false },
    inverter: { acKW: 5, etaMax: 0.975, tareW: 15, backup: false, surgeKW: 7.5 },
    storage: [],
    loads: [house(12)],
    grid: { mode: "on-grid", exportLimitKW: 0, importLimitKW: 15, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [] },
    generator: { enabled: false, kW: 5, startSoc: 0.2, litersPerKWh: 0.35, fuelPrice: 6.2 },
    control: { strategy: "autoconsumo", backupReserve: 0.3, peakLimitKW: 5 },
    tariff: { price: 0.95, fioB: 0.28, year: 2026, branca: false, peakMult: 1.9, midMult: 1.25, offMult: 0.82, peakStart: 18, peakEnd: 21, co2: 0.06 },
    ...over,
  };
}

function house(daily: number, name = "Casa (consumo base)"): Load {
  return { ...(loadTemplate("profile") as Extract<Load, { kind: "profile" }>), name, dailyKWh: daily };
}

export function curtailEvent(over: Partial<GridEvent> = {}): GridEvent {
  return { id: newId("ev"), kind: "curtailment", start: 10, end: 15, days: "domingos", probability: 1, exportFraction: 0, months: [], ...over };
}

export interface Preset {
  id: string;
  title: string;
  question: string;
  build: () => Scenario;
}

export const PRESETS: Preset[] = [
  {
    id: "ref",
    title: "Casa on-grid (referência)",
    question: "Quanto uma casa típica gera, consome e injeta sem restrição nenhuma?",
    build: () => baseScenario({ name: "Casa on-grid — referência", description: "6 kWp, 12 kWh/dia, injeção livre na rede." }),
  },
  {
    id: "corte-gd",
    title: "Corte de GD aos domingos",
    question: "Se o operador proibir a injeção das 10h às 15h nos domingos, quanto se perde — e quanto uma bateria recupera?",
    build: () =>
      baseScenario({
        name: "Corte de GD domingo 10h–15h + LFP 10 kWh",
        description: "Injeção zerada nos domingos ao meio-dia. Estratégia anti-corte: deixa a bateria vazia para a janela do corte. Compare com autoconsumo e sem bateria.",
        sim: { startDay: 244, days: 28, stepMin: 15, seed: 42, cloudiness: 1 },
        storage: [makeStorage("lfp", 10, { socInitial: 0.3 })],
        inverter: { acKW: 5, etaMax: 0.975, tareW: 20, backup: true, surgeKW: 10 },
        grid: { mode: "on-grid", exportLimitKW: 0, importLimitKW: 15, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [curtailEvent()] },
        control: { strategy: "anti-corte", backupReserve: 0.2, peakLimitKW: 5 },
      }),
  },
  {
    id: "zero-grid",
    title: "Zero grid (grid zero) sem bateria",
    question: "Com injeção proibida e sem armazenamento, quanto da energia solar é desperdiçada?",
    build: () =>
      baseScenario({
        name: "Zero grid sem bateria",
        description: "Limitador de exportação em 0 kW; o inversor reduz a geração para seguir a carga.",
        grid: { mode: "zero-grid", exportLimitKW: 0, importLimitKW: 15, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [] },
      }),
  },
  {
    id: "zero-grid-flex",
    title: "Zero grid + boiler + carro + LFP",
    question: "Combinando bateria de lítio, aquecedor com desviador e carro inteligente, dá para zerar o desperdício sem injetar?",
    build: () =>
      baseScenario({
        name: "Zero grid + armazenamento térmico, químico e veicular",
        description: "Boiler 200 L com desviador, carro elétrico carregando de dia e LFP 5 kWh.",
        pv: { kWp: 8, tilt: 10, azimuth: 0, tempCoeff: -0.35, noct: 45, lossesPct: 8, ageYears: 0, degradationPctYear: 0.5, bifacial: false },
        inverter: { acKW: 7, etaMax: 0.975, tareW: 20, backup: true, surgeKW: 12 },
        storage: [makeStorage("lfp", 5, { socInitial: 0.3 })],
        loads: [
          house(12),
          loadTemplate("waterheater"),
          { ...(loadTemplate("ev") as Extract<Load, { kind: "ev" }>), smart: true, plugIn: 9, plugOut: 17, daysHome: "todos", chargerKW: 3.7 },
        ],
        grid: { mode: "zero-grid", exportLimitKW: 0, importLimitKW: 15, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [] },
      }),
  },
  {
    id: "apagao",
    title: "Apagão com inversor híbrido",
    question: "Durante uma falta de energia, a casa se mantém com sol + bateria? E sem inversor híbrido?",
    build: () =>
      baseScenario({
        name: "Apagão de 18h com backup LFP",
        description: "Falta de energia das 14h às 8h do dia seguinte num dia qualquer (probabilidade 30%/dia).",
        storage: [makeStorage("lfp", 10, { socInitial: 0.8 })],
        inverter: { acKW: 5, etaMax: 0.975, tareW: 20, backup: true, surgeKW: 10 },
        control: { strategy: "reserva-backup", backupReserve: 0.4, peakLimitKW: 5 },
        grid: {
          mode: "on-grid", exportLimitKW: 0, importLimitKW: 15, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6,
          events: [{ id: newId("ev"), kind: "outage", start: 14, end: 8, days: "todos", probability: 0.3, exportFraction: 0, months: [] }],
        },
      }),
  },
  {
    id: "offgrid",
    title: "Sítio off-grid: bomba, motor e gerador",
    question: "Quanto de bateria e gerador um sítio isolado precisa para bombear água e rodar uma máquina?",
    build: () =>
      baseScenario({
        name: "Sítio off-grid com bomba solar e moinho",
        description: "Sem rede. Chumbo-ácido, bomba com caixa-d'água (bateria hídrica), motor 3 cv só com sol e gerador a diesel.",
        site: { cityId: "petrolina", lat: -9.39, lon: -40.5, tz: -3, albedo: 0.25 },
        pv: { kWp: 5, tilt: 12, azimuth: 0, tempCoeff: -0.35, noct: 45, lossesPct: 10, ageYears: 0, degradationPctYear: 0.5, bifacial: false },
        inverter: { acKW: 5, etaMax: 0.95, tareW: 40, backup: true, surgeKW: 10 },
        storage: [makeStorage("lead", 14.4, { socInitial: 0.8, socMin: 0.5 })],
        loads: [
          { ...house(4, "Casa do sítio"), shape: "rural" } as Load,
          loadTemplate("pump"),
          { ...(loadTemplate("motor") as Extract<Load, { kind: "motor" }>), solarOnly: true, start: 9, end: 15, days: "uteis" },
        ],
        grid: { mode: "off-grid", exportLimitKW: 0, importLimitKW: 0, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [] },
        generator: { enabled: true, kW: 4, startSoc: 0.55, litersPerKWh: 0.4, fuelPrice: 6.2 },
      }),
  },
  {
    id: "gravidade",
    title: "Bateria gravitacional comunitária",
    question: "Uma torre de blocos (tipo Energy Vault/Rudong) em escala de condomínio aproveita a sobra de uma mini-usina sob corte?",
    build: () => {
      const massT = 400;
      const heightM = 40;
      const cap = Math.round(gravityKWh(massT, heightM));
      return baseScenario({
        name: "Condomínio 75 kWp + torre gravitacional",
        description: `Blocos de ${massT} t elevados a ${heightM} m ≈ ${cap} kWh. Exportação limitada a 20 kW e corte total nos fins de semana.`,
        site: { cityId: "brasilia", lat: -15.79, lon: -47.88, tz: -3, albedo: 0.2 },
        sim: { startDay: 244, days: 14, stepMin: 15, seed: 7, cloudiness: 1 },
        pv: { kWp: 75, tilt: 15, azimuth: 0, tempCoeff: -0.34, noct: 45, lossesPct: 8, ageYears: 0, degradationPctYear: 0.5, bifacial: true },
        inverter: { acKW: 60, etaMax: 0.985, tareW: 150, backup: true, surgeKW: 90 },
        storage: [makeStorage("gravity", cap, { name: `Torre gravitacional ${cap} kWh`, physical: { massT, heightM }, socInitial: 0.2 })],
        loads: [{ ...house(180, "20 apartamentos"), noise: 0.08 } as Load],
        grid: { mode: "export-limit", exportLimitKW: 20, importLimitKW: 80, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [curtailEvent({ days: "fds", start: 9, end: 16 })] },
        tariff: { price: 0.9, fioB: 0.26, year: 2026, branca: false, peakMult: 1.9, midMult: 1.25, offMult: 0.82, peakStart: 18, peakEnd: 21, co2: 0.06 },
      });
    },
  },
  {
    id: "hidro",
    title: "Caixa-d'água no morro (hidro bombeada)",
    question: "Um reservatório de 500 m³ com 60 m de desnível substitui baterias químicas numa fazenda?",
    build: () => {
      const cap = Math.round(pumpedKWh(500, 60));
      return baseScenario({
        name: "Fazenda com reservatório bombeado",
        description: `500 m³ a 60 m ≈ ${cap} kWh potenciais. Eficiência de ida e volta ~72%.`,
        site: { cityId: "bh", lat: -19.92, lon: -43.94, tz: -3, albedo: 0.2 },
        pv: { kWp: 30, tilt: 20, azimuth: 0, tempCoeff: -0.35, noct: 45, lossesPct: 8, ageYears: 0, degradationPctYear: 0.5, bifacial: false },
        inverter: { acKW: 25, etaMax: 0.98, tareW: 60, backup: true, surgeKW: 40 },
        storage: [makeStorage("pumped", cap, { name: `Reservatório ${cap} kWh`, physical: { volumeM3: 500, heightM: 60 }, socInitial: 0.5 })],
        loads: [{ ...house(60, "Sede + ordenha"), shape: "rural" } as Load, loadTemplate("pump")],
        grid: { mode: "zero-grid", exportLimitKW: 0, importLimitKW: 30, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [] },
      });
    },
  },
  {
    id: "tarifa-branca",
    title: "Tarifa branca: arbitragem com bateria",
    question: "Vale a pena guardar o sol do meio-dia para o horário de ponta na tarifa branca?",
    build: () =>
      baseScenario({
        name: "Tarifa branca + LFP 10 kWh",
        description: "Bateria descarrega só na ponta/intermediário; compare com a estratégia de autoconsumo.",
        storage: [makeStorage("lfp", 10, { socInitial: 0.3 })],
        inverter: { acKW: 5, etaMax: 0.975, tareW: 20, backup: true, surgeKW: 10 },
        control: { strategy: "tarifa-branca", backupReserve: 0.2, peakLimitKW: 5 },
        tariff: { price: 0.95, fioB: 0.28, year: 2026, branca: true, peakMult: 1.9, midMult: 1.25, offMult: 0.82, peakStart: 18, peakEnd: 21, co2: 0.06 },
      }),
  },
  {
    id: "h2",
    title: "Hidrogênio sazonal",
    question: "Com eficiência de ~35%, o hidrogênio compensa como estoque de longo prazo num sistema isolado?",
    build: () =>
      baseScenario({
        name: "Off-grid com LFP (diário) + H₂ (sazonal)",
        description: "Um ano inteiro, passo de 1 h. LFP cobre a noite; H₂ cobre as semanas nubladas.",
        site: { cityId: "curitiba", lat: -25.43, lon: -49.27, tz: -3, albedo: 0.2 },
        sim: { startDay: 1, days: 365, stepMin: 60, seed: 3, cloudiness: 1 },
        pv: { kWp: 4, tilt: 30, azimuth: 0, tempCoeff: -0.35, noct: 45, lossesPct: 8, ageYears: 0, degradationPctYear: 0.5, bifacial: false },
        inverter: { acKW: 4, etaMax: 0.97, tareW: 30, backup: true, surgeKW: 8 },
        storage: [makeStorage("lfp", 10, { priority: 1, socInitial: 0.6 }), makeStorage("hydrogen", 300, { priority: 2, chargeKW: 2, dischargeKW: 2, socInitial: 0.2, name: "H₂ 9 kg (300 kWh)", physical: { h2Kg: 9 } })],
        loads: [house(10)],
        grid: { mode: "off-grid", exportLimitKW: 0, importLimitKW: 0, gridCharge: false, gridChargeStart: 0, gridChargeEnd: 6, events: [] },
      }),
  },
];
