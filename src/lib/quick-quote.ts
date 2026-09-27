/**
 * Orçamento rápido: a partir do consumo (vindo da anamnese) dimensiona o sistema e
 * calcula economia, retorno e parcelas com poucos valores — para virar uma imagem.
 */
import { DEFAULT_INPUTS } from "./defaults.ts";
import { calcEnergy, pmt, type ConnectionType } from "./pricing.ts";

export const INVERTER_SIZES = [2, 3, 3.6, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 36, 40, 50, 60, 75, 100];
const MODULE_AREA_M2 = 2.7;

export interface QuickQuoteInput {
  consumptionKwh: number;
  moduleW: number;
  /** 0 = automático (dimensiona pelo consumo). */
  modules: number;
  /** 0 = automático. */
  inverterKw: number;
  priceMode: "wp" | "total";
  /** R$/Wp (modo wp) ou valor total (modo total). */
  price: number;
  cashDiscountPct: number;
  financingRate: number;
  financingMonths: number;
  cardInstallments: number;
  cardRate: number;
  tariff: number;
  sunHours: number;
  fioBTariff: number;
  publicLighting: number;
  connectionType: ConnectionType;
}

export const DEFAULT_QUICK: QuickQuoteInput = {
  consumptionKwh: 500,
  moduleW: 610,
  modules: 0,
  inverterKw: 0,
  priceMode: "wp",
  price: 0,
  cashDiscountPct: 5,
  financingRate: DEFAULT_INPUTS.financingRate,
  financingMonths: 72,
  cardInstallments: DEFAULT_INPUTS.cardInstallments,
  cardRate: DEFAULT_INPUTS.cardRate,
  tariff: DEFAULT_INPUTS.tariff,
  sunHours: DEFAULT_INPUTS.sunHours,
  fioBTariff: DEFAULT_INPUTS.fioBTariff,
  publicLighting: DEFAULT_INPUTS.publicLighting,
  connectionType: "bi",
};

/** Quantidade de placas para cobrir o consumo (mínimo 4). */
export function modulesFor(consumptionKwh: number, moduleW: number, sunHours: number) {
  if (consumptionKwh <= 0 || moduleW <= 0) return 0;
  const kwp = consumptionKwh / (sunHours * 30 * DEFAULT_INPUTS.performanceRatio);
  return Math.max(4, Math.ceil((kwp * 1000) / moduleW));
}

/** Inversor comercial mais próximo, com carregamento (kWp/kW) de até ~1,3. */
export function inverterFor(kwp: number) {
  if (kwp <= 0) return 0;
  const min = kwp / 1.3;
  return INVERTER_SIZES.find((s) => s >= min) ?? Math.ceil(min);
}

export function quickQuote(q: QuickQuoteInput) {
  const modules = q.modules > 0 ? Math.round(q.modules) : modulesFor(q.consumptionKwh, q.moduleW, q.sunHours);
  const kwp = (modules * q.moduleW) / 1000;
  const inverterKw = q.inverterKw > 0 ? q.inverterKw : inverterFor(kwp);
  const price = Math.max(0, q.priceMode === "wp" ? q.price * kwp * 1000 : q.price);
  const cashPrice = price * (1 - Math.min(Math.max(q.cashDiscountPct, 0), 50) / 100);
  const energy = calcEnergy(
    {
      ...DEFAULT_INPUTS,
      modulePowerW: q.moduleW,
      moduleQty: modules,
      consumptionKwh: q.consumptionKwh,
      tariff: q.tariff,
      sunHours: q.sunHours,
      fioBTariff: q.fioBTariff,
      publicLighting: q.publicLighting,
      connectionType: q.connectionType,
    },
    cashPrice,
  );
  const financing = price > 0 && q.financingMonths > 0 ? pmt(price, q.financingRate, q.financingMonths) : 0;
  const card = price > 0 && q.cardInstallments > 0 ? pmt(price, q.cardRate, q.cardInstallments) : 0;
  return {
    modules,
    kwp,
    inverterKw,
    areaM2: Math.round(modules * MODULE_AREA_M2),
    generation: energy.monthlyGeneration,
    coverage: energy.coverage,
    billBefore: energy.monthlyBillBefore,
    billAfter: energy.monthlyBillAfter,
    monthlySavings: energy.monthlySavings,
    annualSavings: energy.annualSavings,
    savings25y: energy.savings25y,
    paybackYears: cashPrice > 0 ? energy.paybackYears : 0,
    price,
    cashPrice,
    financing,
    card,
    pricePerWp: kwp > 0 ? price / (kwp * 1000) : 0,
    co2Tons25y: energy.co2TonsPerYear * 25,
  };
}

export type QuickQuote = ReturnType<typeof quickQuote>;
