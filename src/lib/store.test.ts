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

import { campaignLive, defaultProducts, normalizeCode, stackPct, toProduct, totalPct } from "./store.ts";

test("descontos: soma produto + campanha e empilha o cupom", () => {
  assert.equal(totalPct(10, 5), 15);
  assert.equal(totalPct(80, 30), 90);
  assert.equal(stackPct(10, 10), 19);
  assert.equal(stackPct(0, 15), 15);
  assert.equal(normalizeCode(" black 10! "), "BLACK10");
});

test("campanha só vale dentro do período", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  assert.equal(campaignLive({ active: true, starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-30T00:00:00Z" }, now), true);
  assert.equal(campaignLive({ active: true, starts_at: "2026-12-01T00:00:00Z", ends_at: "2026-12-30T00:00:00Z" }, now), false);
  assert.equal(campaignLive({ active: false, starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-30T00:00:00Z" }, now), false);
});

test("catálogo padrão e saneamento de produtos", () => {
  const all = defaultProducts();
  assert.ok(all.length >= 30);
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  assert.ok(all.every((p) => p.discount_pct === 0 && p.sold === 0));
  const p = toProduct({ id: "x", name: "Moto", category: "zzz", discount_pct: 150, images: ["a.jpg", "", 3], specs: [{ label: "A", value: "1" }, { label: "", value: "2" }] });
  assert.equal(p?.category, "kit");
  assert.equal(p?.discount_pct, 90);
  assert.deepEqual(p?.images, ["a.jpg"]);
  assert.equal(p?.specs.length, 1);
  assert.equal(toProduct({ name: "sem id" }), null);
});

test("resumo com cupom e campanha", () => {
  const txt = quoteSummary([{ key: "p:1", kind: "kit", title: "Kit X", detail: "", pct: 10 }], "", { code: "BLACK10", discount_pct: 10 }, "Black Friday");
  assert.match(txt, /10% OFF \+ cupom = 19% OFF/);
  assert.match(txt, /Cupom: BLACK10/);
  assert.match(txt, /Campanha: Black Friday/);
});
