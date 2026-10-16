import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClientItems, calcMaint, kwpOf, mergeMaint, planOf, qtyOf, soilingLoss } from "./maintenance.ts";

const flat = { roundTo: 0, commission: { mode: "fixed" as const, value: 0 }, tax: { mode: "fixed" as const, value: 0 }, profit: { mode: "fixed" as const, value: 0 } };

test("quantidades acompanham o sistema", () => {
  const i = mergeMaint({ moduleQty: 20, stringQty: 3, inverterQty: 2, distanceKm: 15 });
  const by = (k: string) => i.extraCosts.find((x) => x.key === k)!;
  assert.equal(qtyOf(by("limpeza"), i), 20);
  assert.equal(qtyOf(by("conectores"), i), 3);
  assert.equal(qtyOf(by("inversor"), i), 2);
  assert.equal(qtyOf(by("aterramento"), i), 1);
  assert.equal(qtyOf(by("deslocamento"), i), 30);
  assert.equal(kwpOf(i), 11);
});

test("só serviços ligados entram no custo e o preço por serviço fecha com o total", () => {
  const i = mergeMaint({ ...flat, profit: { mode: "percent", value: 30 }, moduleQty: 10 });
  const r = calcMaint(i);
  const off = calcMaint({ ...i, extraCosts: i.extraCosts.map((x) => (x.key === "limpeza" ? { ...x, on: false } : x)) });
  assert.equal(r.directCost - off.directCost, 10 * 12);
  const sum = r.lines.reduce((t, l) => t + l.price, 0);
  assert.ok(Math.abs(sum - r.finalPrice) < 0.01);
});

test("proposta pública não leva custos nem deslocamento", () => {
  const i = mergeMaint({ ...flat, showItemPrices: false });
  const items = buildClientItems(i, calcMaint(i));
  assert.ok(items.every((x) => x.price === null));
  assert.ok(!items.some((x) => x.key === "deslocamento"));
  assert.ok(items.find((x) => x.key === "dps")?.conditional);
  const shown = buildClientItems({ ...i, showItemPrices: true }, calcMaint(i));
  assert.ok(shown.every((x) => typeof x.price === "number"));
});

test("perda por sujeira e plano recorrente", () => {
  const loss = soilingLoss({ moduleQty: 10, modulePowerW: 500, sunHours: 5, performanceRatio: 0.8, soilingPct: 10, tariff: 1 });
  assert.equal(Math.round(loss.monthlyKwh), 600);
  assert.equal(Math.round(loss.lostMonth), 60);
  const plan = planOf(1000, { planEnabled: true, planVisitsYear: 2, planDiscountPct: 15, roundTo: 10 })!;
  assert.equal(plan.perVisit, 850);
  assert.equal(plan.year, 1700);
  assert.equal(plan.saving, 300);
  assert.equal(planOf(1000, { planEnabled: false, planVisitsYear: 2, planDiscountPct: 15, roundTo: 10 }), null);
});

test("orçamentos antigos recebem serviços novos desligados", () => {
  const i = mergeMaint({ extraCosts: [{ id: "limpeza", key: "limpeza", label: "Limpeza", qty: 1, unit: 10, value: 0, on: true }] });
  assert.ok(i.extraCosts.length > 1);
  assert.ok(i.extraCosts.filter((x) => x.key !== "limpeza").every((x) => !x.on));
});
