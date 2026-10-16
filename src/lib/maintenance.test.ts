import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MAINT, kwpOf, maintTotal, mergeMaint, soilingLoss } from "./maintenance.ts";

test("valor final é placas × valor por placa", () => {
  assert.equal(maintTotal({ moduleQty: 16, pricePerModule: 25 }), 400);
  assert.equal(maintTotal({ moduleQty: 10, pricePerModule: 22.5 }), 225);
  assert.equal(kwpOf({ moduleQty: 20, modulePowerW: 550 }), 11);
});

test("padrões: serviços inclusos e peças se necessário", () => {
  const i = mergeMaint({});
  assert.ok(i.services.includes("limpeza"));
  assert.ok(!i.services.includes("termografia"));
  assert.deepEqual(i.parts, DEFAULT_MAINT.parts);
});

test("orçamentos antigos sem as listas novas recebem os padrões", () => {
  const i = mergeMaint({ services: undefined as unknown as string[], moduleQty: 8 });
  assert.ok(i.services.length > 0);
  assert.equal(i.moduleQty, 8);
});

test("perda por sujeira", () => {
  const loss = soilingLoss({ moduleQty: 10, modulePowerW: 500, sunHours: 5, performanceRatio: 0.8, soilingPct: 10, tariff: 1 });
  assert.equal(Math.round(loss.monthlyKwh), 600);
  assert.equal(Math.round(loss.lostMonth), 60);
});
