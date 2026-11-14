import { test } from "node:test";
import assert from "node:assert/strict";
import { documentBlocks, documentTitle, missingFields, signersFor } from "./documents.ts";
import { applyModel, cardTotal, contractValue, defaultMoto, motoTotal, warrantyActive, warrantyEnd } from "./moto-sale.ts";

const contractor = { name: "QUARK ENERGIA LTDA", doc: "12345678000195", address: "Rua A, 1", city: "Maceió", state: "AL", cep: "57000000", repName: "Fulano", repDoc: "", repRole: "Diretor", repNationality: "brasileiro", repMarital: "" };

test("venda de scooter: modelo do catálogo, totais e cartão", () => {
  const d = defaultMoto({ contractor, model: "cappuccino" });
  assert.equal(d.modelName, "Cappuccino");
  assert.equal(d.price, 7499);
  assert.equal(d.warrantyDays, 90);
  d.accessories = [{ id: "a", name: "Capacete", qty: 1, price: 150 }];
  d.discount = 100;
  d.freight = 50;
  assert.equal(motoTotal(d), 7499 + 150 - 100 + 50);
  assert.equal(cardTotal(d), 21 * 446);
  assert.equal(contractValue(d), 21 * 446);
  d.payment.method = "pix";
  assert.equal(contractValue(d), motoTotal(d));
  const mz = applyModel(d, "mz");
  assert.equal(mz.specs.range, "100 km");
});

test("garantia de 90 dias conta da entrega", () => {
  const d = defaultMoto({ contractor });
  d.delivery.date = "2026-11-20";
  assert.equal(warrantyEnd(d), "2027-02-18");
  assert.equal(warrantyActive(d, new Date("2026-12-01T12:00:00")), true);
  assert.equal(warrantyActive(d, new Date("2027-03-01T12:00:00")), false);
  assert.equal(warrantyActive(d, new Date("2026-11-10T12:00:00")), false);
});

test("contrato da scooter: cláusulas essenciais, assinantes e pendências", () => {
  const d = defaultMoto({ contractor, model: "t1" });
  assert.ok(missingFields("moto", d).includes("Nome do(a) comprador"));
  d.client = { ...d.client, name: "Maria Souza", doc: "52998224725", phone: "82999990000", address: "Rua B, 2", city: "Maceió" };
  d.chassis = "QK2026T1-0001";
  d.witnesses[0] = { name: "João", doc: "" };
  assert.deepEqual(missingFields("moto", d), []);
  const text = documentBlocks("moto", d).map((b) => b.text).join("\n");
  assert.match(text, /garantia de 90 \(noventa\) dias/i);
  assert.match(text, /selfie/i);
  assert.match(text, /CONTRAN nº 996\/2023/);
  assert.match(text, /QK2026T1-0001/);
  assert.match(text, /21 \(vinte e uma\) parcelas de R\$\s385,00/);
  assert.match(text, /1 \(uma\) unidade de scooter elétrica T1/);
  assert.equal(documentTitle("moto", d), "T1 — Maria Souza");
  assert.deepEqual(signersFor("moto", d).map((s) => s.role), ["comprador", "testemunha1"]);
});
