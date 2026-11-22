import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { cableFor, calc, defaultProject, formCells, inverterBreaker, missing, normalizeProject } from "./solar-project.ts";
import { fillXlsx, setCellInSheet, sheetPaths } from "./xlsx-fill.ts";

function sample() {
  const d = defaultProject();
  Object.assign(d.client, { name: "Maria Teste", doc: "52998224725", address: "Rua A, 1", city: "Maceió", state: "AL", cep: "57035-000" });
  Object.assign(d.uc, { account: "123", phase: "TRIFÁSICO", voltage: 380, breakerA: 70 });
  Object.assign(d.rt, { name: "RT", register: "999" });
  d.modules = [{ ...d.modules[0], brand: "Trina", model: "TSM-695", powerW: 695, qty: 12, lengthM: 2.384, widthM: 1.303 }];
  d.inverters = [{ ...d.inverters[0], brand: "Auxsol", model: "ASN-7.5SL", powerKw: 7.5, acA: 34 }];
  return d;
}

test("cálculos do memorial: kWp, PD, geração, disjuntor e cabo (regras da planilha)", () => {
  const c = calc(sample());
  assert.equal(c.kwp, 8.34);
  assert.equal(c.pdKva, 46.02); // 380 × 70 × 1,73 / 1000
  assert.equal(c.pdKw, 42.34);
  assert.equal(c.pg, 7.5);
  assert.equal(c.pgOk, true);
  assert.equal(c.monthly, 1056.85); // 8,34 × 5,28 × 30 × 80%
  assert.equal(c.acBreaker, 50); // 34 + 8 = 42 → 50 A
  assert.equal(c.acCable, 10);
  assert.equal(c.protMin, 176);
  assert.equal(c.protMax, 242);
  assert.equal(c.conductorsTotal, "quatro condutores");
  assert.equal(inverterBreaker(10), 20);
  assert.equal(cableFor(70), 25);
});

test("pendências e projeto salvo incompleto", () => {
  assert.ok(missing(defaultProject()).includes("Nome do titular"));
  assert.deepEqual(missing(sample()), []);
  const d = normalizeProject({ client: { name: "X" } });
  assert.equal(d.client.name, "X");
  assert.equal(d.uc.phase, "MONOFÁSICO");
});

test("célula: troca valor mantendo o estilo, cria célula e linha, não mexe em fórmula", () => {
  const xml = '<worksheet><sheetData><row r="2"><c r="B2" s="5" t="s"><v>3</v></c><c r="D2"><f>B2*2</f><v>6</v></c></row><row r="5"/></sheetData></worksheet>';
  let x = setCellInSheet(xml, "B2", "Olá & cia");
  assert.match(x, /<c r="B2" s="5" t="inlineStr"><is><t>Olá &amp; cia<\/t><\/is><\/c>/);
  x = setCellInSheet(x, "C2", 7);
  assert.match(x, /<c r="B2"[\s\S]*<c r="C2"><v>7<\/v><\/c><c r="D2">/);
  assert.equal(setCellInSheet(x, "D2", 1), x);
  assert.match(setCellInSheet(x, "D2!", 1), /<c r="D2"><v>1<\/v><\/c>/);
  assert.match(setCellInSheet(x, "A3", "z"), /<\/row><row r="3"><c r="A3" t="inlineStr">/);
  assert.match(setCellInSheet(x, "A5", 1), /<row r="5"><c r="A5"><v>1<\/v><\/c><\/row>/);
});

test("formulário da distribuidora: preenche o modelo e recalcula ao abrir", () => {
  const out = fillXlsx(new Uint8Array(readFileSync("public/projeto/formulario-grupo-b.xlsx")), formCells(sample()), { activeSheet: "1" });
  const files = unzipSync(out);
  const paths = sheetPaths(files);
  const g1 = strFromU8(files[paths["1"]]);
  const g0 = strFromU8(files[paths["0"]]);
  assert.match(g1, /<c r="C10"[^>]*t="inlineStr"><is><t>MARIA TESTE<\/t>/);
  assert.match(g1, /<c r="R10"[^>]*><is><t>529\.982\.247-25<\/t>/);
  assert.match(g0, /<c r="D7"[^>]*><v>695<\/v>/);
  assert.match(g0, /<c r="K7"[^>]*><f>/); // fórmula do kWp continua
  assert.doesNotMatch(g0, /<c r="K7"[^>]*><f>[^<]*<\/f><v>/); // sem valor antigo guardado
  assert.match(strFromU8(files["xl/workbook.xml"]), /fullCalcOnLoad="1"/);
  assert.equal(files["xl/calcChain.xml"], undefined);
});
