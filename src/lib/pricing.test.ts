import { test } from "node:test";
import assert from "node:assert/strict";
import { calcPricing, calcEnergy, pmt } from "./pricing.ts";
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
  const e = calcEnergy(inputs, 20000);
  assert.ok(Math.abs(e.monthlyGeneration - 5.5 * 5 * 0.8 * 365 / 12) < 15);
  assert.ok(e.paybackYears > 2 && e.paybackYears < 4);
  assert.ok(e.monthlyBillAfter >= 50);
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
