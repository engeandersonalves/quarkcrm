import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, normalizarChave, pixCopiaECola } from "./pix.ts";

test("CRC16-CCITT confere com o valor de referência", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("BR Code tem estrutura válida e CRC correto", () => {
  const c = pixCopiaECola({ chave: "quarklocacoes@jim.com", nome: "Quark Locações", cidade: "Maceió", valor: 942, identificador: "LOC0001" });
  assert.ok(c.startsWith("000201"));
  assert.ok(c.includes("0014br.gov.bcb.pix0121quarklocacoes@jim.com"));
  assert.ok(c.includes("5406942.00"));
  assert.ok(c.includes("5914QUARK LOCACOES"));
  assert.ok(c.includes("6006MACEIO"));
  assert.ok(c.includes("62110507LOC0001"));
  assert.equal(c.slice(-4), crc16(c.slice(0, -4)));
});

test("chaves de telefone e CPF são normalizadas", () => {
  assert.equal(normalizarChave("(82) 98815-6223"), "+5582988156223");
  assert.equal(normalizarChave("123.456.789-09"), "12345678909");
});
