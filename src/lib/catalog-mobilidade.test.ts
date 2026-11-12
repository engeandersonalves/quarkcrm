import { test } from "node:test";
import assert from "node:assert/strict";
import { SCOOTERS, chargeCost, fuelSavings, recommend } from "./catalog-mobilidade.ts";

test("preços do catálogo batem: 21 parcelas = total a prazo (arredondado)", () => {
  for (const s of SCOOTERS) assert.ok(Math.abs(s.installment * s.installments - s.total) <= 21, s.name);
});

test("carga custa menos de R$ 2 (estimativa do catálogo)", () => {
  assert.ok(chargeCost() < 2);
});

test("economia de combustível", () => {
  const r = fuelSavings({ kmDay: 30, days: 20, fuel: 7, kmL: 35, tariff: 1, kmPerCharge: 50, kwh: 1.25 });
  assert.equal(r.km, 600);
  assert.equal(Math.round(r.gas), 120);
  assert.equal(Math.round(r.electric), 15);
  assert.equal(Math.round(r.saved), 105);
});

test("quiz recomenda o modelo certo", () => {
  assert.equal(recommend({ use: "trabalho", km: "curto", style: "pratico" }), "t1");
  assert.equal(recommend({ use: "passeio", km: "medio", style: "classico" }), "cappuccino");
  assert.equal(recommend({ use: "longo", km: "longo", style: "esportivo" }), "mz");
});
