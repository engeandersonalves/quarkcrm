import { test } from "node:test";
import assert from "node:assert/strict";
import { firstNumber, installmentTable, installmentValue, parseMoney, parseProducts, priceForMargin, productToScooter, profitOf, seedProducts } from "./moto-products.ts";
import { SCOOTERS } from "./catalog-mobilidade.ts";

test("parcela na Tabela Price a 2,10% a.m.", () => {
  assert.equal(installmentValue(6799, 21, 2.1), 403.72);
  assert.equal(installmentValue(1000, 1, 2.1), 1000);
  assert.equal(installmentValue(1200, 12, 0), 100);
  const t = installmentTable(6799, 2.1, 21);
  assert.deepEqual(t.map((r) => r.n), [1, 3, 6, 10, 12, 18, 21]);
  assert.equal(t[t.length - 1].total, Math.round(403.72 * 21 * 100) / 100);
});

test("lucro por scooter: custos, impostos e comissão", () => {
  const r = profitOf({ price: 6799, costs: { purchase: 3900, freight: 250, assembly: 120, accessories: 150, other: 80, taxPct: 6, commissionPct: 3 } });
  assert.equal(r.cost, 4500);
  assert.equal(r.taxes, 407.94);
  assert.equal(r.commission, 203.97);
  assert.equal(r.profit, 1687.09);
  assert.equal(r.margin, 24.81);
  assert.equal(r.markup, 51.09);
  // preço sugerido para 25% de margem fica no "…9"
  const sug = priceForMargin({ purchase: 3900, freight: 250, assembly: 120, accessories: 150, other: 80, taxPct: 6, commissionPct: 3 }, 25);
  assert.equal(sug % 10, 9);
  assert.ok(profitOf({ price: sug, costs: { purchase: 3900, freight: 250, assembly: 120, accessories: 150, other: 80, taxPct: 6, commissionPct: 3 } }).margin >= 25);
});

test("valores e números escritos de vários jeitos", () => {
  assert.equal(parseMoney("R$ 6.799,00"), 6799);
  assert.equal(parseMoney("6799"), 6799);
  assert.equal(parseMoney("R$ 4,2 mil"), 4200);
  assert.equal(parseMoney("1.250"), 1250);
  assert.equal(parseMoney("385.50"), 385.5);
  assert.equal(firstNumber("1.000W"), 1000);
  assert.equal(firstNumber("60 a 80 km"), 80);
});

test("vários modelos de uma vez a partir de texto", () => {
  const list = parseProducts(`Modelo: SPRINT 1200
Categoria: A esportiva urbana
Motor: 1.000W
Bateria: Lítio 72V 30Ah
Autonomia: 90 km
Velocidade: 32 km/h
Recarga: 6 a 8 h
Carga máxima: 180 kg
Freios: disco nas duas rodas
Peso: 75 kg
Cores: preta, cinza e azul
Custo de compra: R$ 4.900
Frete: 300
Montagem: 150
Impostos: 6%
Comissão: 3%
Preço à vista: R$ 7.990
Parcelas: 21x
---
Modelo: Bolt Mini
Motor 800W
Bateria 60V 20Ah lítio
Autonomia 50 km
Custo: 3.200
Preço: 5.490`);
  assert.equal(list.length, 2);
  const [a, b] = list.map((x) => x.product);
  assert.equal(a.name, "Sprint 1200");
  assert.equal(a.slug, "sprint-1200");
  assert.equal(a.kicker, "A esportiva urbana");
  assert.equal(a.specs.battery, "Lítio 72V 30Ah");
  assert.equal(a.specs.load, "180 kg");
  assert.deepEqual(a.colors, ["Preta", "Cinza", "Azul"]);
  assert.equal(a.costs.purchase, 4900);
  assert.equal(a.costs.freight, 300);
  assert.equal(a.costs.assembly, 150);
  assert.equal(a.costs.taxPct, 6);
  assert.equal(a.costs.commissionPct, 3);
  assert.equal(a.price, 7990);
  assert.equal(a.installments, 21);
  assert.equal(b.name, "Bolt Mini");
  assert.equal(b.specs.power, "800W");
  assert.equal(b.specs.range, "50 km");
  assert.equal(b.costs.purchase, 3200);
  assert.equal(b.price, 5490);
});

test("texto corrido sem rótulos, um modelo por parágrafo", () => {
  const list = parseProducts(`Urban X
1000W
Lítio 60V 25Ah
70 km
32 km/h

City Lite
500W
Lítio 48V 15Ah
40 km
25 km/h`);
  assert.equal(list.length, 2);
  assert.equal(list[0].product.name, "Urban X");
  assert.equal(list[0].product.specs.speed, "32 km/h");
  assert.equal(list[1].product.specs.battery, "Lítio 48V 15Ah");
});

test("produto vira modelo do catálogo online com a parcela do catálogo", () => {
  const p = seedProducts().find((m) => m.slug === "t1")!;
  const s = productToScooter({ ...p, id: "x" });
  assert.equal(s.id, "t1");
  assert.equal(s.cash, 6799);
  assert.equal(Math.round(s.installment), 385);
  assert.equal(s.table.Bateria, "Lítio 64V 20Ah");
  assert.equal(s.specs.length, 6);
});

test("catálogo de 5 modelos: a taxa de cada modelo dá exatamente a parcela e o total do PDF", () => {
  const models = seedProducts();
  assert.deepEqual(models.map((m) => m.slug), ["a2", "t1", "city", "cappuccino", "mz"]);
  for (const s of SCOOTERS) {
    const p = models.find((m) => m.slug === s.id)!;
    assert.equal(p.price, s.cash, s.id);
    assert.equal(Math.round(installmentValue(p.price, 21, p.rate)), s.installment, s.id);
    assert.equal(Math.round(installmentValue(p.price, 21, p.rate)) * 21, s.total, s.id);
  }
});
