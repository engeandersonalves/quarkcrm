/**
 * S.A.V.E — Sistema de Abastecimento de Veículo Elétrico.
 * Orçamento por itens (qtd × valor unitário) + a mesma formação de preço da solar.
 *
 * Custos internos ficam em `extraCosts`, `commission`, `tax`, `profit`, `discount`, `roundTo` e `notes`,
 * chaves que a função pública da proposta já remove — o cliente nunca vê custo nem margem.
 */
import { applyPricing, pmt, type ExtraCost, type PriceComponent } from "./pricing.ts";

export type SaveItemKey = "charger" | "panel" | "emergency" | "socket" | "infra" | "labor" | "custom";

export interface SaveCostItem extends ExtraCost {
  key: SaveItemKey;
  qty: number;
  unit: number; // valor unitário (R$)
}

export interface SaveInputs {
  product: "save";
  // Carregador
  chargerPowerKw: number;
  phases: "mono" | "tri";
  currentA: number;
  connector: string;
  chargerBrands: string;
  chargerModel: string;
  chargerImage: string;
  // Escopo
  distanceM: number;
  includePanel: boolean;
  includeEmergency: boolean;
  includeSocket: boolean;
  // Custos (privados)
  extraCosts: SaveCostItem[];
  commission: PriceComponent;
  tax: PriceComponent;
  profit: PriceComponent;
  discount: number;
  roundTo: number;
  notes: string;
  // Condições
  executionDays: number;
  validityDays: number;
  installWarrantyMonths: number;
  factoryWarrantyYears: number;
  paymentNotes: string;
  cardInstallments: number;
  cardRate: number;
  conditions: string[];
  // Didático: recarga e economia
  batteryKwh: number;
  onboardChargerKw: number;
  kmPerMonth: number;
  evKwhPer100km: number;
  energyTariff: number;
  fuelPrice: number;
  kmPerLiter: number;
}

export const CHARGER_OPTIONS = [
  { kw: 7.4, phases: "mono" as const, currentA: 32, label: "7,4 kW", sub: "Monofásico 32 A" },
  { kw: 11, phases: "tri" as const, currentA: 16, label: "11 kW", sub: "Trifásico 16 A" },
  { kw: 22, phases: "tri" as const, currentA: 32, label: "22 kW", sub: "Trifásico 32 A" },
];

export const DEFAULT_SAVE_CONDITIONS = [
  "A potência do carregador exige alimentação compatível no ponto de conexão. A velocidade real de recarga também depende do carregador de bordo de cada veículo.",
  "Orçamento considera até {distancia} m entre o ponto de conexão e o wallbox. Distâncias maiores ou trajetos que exijam obra civil serão reavaliados.",
  "Não previstos (orçados à parte, se necessários): aumento de carga ou adequação do padrão de entrada junto à concessionária.",
  "A garantia de instalação não cobre danos por mau uso, intervenção de terceiros ou descargas atmosféricas.",
];

export function defaultSaveItems(distanceM = 50): SaveCostItem[] {
  return [
    { id: "charger", key: "charger", label: "Carregador veicular (wallbox)", qty: 1, unit: 3600, value: 3600 },
    { id: "panel", key: "panel", label: "Quadro de proteção (disjuntores, DR, DPS)", qty: 1, unit: 850, value: 850 },
    { id: "emergency", key: "emergency", label: "Botão de emergência", qty: 1, unit: 180, value: 180 },
    { id: "socket", key: "socket", label: "Tomada industrial IEC 60309", qty: 1, unit: 220, value: 220 },
    { id: "infra", key: "infra", label: "Infraestrutura (cabos e eletrodutos) por metro", qty: distanceM, unit: 38, value: distanceM * 38 },
    { id: "labor", key: "labor", label: "Mão de obra e comissionamento", qty: 1, unit: 1200, value: 1200 },
  ];
}

export const DEFAULT_SAVE: SaveInputs = {
  product: "save",
  chargerPowerKw: 22,
  phases: "tri",
  currentA: 32,
  connector: "Tipo 2",
  chargerBrands: "Belenus, Joult ou Riseon",
  chargerModel: "",
  chargerImage: "",
  distanceM: 50,
  includePanel: true,
  includeEmergency: true,
  includeSocket: true,
  extraCosts: defaultSaveItems(50),
  commission: { mode: "percent", value: 5 },
  tax: { mode: "percent", value: 6 },
  profit: { mode: "percent", value: 12 },
  discount: 0,
  roundTo: 10,
  notes: "",
  executionDays: 5,
  validityDays: 7,
  installWarrantyMonths: 6,
  factoryWarrantyYears: 1,
  paymentNotes: "À vista (espécie ou Pix) ou cartão em até 12x.",
  cardInstallments: 12,
  cardRate: 1.99,
  conditions: DEFAULT_SAVE_CONDITIONS,
  batteryKwh: 60,
  onboardChargerKw: 11,
  kmPerMonth: 1500,
  evKwhPer100km: 17,
  energyTariff: 0.98,
  fuelPrice: 6.29,
  kmPerLiter: 11,
};

export function mergeSave(...parts: (Partial<SaveInputs> | null | undefined)[]): SaveInputs {
  const merged = Object.assign({}, DEFAULT_SAVE, ...parts.map((p) => p ?? {})) as SaveInputs;
  return { ...merged, product: "save" };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Itens que entram no custo, respeitando o que está incluído no escopo. */
export function activeItems(i: SaveInputs): SaveCostItem[] {
  return (i.extraCosts ?? []).filter(
    (it) => !((it.key === "panel" && !i.includePanel) || (it.key === "emergency" && !i.includeEmergency) || (it.key === "socket" && !i.includeSocket)),
  );
}

export function calcSave(i: SaveInputs) {
  const lines = activeItems(i).map((it) => {
    const qty = it.key === "infra" ? n(i.distanceM) : n(it.qty);
    return { key: it.id, label: it.label || "Item", detail: qty !== 1 ? `${qty} × ${fmtBRL(n(it.unit))}` : undefined, value: qty * n(it.unit) };
  });
  const directCost = lines.reduce((s, l) => s + l.value, 0);
  return { lines, ...applyPricing(directCost, i) };
}

/** Potência efetiva: o menor entre o carregador e o carregador de bordo do veículo. */
export function effectiveKw(chargerKw: number, onboardKw: number) {
  return Math.max(0.1, Math.min(n(chargerKw), n(onboardKw) || n(chargerKw)));
}

/** Horas para recarregar de 20% a 80% (60% da bateria), com ~90% de eficiência. */
export function chargeHours(batteryKwh: number, kw: number) {
  return (n(batteryKwh) * 0.6) / (Math.max(0.1, kw) * 0.9);
}

export function costPerKm(i: SaveInputs) {
  const evPer100 = (n(i.evKwhPer100km) * n(i.energyTariff)) / 1; // R$ por 100 km
  const icePer100 = n(i.kmPerLiter) > 0 ? (100 / n(i.kmPerLiter)) * n(i.fuelPrice) : 0;
  const months = n(i.kmPerMonth) / 100;
  return {
    evPer100,
    icePer100,
    evMonth: evPer100 * months,
    iceMonth: icePer100 * months,
    savingMonth: (icePer100 - evPer100) * months,
    savingYear: (icePer100 - evPer100) * months * 12,
  };
}

export function saveCardInstallment(price: number, i: SaveInputs) {
  return i.cardInstallments > 0 ? pmt(price, i.cardRate, i.cardInstallments) : 0;
}

export function fillCondition(text: string, i: SaveInputs) {
  return text.replaceAll("{distancia}", String(n(i.distanceM))).replaceAll("{potencia}", String(n(i.chargerPowerKw)).replace(".", ","));
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
