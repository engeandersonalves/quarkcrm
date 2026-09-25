import assert from "node:assert/strict";
import { test } from "node:test";
import { quickEstimate } from "./quick-estimate.ts";

test("conta de R$ 600 gera sistema e economia coerentes", () => {
  const r = quickEstimate({ bill: 600, tariff: 0.95, sunHours: 5.2 });
  assert.ok(r.consumption > 550 && r.consumption < 650);
  assert.ok(r.modules >= 6 && r.modules <= 10, `placas: ${r.modules}`);
  assert.ok(r.billAfter > 50 && r.billAfter < 200, `conta depois: ${r.billAfter}`);
  assert.ok(r.monthlySavings > 350 && r.monthlySavings < 560);
  assert.ok(r.savings25y > r.annualSavings * 20);
});

test("conta muito baixa não quebra", () => {
  const r = quickEstimate({ bill: 20 });
  assert.equal(r.consumption, 0);
  assert.equal(r.modules, 0);
});
