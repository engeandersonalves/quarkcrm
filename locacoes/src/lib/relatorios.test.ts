import { test } from "node:test";
import assert from "node:assert/strict";
import { csv, periodoAno, periodoMes, relatorioEstoque, relatorioFinanceiro, relatorioLocacoes } from "./relatorios.ts";
import type { Equipamento, Lancamento, Locacao } from "./types.ts";

const lanc = (p: Partial<Lancamento>): Lancamento => ({
  id: Math.random().toString(),
  tipo: "entrada",
  categoria: "Aluguel",
  descricao: "",
  valor: 100,
  data: "2026-09-10",
  pago: true,
  pago_em: "2026-09-10",
  forma: "PIX",
  locacao_id: null,
  modalidade: "mensal",
  criado_em: "",
  ...p,
});

test("financeiro do mês separa entradas, saídas e resultado", () => {
  const r = relatorioFinanceiro(
    {
      lancamentos: [
        lanc({ valor: 942 }),
        lanc({ valor: 300, modalidade: "semanal", categoria: "Renovação", pago_em: "2026-09-20" }),
        lanc({ tipo: "saida", categoria: "Combustível", valor: 150, pago_em: "2026-09-12" }),
        lanc({ valor: 500, pago: false, pago_em: null, data: "2026-09-28" }),
        lanc({ valor: 80, pago: false, pago_em: null, data: "2026-08-01" }),
        lanc({ valor: 999, pago_em: "2026-10-01" }),
      ],
    },
    periodoMes(2026, 8),
    "2026-09-25",
  );
  assert.equal(r.totalEntradas, 1242);
  assert.equal(r.totalSaidas, 150);
  assert.equal(r.resultado, 1092);
  assert.equal(r.aReceberNoPeriodo, 500);
  assert.equal(r.vencido, 80);
  assert.equal(r.serie.length, 30);
  assert.equal(r.serie[9].entradas, 942);
  assert.equal(r.serie[29].acumulado, 1092);
  assert.deepEqual(r.saidasPorCategoria, [{ categoria: "Combustível", valor: 150 }]);
});

test("financeiro anual agrupa por mês", () => {
  const r = relatorioFinanceiro({ lancamentos: [lanc({ pago_em: "2026-01-05" }), lanc({ pago_em: "2026-12-31", tipo: "saida" })] }, periodoAno(2026), "2026-09-25");
  assert.equal(r.serie.length, 12);
  assert.equal(r.serie[0].entradas, 100);
  assert.equal(r.serie[11].saidas, 100);
});

const loc = (p: Partial<Locacao>) =>
  ({
    id: Math.random().toString(),
    numero: 1,
    status: "agendada",
    cliente_id: "c1",
    cliente_nome: "Ana",
    endereco: { bairro: "Centro" },
    itens: [{ equipamento_id: "e1", nome: "Andaime", unidade: "peça", quantidade: 10, precos: { diaria: 2, semanal: 6, quinzenal: 9, mensal: 12 } }],
    modalidade: "mensal",
    quantidade_periodos: 1,
    valor_total: 120,
    data_entrega: "2026-09-10",
    data_coleta: "2026-10-10",
    criado_em: "2026-09-05T10:00:00Z",
    entregue_em: null,
    recolhido_em: null,
    ...p,
  }) as Locacao;

test("locações: conversão e ticket médio", () => {
  const r = relatorioLocacoes({ locacoes: [loc({}), loc({ status: "recusada" }), loc({ status: "orcamento" }), loc({ valor_total: 380, status: "finalizada" })], lancamentos: [] }, periodoMes(2026, 8));
  assert.equal(r.orcamentos, 4);
  assert.equal(r.aprovadas, 2);
  assert.equal(Math.round(r.conversao * 100), 67);
  assert.equal(r.ticketMedio, 250);
  assert.equal(r.duracaoMedia, 30);
});

test("estoque: receita por item e ocupação", () => {
  const e = { id: "e1", nome: "Andaime", estoque_total: 100, em_manutencao: 10, valor_reposicao: 250, preco_mensal: 12 } as Equipamento;
  const r = relatorioEstoque({ equipamentos: [e], locacoes: [loc({ status: "na_obra" })] }, periodoMes(2026, 8));
  assert.equal(r.linhas[0].receita, 120);
  assert.equal(r.linhas[0].naObra, 10);
  assert.equal(r.linhas[0].disponivel, 80);
  assert.equal(Math.round(r.ocupacao * 1000), 111);
  assert.equal(r.patrimonio, 25000);
});

test("CSV com separador ; e números em pt-BR", () => {
  assert.equal(csv([["Nome", "Valor"], ["Ana; Silva", 1234.5]]), "﻿Nome;Valor\r\n\"Ana; Silva\";1.234,5");
});
