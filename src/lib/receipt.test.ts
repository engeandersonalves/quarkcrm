import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDoc, longDate, moneyToWords, numberToWords, receiptStatement } from "./receipt.ts";

test("números por extenso", () => {
  assert.equal(numberToWords(0), "zero");
  assert.equal(numberToWords(1), "um");
  assert.equal(numberToWords(16), "dezesseis");
  assert.equal(numberToWords(21), "vinte e um");
  assert.equal(numberToWords(100), "cem");
  assert.equal(numberToWords(101), "cento e um");
  assert.equal(numberToWords(345), "trezentos e quarenta e cinco");
  assert.equal(numberToWords(1000), "mil");
  assert.equal(numberToWords(1500), "mil e quinhentos");
  assert.equal(numberToWords(1020), "mil e vinte");
  assert.equal(numberToWords(1550), "mil quinhentos e cinquenta");
  assert.equal(numberToWords(23890), "vinte e três mil oitocentos e noventa");
  assert.equal(numberToWords(200000), "duzentos mil");
  assert.equal(numberToWords(1000000), "um milhão");
  assert.equal(numberToWords(2300000), "dois milhões e trezentos mil");
  assert.equal(numberToWords(1001500), "um milhão, mil e quinhentos");
});

test("valores em reais por extenso", () => {
  assert.equal(moneyToWords(1), "um real");
  assert.equal(moneyToWords(0.5), "cinquenta centavos");
  assert.equal(moneyToWords(0.01), "um centavo");
  assert.equal(moneyToWords(1500.5), "mil e quinhentos reais e cinquenta centavos");
  assert.equal(moneyToWords(23890), "vinte e três mil oitocentos e noventa reais");
  assert.equal(moneyToWords(1000000), "um milhão de reais");
  assert.equal(moneyToWords(0), "zero real");
});

test("documento, data e declaração", () => {
  assert.equal(formatDoc("12345678901"), "123.456.789-01");
  assert.equal(formatDoc("12345678000190"), "12.345.678/0001-90");
  assert.equal(longDate("2026-10-02", "Maceió/AL"), "Maceió/AL, 2 de outubro de 2026");
  const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const txt = receiptStatement({ number: 1, payerName: "Mariana Albuquerque", payerDoc: "12345678901", amount: 1500, description: "sinal do sistema solar", method: "PIX", installment: "", paidAt: "2026-10-02", city: "Maceió/AL" }, "Quark Energia", brl);
  assert.equal(txt, "Quark Energia declara que recebeu de Mariana Albuquerque, inscrito(a) no CPF sob o nº 123.456.789-01, a importância de R$ 1500,00 (mil e quinhentos reais), referente a sinal do sistema solar, pago via PIX, dando plena e geral quitação do valor recebido.");
  assert.match(receiptStatement({ number: 1, payerName: "X", payerDoc: "", amount: 300, description: "parcela", method: "Boleto", installment: "2 de 6", paidAt: "2026-10-02", city: "" }, "Q", brl), /parcela 2 de 6, pago via boleto, dando quitação do valor desta parcela\.$/);
});
