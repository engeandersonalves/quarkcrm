import { test } from "node:test";
import assert from "node:assert/strict";
import { buyerIsCompany, paymentSummary, receiptLines, receiptNumber, receiptQrText, receiptTotals } from "./moto-receipt.ts";
import { defaultMoto } from "./moto-sale.ts";

const contractor = { name: "QUARK ENERGIA LTDA", doc: "12345678000195", address: "Rua A, 1", city: "Maceió", state: "AL", cep: "57000000", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };

test("comprovante: itens, cortesia, frete e totais", () => {
  const d = defaultMoto({ contractor, model: "cappuccino" });
  d.chassis = "qk25cap001";
  d.accessories = [
    { id: "a", name: "Capacete", qty: 1, price: 0 },
    { id: "b", name: "Baú", qty: 1, price: 220 },
    { id: "c", name: "", qty: 1, price: 99 },
  ];
  d.freight = 50;
  d.discount = 100;
  const lines = receiptLines(d);
  assert.equal(lines.length, 5);
  assert.match(lines[0].detail ?? "", /chassi QK25CAP001/);
  assert.equal(lines[1].detail, "cortesia");
  assert.equal(lines[3].label, "Acessório");
  assert.equal(lines[4].label, "Entrega");
  const t = receiptTotals(d);
  assert.equal(t.subtotal, 7499 + 220 + 99 + 50);
  assert.equal(t.cash, 7499 + 220 + 99 + 50 - 100);
  assert.equal(t.paid, 21 * 446);
  d.payment.method = "pix";
  assert.equal(receiptTotals(d).paid, t.cash);
  assert.equal(paymentSummary(d).title, "PIX / transferência");
});

test("comprovante: QR com CPF mascarado e número estável", () => {
  const d = defaultMoto({ contractor, model: "cappuccino" });
  d.client.name = "Maria Lima";
  d.client.doc = "52998224725";
  const id = "0a1b2c3d-1111-2222-3333-444455556666";
  assert.equal(receiptNumber(id).number, "CPV-0A1B2C");
  const qr = receiptQrText(d, id, { name: "QUARK ENERGIA LTDA", cnpj: "12345678000195" });
  assert.match(qr, /Proprietário: Maria Lima/);
  assert.doesNotMatch(qr, /529\.982\.247-25/);
  assert.match(qr, /CNPJ 12\.345\.678\/0001-95/);
  assert.equal(buyerIsCompany(d), false);
  d.client.doc = "12345678000195";
  assert.equal(buyerIsCompany(d), true);
});
