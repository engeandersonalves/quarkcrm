/**
 * Motor de cálculo de orçamentos fotovoltaicos.
 *
 * Regra de formação de preço:
 *   custo direto  = kit + mão de obra (R$/placa × placas) + material elétrico (R$/kWp × kWp) + outros custos
 *   comissão, imposto e lucro podem ser em R$ (valor fixo) ou em % sobre o PREÇO FINAL de venda.
 *   preço final   = (custo direto + parcelas fixas) / (1 − Σ percentuais)
 *
 * Usar % sobre o preço final (e não sobre o custo) garante que, depois de pagar
 * comissão e imposto, o lucro que sobra é exatamente o percentual definido.
 */

export type AmountMode = "percent" | "fixed";

export interface PriceComponent {
  mode: AmountMode;
  value: number;
}

export interface ExtraCost {
  id: string;
  label: string;
  value: number;
}

export type ConnectionType = "mono" | "bi" | "tri";

export interface ProposalInputs {
  // Equipamentos
  kitPrice: number;
  inverterBrand: string;
  inverterModel: string;
  inverterPowerKw: number;
  inverterQty: number;
  moduleBrand: string;
  moduleModel: string;
  modulePowerW: number;
  moduleQty: number;
  structureType: string;

  // Custos
  laborPerModule: number;
  electricalPerKwp: number;
  extraCosts: ExtraCost[];

  // Formação de preço
  commission: PriceComponent;
  tax: PriceComponent;
  profit: PriceComponent;
  discount: number; // desconto em R$ concedido ao cliente (sai do lucro)
  roundTo: number; // arredondar preço final (0 = não arredondar)

  // Energia e economia
  consumptionKwh: number;
  tariff: number; // R$/kWh
  connectionType: ConnectionType;
  sunHours: number; // HSP médio anual (kWh/m²/dia)
  performanceRatio: number; // 0–1
  tariffIncrease: number; // % ao ano
  degradation: number; // % ao ano
  selfConsumption: number; // % da geração consumida na hora (simultaneidade), 0–100
  fioBTariff: number; // R$/kWh da TUSD Fio B da distribuidora (com impostos)
  publicLighting: number; // R$/mês de contribuição de iluminação pública

  // Condições comerciais
  financingRate: number; // % ao mês
  financingTerms: number[];
  cardInstallments: number;
  cardRate: number; // % ao mês
  validityDays: number;
  installationDays: number; // dias do pagamento até a homologação final
  paymentNotes: string;
  notes: string;
}

export interface CostLine {
  key: string;
  label: string;
  detail?: string;
  value: number;
}

export interface PricingResult {
  powerKwp: number;
  inverterTotalKw: number;
  dcAcRatio: number;
  lines: CostLine[];
  directCost: number;
  commissionValue: number;
  taxValue: number;
  profitValue: number;
  discountValue: number;
  roundingAdjust: number;
  finalPrice: number;
  pricePerWp: number;
  netMargin: number; // lucro / preço final
  markup: number; // preço final / custo direto
  valid: boolean;
  error?: string;
}

export interface EnergyResult {
  monthlyGeneration: number; // kWh/mês (média)
  annualGeneration: number;
  monthly: { month: string; generation: number; consumption: number }[];
  coverage: number; // % do consumo coberto
  availabilityKwh: number;
  monthlyBillBefore: number;
  monthlyBillAfter: number;
  bill: BillBreakdown;
  fioBPct: number; // percentual do fio B cobrado no 1º ano
  monthlySavings: number;
  savingsPct: number;
  annualSavings: number;
  savings25y: number;
  paybackYears: number;
  roi25y: number; // multiplicador do investimento
  cashflow: { year: number; savings: number; cumulative: number }[];
  co2TonsPerYear: number;
  treesEquivalent: number;
  requiredModulesForConsumption: number;
}

export interface FinancingOption {
  months: number;
  installment: number;
  total: number;
}

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Perfil sazonal típico de irradiação no Brasil (normalizado para média 1).
const SEASONAL_RAW = [1.1, 1.09, 1.02, 0.94, 0.86, 0.82, 0.87, 0.97, 0.99, 1.05, 1.1, 1.12];
const SEASONAL_MEAN = SEASONAL_RAW.reduce((a, b) => a + b, 0) / 12;
export const SEASONAL = SEASONAL_RAW.map((f) => f / SEASONAL_MEAN);
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const AVAILABILITY_KWH: Record<ConnectionType, number> = { mono: 30, bi: 50, tri: 100 };

// Fator de emissão médio do SIN (tCO2/MWh) e absorção média de uma árvore (tCO2/ano).
const GRID_EMISSION_T_PER_MWH = 0.0385;
const CO2_PER_TREE_T_YEAR = 0.0072;

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

export function componentValue(c: PriceComponent, finalPrice: number) {
  return c.mode === "percent" ? (finalPrice * n(c.value)) / 100 : n(c.value);
}

export function calcPricing(i: ProposalInputs): PricingResult {
  const powerKwp = (n(i.modulePowerW) * n(i.moduleQty)) / 1000;
  const inverterTotalKw = n(i.inverterPowerKw) * Math.max(1, n(i.inverterQty) || 1);
  const dcAcRatio = inverterTotalKw > 0 ? powerKwp / inverterTotalKw : 0;

  const labor = n(i.laborPerModule) * n(i.moduleQty);
  const electrical = n(i.electricalPerKwp) * powerKwp;

  const lines: CostLine[] = [
    { key: "kit", label: "Kit fotovoltaico", detail: [i.moduleBrand, i.inverterBrand].filter(Boolean).join(" + "), value: n(i.kitPrice) },
    { key: "labor", label: "Mão de obra", detail: `${fmtNum(n(i.moduleQty))} placas × ${brl(n(i.laborPerModule))}`, value: labor },
    { key: "electrical", label: "Material elétrico", detail: `${fmtNum(powerKwp, 2)} kWp × ${brl(n(i.electricalPerKwp))}`, value: electrical },
    ...(i.extraCosts ?? [])
      .filter((e) => n(e.value) !== 0 || e.label)
      .map((e) => ({ key: `extra-${e.id}`, label: e.label || "Outro custo", value: n(e.value) })),
  ];

  const directCost = lines.reduce((s, l) => s + l.value, 0);
  const comps = [i.commission, i.tax, i.profit];
  const pctSum = comps.filter((c) => c.mode === "percent").reduce((s, c) => s + n(c.value), 0);
  const fixedSum = comps.filter((c) => c.mode === "fixed").reduce((s, c) => s + n(c.value), 0);

  const base: PricingResult = {
    powerKwp,
    inverterTotalKw,
    dcAcRatio,
    lines,
    directCost,
    commissionValue: 0,
    taxValue: 0,
    profitValue: 0,
    discountValue: 0,
    roundingAdjust: 0,
    finalPrice: 0,
    pricePerWp: 0,
    netMargin: 0,
    markup: 0,
    valid: true,
  };

  if (pctSum >= 100) {
    return { ...base, valid: false, error: "A soma dos percentuais (comissão + imposto + lucro) precisa ser menor que 100%." };
  }

  const grossPrice = (directCost + fixedSum) / (1 - pctSum / 100);
  const discount = Math.max(0, n(i.discount));
  let finalPrice = grossPrice - discount;
  let roundingAdjust = 0;
  if (n(i.roundTo) > 0 && finalPrice > 0) {
    const rounded = Math.ceil(finalPrice / i.roundTo) * i.roundTo;
    roundingAdjust = rounded - finalPrice;
    finalPrice = rounded;
  }

  // Comissão e imposto acompanham o preço final efetivo; o lucro absorve desconto e arredondamento.
  const commissionValue = componentValue(i.commission, finalPrice);
  const taxValue = componentValue(i.tax, finalPrice);
  const profitValue = finalPrice - directCost - commissionValue - taxValue;

  return {
    ...base,
    commissionValue: round2(commissionValue),
    taxValue: round2(taxValue),
    profitValue: round2(profitValue),
    discountValue: discount,
    roundingAdjust: round2(roundingAdjust),
    finalPrice: round2(finalPrice),
    pricePerWp: powerKwp > 0 ? finalPrice / (powerKwp * 1000) : 0,
    netMargin: finalPrice > 0 ? profitValue / finalPrice : 0,
    markup: directCost > 0 ? finalPrice / directCost : 0,
    valid: finalPrice > 0 || directCost === 0,
  };
}

/**
 * Percentual do fio B (TUSD Fio B) cobrado sobre a energia compensada — Lei 14.300/2022,
 * regra de transição para sistemas GD II (conectados a partir de 2023).
 */
export const FIO_B_SCHEDULE: Record<number, number> = { 2023: 0.15, 2024: 0.3, 2025: 0.45, 2026: 0.6, 2027: 0.75, 2028: 0.9 };
export function fioBFactor(year: number) {
  if (year <= 2022) return 0;
  return FIO_B_SCHEDULE[year] ?? 1;
}

export interface BillBreakdown {
  /** Energia da rede que não foi compensada (cobrada integralmente). */
  energyCharge: number;
  /** Fio B sobre a energia compensada pelos créditos. */
  fioBCharge: number;
  /** Complemento para atingir o custo de disponibilidade (taxa mínima). */
  minimumTopUp: number;
  /** Contribuição de iluminação pública (não muda com energia solar). */
  publicLighting: number;
  total: number;
  selfConsumedKwh: number;
  injectedKwh: number;
  compensatedKwh: number;
  gridKwh: number;
}

/**
 * Fatura mensal com energia solar.
 *  - Parte da geração é consumida na hora (simultaneidade) e nem passa pelo medidor.
 *  - O excedente vira crédito e compensa a energia puxada da rede, pagando fio B (percentual do ano).
 *  - A parte de energia nunca fica abaixo do custo de disponibilidade (30/50/100 kWh).
 *  - Iluminação pública é somada à parte.
 */
export function solarBill(
  p: { consumption: number; generation: number; tariff: number; fioB: number; fioBPct: number; selfPct: number; availabilityKwh: number; publicLighting: number },
): BillBreakdown {
  const selfConsumedKwh = Math.min(p.generation * p.selfPct, p.consumption);
  const gridKwh = p.consumption - selfConsumedKwh;
  const injectedKwh = p.generation - selfConsumedKwh;
  const compensatedKwh = Math.min(injectedKwh, gridKwh);
  const energyCharge = (gridKwh - compensatedKwh) * p.tariff;
  const fioBCharge = compensatedKwh * p.fioB * p.fioBPct;
  const minimum = p.availabilityKwh * p.tariff;
  const minimumTopUp = Math.max(0, minimum - energyCharge - fioBCharge);
  return {
    energyCharge,
    fioBCharge,
    minimumTopUp,
    publicLighting: p.publicLighting,
    total: energyCharge + fioBCharge + minimumTopUp + p.publicLighting,
    selfConsumedKwh,
    injectedKwh,
    compensatedKwh,
    gridKwh,
  };
}

export function calcEnergy(i: ProposalInputs, investment: number, startYear = new Date().getFullYear()): EnergyResult {
  const powerKwp = (n(i.modulePowerW) * n(i.moduleQty)) / 1000;
  const pr = n(i.performanceRatio) || 0.8;
  const hsp = n(i.sunHours);
  const consumption = n(i.consumptionKwh);
  const tariff = n(i.tariff);
  const fioB = n(i.fioBTariff);
  const lighting = n(i.publicLighting);
  const selfPct = Math.min(100, Math.max(0, n(i.selfConsumption))) / 100;
  const availabilityKwh = AVAILABILITY_KWH[i.connectionType] ?? 50;
  const inc = n(i.tariffIncrease) / 100;
  const deg = n(i.degradation) / 100;

  const monthly = MONTHS.map((month, idx) => ({
    month,
    generation: Math.round(powerKwp * hsp * SEASONAL[idx] * DAYS[idx] * pr),
    consumption: Math.round(consumption),
  }));
  const annualGeneration = monthly.reduce((s, m) => s + m.generation, 0);
  const monthlyGeneration = annualGeneration / 12;

  const billFor = (yearIdx: number) => {
    const esc = Math.pow(1 + inc, yearIdx);
    const before = consumption * tariff * esc + lighting * esc;
    const after = solarBill({
      consumption,
      generation: monthlyGeneration * Math.pow(1 - deg, yearIdx),
      tariff: tariff * esc,
      fioB: fioB * esc,
      fioBPct: fioBFactor(startYear + yearIdx),
      selfPct,
      availabilityKwh,
      publicLighting: lighting * esc,
    });
    return { before, after };
  };

  const first = billFor(0);
  const hasBill = consumption > 0 && tariff > 0;
  const monthlyBillBefore = hasBill ? first.before : 0;
  const billAfter = hasBill ? first.after : solarBill({ consumption: 0, generation: 0, tariff: 0, fioB: 0, fioBPct: 0, selfPct: 0, availabilityKwh: 0, publicLighting: 0 });
  const monthlySavings = hasBill ? Math.max(0, first.before - first.after.total) : 0;

  const cashflow: EnergyResult["cashflow"] = [];
  let cumulative = -investment;
  let payback = 0;
  let paid = investment <= 0;
  let savings25y = 0;
  for (let year = 1; year <= 25; year++) {
    const b = billFor(year - 1);
    const s = hasBill ? Math.max(0, b.before - b.after.total) * 12 : 0;
    const prev = cumulative;
    cumulative += s;
    savings25y += s;
    if (!paid && cumulative >= 0 && s > 0) {
      payback = year - 1 + -prev / s;
      paid = true;
    }
    cashflow.push({ year, savings: Math.round(s), cumulative: Math.round(cumulative) });
  }

  // Placas para gerar todo o consumo (a taxa mínima é paga de qualquer forma).
  const perModuleMonthly = (n(i.modulePowerW) / 1000) * hsp * 30.4 * pr;
  const requiredModulesForConsumption =
    perModuleMonthly > 0 && consumption > 0 ? Math.ceil(Math.max(0, consumption - availabilityKwh) / perModuleMonthly) : 0;

  const co2TonsPerYear = (annualGeneration / 1000) * GRID_EMISSION_T_PER_MWH;

  return {
    monthlyGeneration,
    annualGeneration,
    monthly,
    coverage: consumption > 0 ? Math.min(1.5, monthlyGeneration / consumption) : 0,
    availabilityKwh,
    monthlyBillBefore,
    monthlyBillAfter: billAfter.total,
    bill: billAfter,
    fioBPct: fioBFactor(startYear),
    monthlySavings,
    savingsPct: monthlyBillBefore > 0 ? monthlySavings / monthlyBillBefore : 0,
    annualSavings: monthlySavings * 12,
    savings25y,
    paybackYears: payback,
    roi25y: investment > 0 ? savings25y / investment : 0,
    cashflow,
    co2TonsPerYear,
    treesEquivalent: Math.round(co2TonsPerYear / CO2_PER_TREE_T_YEAR),
    requiredModulesForConsumption,
  };
}

/** Parcela pela Tabela Price. */
export function pmt(principal: number, ratePctMonth: number, months: number) {
  const r = ratePctMonth / 100;
  if (months <= 0) return 0;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function calcFinancing(price: number, ratePct: number, terms: number[]): FinancingOption[] {
  return [...new Set(terms)]
    .filter((m) => m > 0)
    .sort((a, b) => a - b)
    .map((months) => {
      const installment = pmt(price, ratePct, months);
      return { months, installment, total: installment * months };
    });
}

export function brl(v: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(v) ? v : 0);
}

export function fmtNum(v: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    Number.isFinite(v) ? v : 0,
  );
}

export function pct(v: number, digits = 1) {
  return `${fmtNum(v * 100, digits)}%`;
}

/** Taxa interna de retorno anual (bisseção) para o fluxo: −investimento, economia ano 1..N. */
export function irr(investment: number, yearly: number[]) {
  if (investment <= 0 || !yearly.length || yearly.reduce((a, b) => a + b, 0) <= investment) return 0;
  const npv = (r: number) => yearly.reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), -investment);
  let lo = 0;
  let hi = 10;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
