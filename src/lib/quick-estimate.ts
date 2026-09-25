/**
 * Estimativa instantânea para a página de captura: a partir do valor da conta de luz,
 * dimensiona o sistema e calcula a economia com o mesmo motor das propostas (fio B, taxa
 * mínima e iluminação pública inclusos). Não mostra preço: isso é papel do consultor.
 */
import { DEFAULT_INPUTS } from "./defaults.ts";
import { calcEnergy, type ConnectionType } from "./pricing.ts";

export const QUICK_MODULE_W = 610;
const MODULE_AREA_M2 = 2.7;

export interface QuickParams {
  bill: number; // R$ por mês
  connectionType?: ConnectionType;
  tariff?: number;
  sunHours?: number;
  fioBTariff?: number;
  publicLighting?: number;
}

export function quickEstimate(p: QuickParams) {
  const tariff = p.tariff || DEFAULT_INPUTS.tariff;
  const sunHours = p.sunHours || DEFAULT_INPUTS.sunHours;
  const lighting = p.publicLighting ?? DEFAULT_INPUTS.publicLighting;
  const connectionType = p.connectionType ?? "bi";
  const consumption = Math.max(0, Math.round((Math.max(0, p.bill) - lighting) / tariff));
  const kwpNeeded = consumption / (sunHours * 30 * DEFAULT_INPUTS.performanceRatio);
  const modules = Math.max(consumption > 0 ? 4 : 0, Math.ceil((kwpNeeded * 1000) / QUICK_MODULE_W));
  const energy = calcEnergy(
    {
      ...DEFAULT_INPUTS,
      modulePowerW: QUICK_MODULE_W,
      moduleQty: modules,
      consumptionKwh: consumption,
      tariff,
      sunHours,
      connectionType,
      fioBTariff: p.fioBTariff ?? DEFAULT_INPUTS.fioBTariff,
      publicLighting: lighting,
    },
    0,
  );
  return {
    consumption,
    kwp: (modules * QUICK_MODULE_W) / 1000,
    modules,
    areaM2: Math.round(modules * MODULE_AREA_M2),
    generation: Math.round(energy.monthlyGeneration),
    billBefore: energy.monthlyBillBefore,
    billAfter: energy.monthlyBillAfter,
    monthlySavings: energy.monthlySavings,
    savingsPct: energy.savingsPct,
    annualSavings: energy.annualSavings,
    savings25y: energy.savings25y,
    co2Tons25y: energy.co2TonsPerYear * 25,
    trees: energy.treesEquivalent,
  };
}

export type QuickEstimate = ReturnType<typeof quickEstimate>;
