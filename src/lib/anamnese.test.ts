import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_ANSWERS, anamneseNotes, buildPlan, currentBill, currentKwh, fioBShare, plannedKwh, temperatureOf, type Answers } from "./anamnese.ts";

const R = { tariff: 1, publicLighting: 25, sunHours: 5 };

test("converte conta em kWh e kWh em conta", () => {
  assert.equal(currentKwh({ mode: "bill", value: 525 }, R), 500);
  assert.equal(currentBill({ mode: "kwh", value: 500 }, R), 525);
  assert.equal(currentKwh({ mode: "kwh", value: 380.4 }, R), 380);
});

test("consumo planejado soma aumento e outros imóveis", () => {
  const a: Answers = { ...EMPTY_ANSWERS, mode: "kwh", value: 400, fit: "aumentar", increases: ["ar", "carro"], extraKwh: 50, properties: "2", otherKwh: 300 };
  assert.equal(plannedKwh(a, R), 400 + 150 + 250 + 50 + 300);
  // Se atende, o aumento não entra; com 1 imóvel, os outros não entram.
  assert.equal(plannedKwh({ ...a, fit: "atende", properties: "1" }, R), 400);
});

test("plano: sistema maior quando o cliente quer aumentar", () => {
  const base = buildPlan({ ...EMPTY_ANSWERS, mode: "kwh", value: 400, fit: "atende" }, R);
  const more = buildPlan({ ...EMPTY_ANSWERS, mode: "kwh", value: 400, fit: "aumentar", increases: ["carro"] }, R);
  assert.ok(more.estimate.kwp > base.estimate.kwp);
  assert.ok(more.estimate.monthlySavings > base.estimate.monthlySavings);
  assert.ok(base.costOfWaiting > 0);
  assert.ok(base.paid25y > base.billPlanned * 12 * 25);
});

test("temperatura do lead", () => {
  assert.equal(temperatureOf({ timeline: "agora", payment: "pensar" }), "quente");
  assert.equal(temperatureOf({ timeline: "1-3", payment: "financiamento" }), "quente");
  assert.equal(temperatureOf({ timeline: "1-3", payment: "pensar" }), "morno");
  assert.equal(temperatureOf({ timeline: "naosei", payment: "pensar" }), "frio");
});

test("resumo para o CRM", () => {
  const a: Answers = { ...EMPTY_ANSWERS, mode: "bill", value: 525, fit: "aumentar", increases: ["ar"], roof: "Telhado cerâmico", properties: "2", otherKwh: 200, payment: "financiamento", timeline: "agora" };
  const notes = anamneseNotes(a, buildPlan(a, R), { referral: "João" });
  assert.match(notes, /Consumo atual: 500 kWh/);
  assert.match(notes, /Ar-condicionado/);
  assert.match(notes, /Telhado cerâmico/);
  assert.match(notes, /transferir energia/);
  assert.match(notes, /Financiamento/);
  assert.match(notes, /O mais rápido possível/);
  assert.match(notes, /Indicação: João/);
  assert.ok(notes.length < 2000);
});

test("fio B da Lei 14.300", () => {
  assert.equal(fioBShare(2026), 60);
  assert.equal(fioBShare(2027), 75);
});

test("percentual de redução fica entre 0 e 1 (fração)", () => {
  const plan = buildPlan({ ...EMPTY_ANSWERS, mode: "kwh", value: 500, fit: "atende" }, R);
  assert.ok(plan.estimate.savingsPct > 0.5 && plan.estimate.savingsPct < 1);
});
