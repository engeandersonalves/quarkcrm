import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, parseMoney } from "./csv.ts";

test("lê CSV do Excel (ponto e vírgula, aspas e BOM)", () => {
  const rows = parseCsv('﻿Nome;Telefone;Conta\r\n"Silva; Maria";(82) 99999-0000;"R$ 1.250,50"\r\nJoão;82988887777;600\r\n\r\n');
  assert.deepEqual(rows[0], ["Nome", "Telefone", "Conta"]);
  assert.equal(rows[1][0], "Silva; Maria");
  assert.equal(rows.length, 3);
  assert.equal(parseMoney(rows[1][2]), 1250.5);
  assert.equal(parseMoney("600"), 600);
});

test("lê CSV com vírgula e aspas escapadas", () => {
  const rows = parseCsv('name,notes\nAna,"disse ""sim"", ligar amanhã"');
  assert.equal(rows[1][1], 'disse "sim", ligar amanhã');
});
