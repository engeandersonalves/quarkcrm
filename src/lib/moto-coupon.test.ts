import { test } from "node:test";
import assert from "node:assert/strict";
import { couponData, cv } from "./moto-coupon.ts";
import { defaultMoto } from "./moto-sale.ts";

const contractor = { name: "Q", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };

function sale() {
  const d = defaultMoto({ contractor, model: "a2" });
  d.price = 6399;
  d.color = "Bege";
  d.chassis = "lw123";
  d.motorNo = "m9";
  d.accessories = [
    { id: "a", name: "Capacete", qty: 1, price: 0 },
    { id: "b", name: "Baú", qty: 1, price: 150 },
  ];
  d.freight = 0;
  d.discount = 49;
  d.delivery = { mode: "retirada", address: "", date: "2026-11-20" };
  return d;
}

test("cupom: itens numerados, números da scooter, cortesia e totais", () => {
  const d = sale();
  d.payment = { ...d.payment, method: "pix" };
  const c = couponData(d, "abcdef12-3456-7890-abcd-ef1234567890", []);
  assert.deepEqual(c.items.map((i) => i.n), ["001", "002", "003"]);
  assert.equal(c.items[0].label, "SCOOTER ELÉTRICA A2");
  assert.ok(c.items[0].details.includes("Chassi LW123"));
  assert.ok(c.items[0].details.includes("Motor M9"));
  assert.equal(c.items[1].courtesy, true);
  assert.equal(c.subtotal, 6399 + 150);
  assert.equal(c.cash, 6399 + 150 - 49);
  assert.equal(c.total, c.cash);
  assert.equal(c.charges, 0);
  assert.equal(c.paidSoFar, null);
  assert.match(c.warranty, /90 dias · até 18\/02\/2027/);
  assert.equal(cv(6399), "6.399,00");
});

test("cupom: pagamentos lançados (misto), encargos do cartão, pago e em aberto", () => {
  const d = sale();
  const c = couponData(
    d,
    "x",
    [
      { method: "pix", amount: 2000, installments: null, date: "2026-11-10", paid: true },
      { method: "cartao", amount: 5000, installments: 10, date: "2026-11-30", paid: false },
    ],
    "2026-11-21",
  );
  assert.equal(c.pay.length, 2);
  assert.equal(c.pay[0].status, "pago");
  assert.equal(c.pay[1].status, "a vencer");
  assert.match(c.pay[1].detail, /10x de 500,00/);
  assert.equal(c.total, 7000);
  assert.equal(c.charges, 7000 - c.cash);
  assert.equal(c.paidSoFar, 2000);
  assert.equal(c.open, 5000);
});

test("cupom: sem pagamentos lançados usa o combinado no contrato", () => {
  const d = sale();
  d.payment = { ...d.payment, method: "cartao", installments: 21, installmentValue: 380 };
  const c = couponData(d, "x", []);
  assert.equal(c.pay[0].label, "Cartão de crédito");
  assert.equal(c.total, 21 * 380);
  assert.equal(c.charges, 21 * 380 - c.cash);
});
