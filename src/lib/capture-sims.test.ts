import assert from "node:assert/strict";
import { test } from "node:test";
import { evCompare, maintenanceSim, stationCapacity, stationSim } from "./capture-sims.ts";

test("carro elétrico sai bem mais barato que gasolina", () => {
  const r = evCompare({ kmMonth: 1500, kmPerLiter: 10, tariff: 0.95 });
  assert.ok(Math.abs(r.gasMonth - 943.5) < 0.01);
  assert.ok(r.evMonth > 200 && r.evMonth < 260);
  assert.ok(r.times > 3.5);
});

test("eletroposto respeita a capacidade do carregador e calcula retorno", () => {
  assert.equal(stationCapacity(40), 18);
  const r = stationSim({ power: 40, sessionsDay: 99, business: "posto" });
  assert.equal(r.sessions, 18);
  assert.ok(r.net > 0 && r.paybackMonths > 0);
  assert.equal(r.crossSell, 18 * 30 * 0.6 * 35);
});

test("usina suja perde geração proporcional ao tempo sem limpeza", () => {
  const nunca = maintenanceSim({ kwp: 10, last: "nunca" });
  const recente = maintenanceSim({ kwp: 10, last: "menos6" });
  assert.ok(nunca.lossMonth > recente.lossMonth * 5);
});
