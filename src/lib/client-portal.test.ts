import { test } from "node:test";
import assert from "node:assert/strict";
import { firstName, maskDocInput, maskPhoneInput, referralNotes, validDoc, warrantyStatus } from "./client-portal.ts";
import { defaultMoto } from "./moto-sale.ts";

const contractor = { name: "QUARK", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };

test("portal: máscaras e validação do CPF", () => {
  assert.equal(maskDocInput("52998224725"), "529.982.247-25");
  assert.equal(maskDocInput("5299"), "529.9");
  assert.equal(maskDocInput("12345678000195"), "12.345.678/0001-95");
  assert.equal(maskPhoneInput("82999887766"), "(82) 9 9988-7766");
  assert.equal(validDoc("529.982.247-25"), true);
  assert.equal(validDoc("529.982.247-24"), false);
  assert.equal(validDoc("111.111.111-11"), false);
  assert.equal(firstName("MARIA SOUZA"), "Maria");
});

test("portal: garantia ativa, aguardando e encerrada", () => {
  const d = defaultMoto({ contractor });
  d.date = "2026-11-10";
  d.delivery.date = "2026-11-12";
  const a = warrantyStatus(d, new Date("2026-11-22T15:00:00Z"));
  assert.equal(a.state, "ativa");
  assert.equal(a.left, 80);
  assert.equal(warrantyStatus(d, new Date("2026-11-11T15:00:00Z")).state, "aguardando");
  assert.equal(warrantyStatus(d, new Date("2027-03-01T15:00:00Z")).state, "encerrada");
});

test("portal: texto da indicação", () => {
  const t = referralNotes({ referrer: "Maria", referrerPhone: "(82) 9 9988-7766", model: "Cappuccino", notes: "", saleId: "abc" });
  assert.match(t, /até R\$ 300/);
  assert.match(t, /Interesse: Cappuccino/);
});

test("portal: garantia pendente sem assinatura ou sem data de entrega", () => {
  const d = defaultMoto({ contractor });
  d.date = "2026-11-10";
  d.delivery = { mode: "entrega", address: "", date: "" };
  assert.equal(warrantyStatus(d, new Date("2026-11-22T15:00:00Z")).state, "pendente");
  d.delivery = { mode: "retirada", address: "", date: "" };
  assert.equal(warrantyStatus(d, new Date("2026-11-22T15:00:00Z"), false).state, "pendente");
  assert.equal(warrantyStatus(d, new Date("2026-11-22T15:00:00Z"), true).state, "ativa");
});
