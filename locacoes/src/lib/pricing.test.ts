import { test } from "node:test";
import assert from "node:assert/strict";
import { comparativo, descreverPartes, diasDaLocacao, melhorCombinacao, sugerirPrecos, totalLocacao, valorAluguel } from "./pricing.ts";
import type { ItemLocacao } from "./types.ts";

const cfg = { fator_diaria: 0.15, fator_semanal: 0.45, fator_quinzenal: 0.7 };

const andaime: ItemLocacao = {
  equipamento_id: "a",
  nome: "Andaime 1,5 m",
  unidade: "peça",
  quantidade: 16,
  precos: sugerirPrecos(12, cfg),
};
const betoneira: ItemLocacao = {
  equipamento_id: "b",
  nome: "Betoneira 400 L",
  unidade: "un",
  quantidade: 1,
  precos: sugerirPrecos(450, cfg),
};

test("preços sugeridos ficam mais baratos por dia quanto maior o plano", () => {
  const p = sugerirPrecos(450, cfg);
  assert.deepEqual(p, { diaria: 67.5, semanal: 202.5, quinzenal: 315, mensal: 450 });
  const porDia = [p.diaria / 1, p.semanal / 7, p.quinzenal / 15, p.mensal / 30];
  for (let i = 1; i < porDia.length; i++) assert.ok(porDia[i] < porDia[i - 1]);
});

test("valor do contrato real: 16 andaimes + 8 plataformas + betoneira no mensal", () => {
  const plataforma: ItemLocacao = { ...andaime, equipamento_id: "p", quantidade: 8, precos: sugerirPrecos(30, cfg) };
  const total = totalLocacao({
    itens: [andaime, plataforma, betoneira],
    modalidade: "mensal",
    quantidade_periodos: 1,
    taxa_entrega: 60,
    taxa_retirada: 0,
    desconto: 0,
    acrescimo: 0,
  });
  assert.equal(total, 942);
});

test("modalidade por períodos multiplica a quantidade", () => {
  const r = valorAluguel([betoneira], "semanal", 2);
  assert.equal(r.total, 405);
  assert.equal(r.partes.semanal, 2);
});

test("dias livres escolhem a combinação mais barata", () => {
  // 5 diárias (337,50) > 1 semana (202,50)
  assert.equal(melhorCombinacao(5, betoneira.precos).total, 202.5);
  // 10 dias: 1 semana + 3 diárias = 405 > 1 quinzena = 315
  const dez = melhorCombinacao(10, betoneira.precos);
  assert.equal(dez.total, 315);
  assert.equal(dez.partes.quinzenal, 1);
  // 31 dias = 1 mês + 1 diária
  const r = melhorCombinacao(31, betoneira.precos);
  assert.equal(r.total, 517.5);
  assert.equal(descreverPartes(r.partes), "1 mês + 1 diária");
});

test("comparativo mostra economia crescente", () => {
  const c = comparativo([andaime, betoneira]);
  assert.equal(c[0].economia, 0);
  assert.ok(c[3].economia > c[2].economia && c[2].economia > c[1].economia);
});

test("duração em dias", () => {
  assert.equal(diasDaLocacao("mensal", 2), 60);
  assert.equal(diasDaLocacao("dias", 10), 10);
});

test("desconto nunca deixa o total negativo", () => {
  const t = totalLocacao({ itens: [betoneira], modalidade: "diaria", quantidade_periodos: 1, taxa_entrega: 0, taxa_retirada: 0, desconto: 9999, acrescimo: 0 });
  assert.equal(t, 0);
});
