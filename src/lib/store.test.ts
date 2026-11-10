import { test } from "node:test";
import assert from "node:assert/strict";
import { KITS, kitKwp, quoteSummary, segmentOf, sizeSystem } from "./store.ts";

test("dimensiona pela conta de luz descontando a taxa mínima", () => {
  const s = sizeSystem({ bill: 500, tariff: 1, grid: "bi", sunHours: 5 });
  // 500 kWh - 50 mínimos = 450 kWh / (5 × 30 × 0,8) = 3,75 kWp → 7 placas de 610 W
  assert.equal(s.kwh, 500);
  assert.equal(s.modules, 7);
  assert.equal(s.kwp, kitKwp(7));
  assert.ok(s.generation >= 450);
  assert.ok(s.savingPct > 80 && s.savingPct <= 95);
  assert.equal(s.kit?.place, "casa");
  assert.ok((s.kit?.modules ?? 0) >= 7);
});

test("conta zerada não sugere sistema", () => {
  const s = sizeSystem({ bill: 0 });
  assert.equal(s.modules, 0);
  assert.equal(s.kit, null);
});

test("consumo maior que o maior kit usa o maior kit do tipo", () => {
  const s = sizeSystem({ kwh: 100000, place: "comercio" });
  assert.equal(s.kit?.id, KITS.filter((k) => k.place === "comercio").at(-1)?.id);
});

test("segmento e resumo do pedido", () => {
  const kit = { key: "kit:casa-5", kind: "kit" as const, title: "Casa Conforto", detail: "5,49 kWp" };
  const ev = { key: "charger:wb-7", kind: "charger" as const, title: "Wallbox", detail: "" };
  const clean = { key: "service:limpeza", kind: "service" as const, title: "Limpeza", detail: "" };
  assert.equal(segmentOf([kit]), "solar");
  assert.equal(segmentOf([kit, ev]), "ambos");
  assert.equal(segmentOf([ev]), "eletroposto");
  assert.equal(segmentOf([clean]), "manutencao");
  const txt = quoteSummary([kit, ev], "Ligar à tarde");
  assert.match(txt, /Casa Conforto \(5,49 kWp\)/);
  assert.match(txt, /Ligar à tarde/);
  assert.ok(txt.length < 2000);
});
