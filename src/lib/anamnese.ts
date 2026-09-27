/**
 * Anamnese energética: questionário persuasivo enviado ao cliente antes do orçamento.
 * Aqui ficam as opções, o cálculo da economia (mesmo motor das propostas) e o
 * resumo que vai para o CRM.
 */
import { DEFAULT_INPUTS } from "./defaults.ts";
import { quickEstimate, type QuickEstimate } from "./quick-estimate.ts";

export type InputMode = "kwh" | "bill";
export type Fit = "atende" | "aumentar";
export type Properties = "1" | "2" | "3+";
export type Payment = "financiamento" | "cartao" | "avista" | "pensar";
export type Timeline = "agora" | "1-3" | "3-6" | "naosei";

export const INCREASES = [
  { id: "ar", label: "Ar-condicionado", kwh: 150, emoji: "❄️" },
  { id: "carro", label: "Carro elétrico", kwh: 250, emoji: "🚗" },
  { id: "piscina", label: "Piscina ou aquecimento", kwh: 200, emoji: "🏊" },
  { id: "familia", label: "Mais pessoas ou cômodos", kwh: 100, emoji: "🏡" },
  { id: "negocio", label: "Equipamentos de trabalho", kwh: 180, emoji: "🛠️" },
] as const;
export type IncreaseId = (typeof INCREASES)[number]["id"];

export const PAYMENTS: { id: Payment; label: string; sub: string }[] = [
  { id: "financiamento", label: "Financiamento", sub: "Troque a conta de luz pela parcela" },
  { id: "cartao", label: "Cartão de crédito", sub: "Parcelado no cartão" },
  { id: "avista", label: "À vista", sub: "Desconto especial" },
  { id: "pensar", label: "Ainda vou pensar", sub: "Quero ver as opções primeiro" },
];

export const TIMELINES: { id: Timeline; label: string; sub: string }[] = [
  { id: "agora", label: "O mais rápido possível", sub: "Quero parar de pagar caro já" },
  { id: "1-3", label: "Em 1 a 3 meses", sub: "Estou me organizando" },
  { id: "3-6", label: "Em 3 a 6 meses", sub: "Planejando para o semestre" },
  { id: "naosei", label: "Ainda não sei", sub: "Estou pesquisando" },
];

export const PROPERTIES: { id: Properties; label: string; sub: string }[] = [
  { id: "1", label: "Só este imóvel", sub: "A energia fica onde for gerada" },
  { id: "2", label: "2 imóveis", sub: "Gera em um e abate a conta do outro" },
  { id: "3+", label: "3 ou mais", sub: "Casa, comércio, casa de praia…" },
];

export interface Answers {
  mode: InputMode;
  /** kWh por mês (modo kwh) ou R$ por mês (modo bill). */
  value: number;
  fit: Fit | null;
  increases: IncreaseId[];
  extraKwh: number;
  roof: string | null;
  properties: Properties | null;
  otherKwh: number;
  payment: Payment | null;
  timeline: Timeline | null;
}

export const EMPTY_ANSWERS: Answers = {
  mode: "bill",
  value: 450,
  fit: null,
  increases: [],
  extraKwh: 0,
  roof: null,
  properties: null,
  otherKwh: 0,
  payment: null,
  timeline: null,
};

export interface Rates {
  tariff?: number | null;
  sunHours?: number | null;
  fioBTariff?: number | null;
  publicLighting?: number | null;
}

const rate = (r: Rates) => ({
  tariff: r.tariff || DEFAULT_INPUTS.tariff,
  lighting: r.publicLighting ?? DEFAULT_INPUTS.publicLighting,
});

/** Consumo atual em kWh, a partir do que o cliente informou. */
export function currentKwh(a: Pick<Answers, "mode" | "value">, r: Rates = {}) {
  const { tariff, lighting } = rate(r);
  if (a.mode === "kwh") return Math.max(0, Math.round(a.value));
  return Math.max(0, Math.round((a.value - lighting) / tariff));
}

/** Valor atual da conta em R$. */
export function currentBill(a: Pick<Answers, "mode" | "value">, r: Rates = {}) {
  const { tariff, lighting } = rate(r);
  return a.mode === "bill" ? Math.max(0, a.value) : Math.round(a.value * tariff + lighting);
}

export function increaseKwh(a: Pick<Answers, "fit" | "increases" | "extraKwh">) {
  if (a.fit !== "aumentar") return 0;
  return INCREASES.filter((i) => a.increases.includes(i.id)).reduce((s, i) => s + i.kwh, 0) + Math.max(0, a.extraKwh);
}

/** Consumo que o sistema vai atender: atual + aumento previsto + outros imóveis. */
export function plannedKwh(a: Answers, r: Rates = {}) {
  const others = a.properties && a.properties !== "1" ? Math.max(0, a.otherKwh) : 0;
  return currentKwh(a, r) + increaseKwh(a) + others;
}

export interface Plan {
  kwhNow: number;
  billNow: number;
  kwhPlanned: number;
  /** Conta equivalente ao consumo planejado (base do dimensionamento). */
  billPlanned: number;
  estimate: QuickEstimate;
  /** Quanto o cliente deixa de economizar a cada mês de espera. */
  costOfWaiting: number;
  /** Quanto vai para a distribuidora em 25 anos se nada mudar (reajuste de 6% ao ano). */
  paid25y: number;
}

export function buildPlan(a: Answers, r: Rates = {}): Plan {
  const { tariff, lighting } = rate(r);
  const kwhNow = currentKwh(a, r);
  const billNow = currentBill(a, r);
  const kwhPlanned = plannedKwh(a, r);
  const billPlanned = Math.round(kwhPlanned * tariff + lighting);
  const estimate = quickEstimate({
    bill: billPlanned,
    tariff: r.tariff ?? undefined,
    sunHours: r.sunHours ?? undefined,
    fioBTariff: r.fioBTariff ?? undefined,
    publicLighting: r.publicLighting ?? undefined,
  });
  let paid25y = 0;
  for (let y = 0; y < 25; y++) paid25y += billPlanned * 12 * Math.pow(1 + DEFAULT_INPUTS.tariffIncrease / 100, y);
  return { kwhNow, billNow, kwhPlanned, billPlanned, estimate, costOfWaiting: Math.round(estimate.monthlySavings), paid25y: Math.round(paid25y) };
}

/** Quão perto de fechar: prazo e forma de pagamento definidos esquentam o lead. */
export function temperatureOf(a: Pick<Answers, "timeline" | "payment">): "quente" | "morno" | "frio" {
  if (a.timeline === "agora") return "quente";
  if (a.timeline === "1-3") return a.payment && a.payment !== "pensar" ? "quente" : "morno";
  if (a.timeline === "3-6") return "morno";
  return a.payment && a.payment !== "pensar" ? "morno" : "frio";
}

const label = <T extends string>(list: { id: T; label: string }[], id: T | null) => list.find((x) => x.id === id)?.label ?? "—";
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Resumo que vai para as observações do lead no CRM. */
export function anamneseNotes(a: Answers, plan: Plan, extra: { referral?: string; message?: string } = {}) {
  const inc: string[] = INCREASES.filter((i) => a.increases.includes(i.id)).map((i) => i.label);
  if (a.extraKwh > 0) inc.push(`+${a.extraKwh} kWh`);
  const lines = [
    "📋 ANAMNESE ENERGÉTICA",
    `• Consumo atual: ${plan.kwhNow} kWh/mês (conta ≈ ${brl0(plan.billNow)})`,
    `• Atende hoje? ${a.fit === "aumentar" ? `Quer aumentar: ${inc.join(", ") || "sim"} (+${increaseKwh(a)} kWh)` : "Sim, atende"}`,
    `• Telhado: ${a.roof ?? "—"}`,
    `• Imóveis: ${label(PROPERTIES, a.properties)}${a.properties && a.properties !== "1" ? ` · outros imóveis: ${a.otherKwh} kWh/mês (transferir energia)` : ""}`,
    `• Pagamento: ${label(PAYMENTS, a.payment)}`,
    `• Prazo: ${label(TIMELINES, a.timeline)}`,
    `• Dimensionar para: ${plan.kwhPlanned} kWh/mês → ${plan.estimate.kwp.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWp (${plan.estimate.modules} placas, ~${plan.estimate.areaM2} m²)`,
    `• Economia estimada: ${brl0(plan.estimate.monthlySavings)}/mês · ${brl0(plan.estimate.savings25y)} em 25 anos`,
  ];
  if (extra.referral?.trim()) lines.push(`• Indicação: ${extra.referral.trim()}`);
  if (extra.message?.trim()) lines.push(`• Mensagem: ${extra.message.trim()}`);
  return lines.join("\n");
}

/** Percentual do Fio B pago sobre a energia compensada (Lei 14.300, regra de transição). */
export function fioBShare(year: number) {
  const table: Record<number, number> = { 2023: 15, 2024: 30, 2025: 45, 2026: 60, 2027: 75, 2028: 90 };
  if (year <= 2022) return 0;
  return table[year] ?? 100;
}
