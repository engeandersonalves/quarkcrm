import { test } from "node:test";
import assert from "node:assert/strict";
import { calcPricing, calcEnergy, fioBFactor, pmt, solarBill } from "./pricing.ts";
import { DEFAULT_INPUTS } from "./defaults.ts";

const base = {
  ...DEFAULT_INPUTS,
  kitPrice: 12000,
  modulePowerW: 550,
  moduleQty: 10,
  inverterPowerKw: 5,
  laborPerModule: 110,
  electricalPerKwp: 120,
  roundTo: 0,
};

test("potência, mão de obra e material elétrico", () => {
  const r = calcPricing(base);
  assert.equal(r.powerKwp, 5.5);
  assert.equal(r.lines.find((l) => l.key === "labor")!.value, 1100);
  assert.equal(r.lines.find((l) => l.key === "electrical")!.value, 660);
  assert.equal(r.directCost, 13760);
});

test("percentuais incidem sobre o preço final", () => {
  const r = calcPricing({ ...base, commission: { mode: "percent", value: 5 }, tax: { mode: "percent", value: 6 }, profit: { mode: "percent", value: 20 } });
  const expected = 13760 / (1 - 0.31);
  assert.ok(Math.abs(r.finalPrice - expected) < 0.01);
  assert.ok(Math.abs(r.profitValue - expected * 0.2) < 0.02);
  assert.ok(Math.abs(r.directCost + r.commissionValue + r.taxValue + r.profitValue - r.finalPrice) < 0.02);
});

test("valores fixos em R$", () => {
  const r = calcPricing({ ...base, commission: { mode: "fixed", value: 1000 }, tax: { mode: "fixed", value: 500 }, profit: { mode: "fixed", value: 3000 } });
  assert.equal(r.finalPrice, 13760 + 4500);
  assert.equal(r.profitValue, 3000);
});

test("desconto e arredondamento saem do lucro", () => {
  const r = calcPricing({ ...base, commission: { mode: "fixed", value: 0 }, tax: { mode: "fixed", value: 0 }, profit: { mode: "fixed", value: 3000 }, discount: 500, roundTo: 100 });
  assert.equal(r.finalPrice, 16300);
  assert.equal(r.profitValue, 16300 - 13760);
});

test("percentual total inválido", () => {
  const r = calcPricing({ ...base, profit: { mode: "percent", value: 95 } });
  assert.equal(r.valid, false);
});

test("energia e payback", () => {
  const inputs = { ...base, consumptionKwh: 700, tariff: 1, sunHours: 5, performanceRatio: 0.8 };
  const e = calcEnergy(inputs, 20000, 2026);
  assert.ok(Math.abs(e.monthlyGeneration - 5.5 * 5 * 0.8 * 365 / 12) < 15);
  assert.ok(e.paybackYears > 2 && e.paybackYears < 6);
  assert.ok(e.monthlyBillAfter >= 50);
});

test("fatura com fio B, taxa mínima e iluminação pública (600 kWh)", () => {
  // 600 kWh/mês, tarifa R$ 1,00, fio B R$ 0,30, 30% simultaneidade, CIP R$ 30, 2026 (60% do fio B)
  const b = solarBill({ consumption: 600, generation: 600, tariff: 1, fioB: 0.3, fioBPct: 0.6, selfPct: 0.3, availabilityKwh: 50, publicLighting: 30 });
  assert.equal(b.selfConsumedKwh, 180);
  assert.equal(b.compensatedKwh, 420);
  assert.ok(Math.abs(b.fioBCharge - 420 * 0.3 * 0.6) < 1e-9); // R$ 75,60
  assert.equal(b.minimumTopUp, 0); // fio B já supera a taxa mínima de R$ 50
  assert.ok(Math.abs(b.total - (75.6 + 30)) < 1e-9); // R$ 105,60 — e não R$ 34
});

test("taxa mínima quando o fio B é pequeno", () => {
  const b = solarBill({ consumption: 300, generation: 300, tariff: 1, fioB: 0.3, fioBPct: 0.15, selfPct: 0.3, availabilityKwh: 50, publicLighting: 0 });
  assert.ok(Math.abs(b.fioBCharge - 210 * 0.3 * 0.15) < 1e-9);
  assert.ok(Math.abs(b.total - 50) < 1e-9);
});

test("sistema menor que o consumo paga a diferença", () => {
  const b = solarBill({ consumption: 600, generation: 400, tariff: 1, fioB: 0.3, fioBPct: 1, selfPct: 0.25, availabilityKwh: 50, publicLighting: 0 });
  // 100 consumidos na hora, 300 compensados, 200 comprados da rede
  assert.ok(Math.abs(b.energyCharge - 200) < 1e-9);
  assert.ok(Math.abs(b.fioBCharge - 90) < 1e-9);
});

test("escalonamento do fio B", () => {
  assert.equal(fioBFactor(2025), 0.45);
  assert.equal(fioBFactor(2026), 0.6);
  assert.equal(fioBFactor(2029), 1);
});

test("parcela price", () => {
  assert.ok(Math.abs(pmt(10000, 1, 12) - 888.49) < 0.01);
  assert.equal(pmt(1200, 0, 12), 100);
});

test("TIR", async () => {
  const { irr } = await import("./pricing.ts");
  // 1000 investidos, 1100 em 1 ano → 10%
  assert.ok(Math.abs(irr(1000, [1100]) - 0.1) < 1e-6);
  assert.equal(irr(1000, [100]), 0);
});
