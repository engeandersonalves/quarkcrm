import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dateInWords, endOfTerm, formatDoc, isValidCnpj, isValidCpf, maskDoc, moneyInWords, numberInWords } from "./br.ts";
import { DEFAULT_CADENCE, renderCopy } from "./cadence.ts";
import { defaultAluguel, defaultProcuracao, documentBlocks, missingFields, signersFor } from "./documents.ts";

test("valida e formata CPF e CNPJ", () => {
  assert.ok(isValidCpf("529.982.247-25"));
  assert.ok(!isValidCpf("529.982.247-24"));
  assert.ok(!isValidCpf("111.111.111-11"));
  assert.ok(isValidCnpj("11.222.333/0001-81"));
  assert.ok(!isValidCnpj("11.222.333/0001-80"));
  assert.equal(formatDoc("52998224725"), "529.982.247-25");
  assert.equal(formatDoc("11222333000181"), "11.222.333/0001-81");
  assert.equal(maskDoc("52998224725"), "***.982.247-**");
});

test("escreve números e valores por extenso", () => {
  assert.equal(numberInWords(1), "um");
  assert.equal(numberInWords(21), "vinte e um");
  assert.equal(numberInWords(100), "cem");
  assert.equal(numberInWords(1100), "mil e cem");
  assert.equal(numberInWords(1250), "mil duzentos e cinquenta");
  assert.equal(numberInWords(2005), "dois mil e cinco");
  assert.equal(numberInWords(1_500_000), "um milhão e quinhentos mil");
  assert.equal(moneyInWords(1500), "mil e quinhentos reais");
  assert.equal(moneyInWords(1), "um real");
  assert.equal(moneyInWords(0.5), "cinquenta centavos");
  assert.equal(moneyInWords(2_000_000), "dois milhões de reais");
  assert.equal(moneyInWords(1250.5), "mil duzentos e cinquenta reais e cinquenta centavos");
});

test("datas do contrato", () => {
  assert.equal(dateInWords("2026-09-01"), "1º de setembro de 2026");
  assert.equal(endOfTerm("2026-01-10", 30), "2028-07-09");
  assert.equal(endOfTerm("2026-01-01", 12), "2026-12-31");
});

test("procuração: texto, pendências e assinante", () => {
  const d = defaultProcuracao({ name: "Quark Energia Ltda", doc: "11222333000181" }, { name: "Maria Oliveira", doc: "52998224725", city: "Maceió" });
  assert.deepEqual(missingFields("procuracao", d), ["Número da unidade consumidora"]);
  d.uc = "3001234567";
  const text = documentBlocks("procuracao", d).map((b) => b.text).join("\n");
  assert.match(text, /MARIA OLIVEIRA/);
  assert.match(text, /529\.982\.247-25/);
  assert.match(text, /Equatorial/);
  assert.match(text, /3001234567/);
  assert.match(text, /Lei nº 14\.300\/2022/);
  assert.match(text, /12 \(doze\) meses/);
  assert.match(text, /vedado o substabelecimento/);
  assert.deepEqual(signersFor("procuracao", d).map((s) => s.role), ["outorgante"]);
});

test("contrato de aluguel: cláusulas e assinantes", () => {
  const d = defaultAluguel({ name: "João Locatário", doc: "52998224725" });
  d.landlord = { ...d.landlord, name: "Ana Locadora", doc: "11144477735" };
  d.property.address = "Rua das Flores, 100";
  d.rent = 1500;
  d.startDate = "2026-10-01";
  d.guarantee = "fiador";
  d.guarantor = { ...d.guarantor, name: "Carlos Fiador", doc: "39053344705" };
  d.witnesses[0] = { name: "Testemunha Um", doc: "" };
  assert.deepEqual(missingFields("aluguel", d), []);
  const text = documentBlocks("aluguel", d).map((b) => b.text).join("\n");
  assert.match(text, /R\$\s?1\.500,00 \(mil e quinhentos reais\)/);
  assert.match(text, /30 \(trinta\) meses/);
  assert.match(text, /término em 31\/03\/2029/);
  assert.match(text, /FIADOR/);
  assert.match(text, /Lei nº 8\.245\/1991/);
  assert.deepEqual(signersFor("aluguel", d).map((s) => s.role), ["locador", "locatario", "fiador", "testemunha1"]);
  d.property.purpose = "usina";
  assert.match(documentBlocks("aluguel", d).map((b) => b.text).join("\n"), /módulos fotovoltaicos/);
});

test("cadência: variáveis das mensagens", () => {
  const t = renderCopy("Olá, {nome}! Aqui é {vendedor}, da {empresa}. {interesse} em {cidade}", { name: "Maria Oliveira", seller: "Pedro Alves", company: "Quark", segment: "save", city: "Maceió" });
  assert.equal(t, "Olá, Maria! Aqui é Pedro, da Quark. carregador para veículo elétrico em Maceió");
});

test("cadência padrão do schema.sql é igual à do app", () => {
  const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
  const m = sql.match(/\$cadence\$(.*?)\$cadence\$/s);
  assert.ok(m, "cadência não encontrada no schema.sql");
  assert.deepEqual(JSON.parse(m[1]), JSON.parse(JSON.stringify(DEFAULT_CADENCE)));
});
