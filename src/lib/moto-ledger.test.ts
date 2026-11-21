import { test } from "node:test";
import assert from "node:assert/strict";
import { costOf, ledgerRow, paySummary, paymentsFromContract, type MotoPayment } from "./moto-ledger.ts";
import { defaultMoto } from "./moto-sale.ts";

const contractor = { name: "Q", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };
const costs = { purchase: 4000, freight: 200, assembly: 100, accessories: 0, other: 0, taxPct: 6, commissionPct: 0 };
const pay = (p: Partial<MotoPayment>): MotoPayment => ({ id: "x", document_id: "d", method: "pix", amount: 0, installments: null, fee: 0, date: null, paid: false, notes: null, position: 0, ...p });

function sale() {
  const d = defaultMoto({ contractor });
  d.price = 7000;
  d.qty = 1;
  d.discount = 0;
  d.freight = 0;
  d.accessories = [];
  d.payment = { ...d.payment, method: "pix" };
  return d;
}

test("custo: modelo com impostos sobre o preço; custo informado tem prioridade", () => {
  const d = sale();
  const c = costOf(d, { costs });
  assert.equal(c.source, "modelo");
  assert.equal(c.total, 4300 + 420);
  assert.equal(costOf(d, { costs }, 5000).total, 5000);
  assert.equal(costOf(d, null).source, null);
});

test("pagamentos: misto, taxas, recebido, em aberto e atrasados", () => {
  const s = paySummary(
    [pay({ method: "pix", amount: 3000, paid: true, date: "2026-11-01" }), pay({ method: "cartao", amount: 4200, fee: 200, date: "2026-11-02" }), pay({ method: "boleto", amount: 0 })],
    "2026-11-10",
  );
  assert.equal(s.method, "Misto");
  assert.equal(s.net, 7000);
  assert.equal(s.received, 3000);
  assert.equal(s.open, 4000);
  assert.equal(s.overdue, 1);
  assert.equal(s.status, "parcial");
  assert.equal(paySummary([]).status, "sem");
});

test("linha da venda: valor final pelos pagamentos e lucro", () => {
  const d = sale();
  const est = ledgerRow(d, [], { costs });
  assert.equal(est.estimated, true);
  assert.equal(est.final, 7000);
  assert.equal(est.profit, 7000 - 4720);
  const real = ledgerRow(d, [pay({ amount: 7400, fee: 400, paid: true })], { costs });
  assert.equal(real.estimated, false);
  assert.equal(real.final, 7000);
  assert.equal(real.pay.status, "pago");
  assert.equal(ledgerRow(d, [], null).profit, null);
});

test("sugestão pelo contrato: entrada + saldo vira duas linhas", () => {
  const d = sale();
  d.payment = { ...d.payment, method: "entrada", entry: 2000, balanceWhen: "na entrega" };
  const lines = paymentsFromContract(d);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].amount + lines[1].amount, 7000);
});
