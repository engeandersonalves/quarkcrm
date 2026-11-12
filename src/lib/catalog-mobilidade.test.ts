import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCOOTERS,
  chargeCost,
  commuteCosts,
  fuelSavings,
  mergeGallery,
  recommend,
} from "./catalog-mobilidade.ts";

test("preços do catálogo batem: 21 parcelas = total a prazo (arredondado)", () => {
  for (const s of SCOOTERS)
    assert.ok(Math.abs(s.installment * s.installments - s.total) <= 21, s.name);
});

test("carga custa menos de R$ 2 (estimativa do catálogo)", () => {
  assert.ok(chargeCost() < 2);
});

test("economia de combustível", () => {
  const r = fuelSavings({
    kmDay: 30,
    days: 20,
    fuel: 7,
    kmL: 35,
    tariff: 1,
    kmPerCharge: 50,
    kwh: 1.25,
  });
  assert.equal(r.km, 600);
  assert.equal(Math.round(r.gas), 120);
  assert.equal(Math.round(r.electric), 15);
  assert.equal(Math.round(r.saved), 105);
});

test("quiz recomenda o modelo certo", () => {
  assert.equal(
    recommend({ use: "trabalho", km: "curto", style: "pratico" }),
    "t1",
  );
  assert.equal(
    recommend({ use: "passeio", km: "medio", style: "classico" }),
    "cappuccino",
  );
  assert.equal(
    recommend({ use: "longo", km: "longo", style: "esportivo" }),
    "mz",
  );
});

test("galeria: fotos enviadas vêm primeiro, sem repetir", () => {
  const base = SCOOTERS[1].gallery;
  assert.ok(base.length >= 3);
  const g = mergeGallery(base, [
    { url: "https://x/1.jpg", caption: " Frente " },
    { url: base[0].src, caption: null },
  ]);
  assert.equal(g[0].src, "https://x/1.jpg");
  assert.equal(g[0].caption, "Frente");
  assert.equal(g[0].fit, "cover");
  assert.equal(g.length, base.length + 1);
  for (const s of SCOOTERS) assert.ok(s.gallery.length >= 2, s.name);
});

test("comparativo de transporte: scooter é a mais barata", () => {
  const c = commuteCosts({ kmDay: 30, days: 22, fuel: 6.3, bus: 5 });
  const by = Object.fromEntries(c.map((x) => [x.id, x.month]));
  assert.equal(by.onibus, 220);
  assert.ok(
    by.scooter < by.moto && by.moto < by.carro && by.scooter < by.onibus,
  );
  assert.ok(by.scooter > 0 && by.scooter < 60);
});
