import { test } from "node:test";
import assert from "node:assert/strict";
import { BF_END, BF_START, SOLAR_KITS, bfMessage, bfPhase, bfSegment, timeLeft } from "./black-friday.ts";

test("fase da campanha e alvo da contagem", () => {
  const s = new Date(BF_START).getTime();
  const e = new Date(BF_END).getTime();
  assert.deepEqual(bfPhase(s - 1000), { phase: "antes", target: s });
  assert.deepEqual(bfPhase(s + 1000), { phase: "durante", target: e });
  assert.deepEqual(bfPhase(e + 1000), { phase: "encerrada", target: null });
});

test("antecipada: começa dia 10 e termina dia 27 no horário de Brasília", () => {
  assert.equal(new Date(BF_START).toISOString(), "2026-11-10T03:00:00.000Z");
  assert.equal(new Date(BF_END).toISOString(), "2026-11-28T02:59:59.000Z");
});

test("tempo restante", () => {
  const t = timeLeft(Date.UTC(2026, 0, 2, 3, 4, 5), Date.UTC(2026, 0, 1));
  assert.deepEqual(t, { d: 1, h: 3, m: 4, s: 5, done: false });
  assert.equal(timeLeft(0, 10).done, true);
});

test("kits em ordem e um destaque principal", () => {
  const kwh = SOLAR_KITS.map((k) => k.kwh);
  assert.deepEqual(kwh, [...kwh].sort((a, b) => a - b));
  assert.ok(SOLAR_KITS.every((k) => k.installment * k.installments >= k.cash * 0.9));
});

test("mensagem e segmento", () => {
  assert.match(bfMessage(["Kit 700 kWh"], "Ana"), /meu nome é Ana[\s\S]*• Kit 700 kWh/);
  assert.match(bfMessage([]), /conhecer as ofertas/);
  assert.equal(bfSegment(["solar", "wallbox"]), "ambos");
  assert.equal(bfSegment(["wallbox"]), "save");
  assert.equal(bfSegment(["moto"]), "solar");
});
