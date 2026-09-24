import { test } from "node:test";
import assert from "node:assert/strict";
import { calcSave, chargeHours, costPerKm, effectiveKw, mergeSave } from "./save.ts";

const base = mergeSave({ roundTo: 0, commission: { mode: "fixed", value: 0 }, tax: { mode: "fixed", value: 0 }, profit: { mode: "fixed", value: 1000 } });

test("infraestrutura acompanha a distância", () => {
  const a = calcSave({ ...base, distanceM: 50 });
  const b = calcSave({ ...base, distanceM: 80 });
  assert.equal(b.directCost - a.directCost, 30 * 38);
});

test("itens fora do escopo não entram no custo", () => {
  const all = calcSave(base);
  const noSocket = calcSave({ ...base, includeSocket: false });
  assert.equal(all.directCost - noSocket.directCost, 220);
});

test("formação de preço igual à solar", () => {
  const r = calcSave(base);
  assert.equal(r.finalPrice, r.directCost + 1000);
  const pctR = calcSave({ ...base, profit: { mode: "percent", value: 20 } });
  assert.ok(Math.abs(pctR.finalPrice - pctR.directCost / 0.8) < 0.01);
});

test("recarga limitada pelo carregador de bordo", () => {
  assert.equal(effectiveKw(22, 11), 11);
  assert.equal(effectiveKw(7.4, 11), 7.4);
  assert.ok(Math.abs(chargeHours(60, 11) - 36 / 9.9) < 1e-9);
});

test("custo por km elétrico × combustão", () => {
  const c = costPerKm({ ...base, evKwhPer100km: 17, energyTariff: 1, fuelPrice: 6, kmPerLiter: 10, kmPerMonth: 1000 });
  assert.equal(c.evPer100, 17);
  assert.equal(c.icePer100, 60);
  assert.equal(c.savingMonth, 430);
});
