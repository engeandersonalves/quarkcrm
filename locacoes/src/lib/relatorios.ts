import { diffDias, MESES } from "./format.ts";
import { PERIODOS, valorAluguel } from "./pricing.ts";
import type { Dados, Lancamento, Locacao, Modalidade } from "./types.ts";

/** Intervalo fechado de datas AAAA-MM-DD. */
export interface Periodo {
  inicio: string;
  fim: string;
  nome: string;
  escala: "mes" | "ano";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function periodoMes(ano: number, mes: number): Periodo {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return { inicio: `${ano}-${pad(mes + 1)}-01`, fim: `${ano}-${pad(mes + 1)}-${pad(ultimo)}`, nome: `${MESES[mes]} ${ano}`, escala: "mes" };
}

export function periodoAno(ano: number): Periodo {
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, nome: String(ano), escala: "ano" };
}

const dentro = (d: string | null | undefined, p: Periodo) => Boolean(d) && d!.slice(0, 10) >= p.inicio && d!.slice(0, 10) <= p.fim;

/** Data em que o dinheiro entrou/saiu (regime de caixa). */
export const dataCaixa = (x: Lancamento) => (x.pago ? x.pago_em || x.data : x.data);

const somar = (xs: Lancamento[]) => Math.round(xs.reduce((s, x) => s + x.valor, 0) * 100) / 100;

function agrupar(xs: Lancamento[]) {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x.categoria || "Outros", (m.get(x.categoria || "Outros") ?? 0) + x.valor);
  return [...m.entries()].map(([categoria, valor]) => ({ categoria, valor: Math.round(valor * 100) / 100 })).sort((a, b) => b.valor - a.valor);
}

export interface PontoSerie {
  chave: string;
  rotulo: string;
  entradas: number;
  saidas: number;
}

/* ------------------------------------------------------------------ Financeiro */

export function relatorioFinanceiro(d: Pick<Dados, "lancamentos">, p: Periodo, hojeStr: string) {
  const pagos = d.lancamentos.filter((x) => x.pago && dentro(dataCaixa(x), p));
  const entradas = pagos.filter((x) => x.tipo === "entrada");
  const saidas = pagos.filter((x) => x.tipo === "saida");
  const abertos = d.lancamentos.filter((x) => !x.pago);

  // Série: por dia (mês) ou por mês (ano)
  const serie: PontoSerie[] = [];
  if (p.escala === "mes") {
    const [ano, mes] = p.inicio.split("-").map(Number);
    const dias = new Date(ano, mes, 0).getDate();
    for (let i = 1; i <= dias; i++) {
      const dia = `${ano}-${pad(mes)}-${pad(i)}`;
      serie.push({ chave: dia, rotulo: `${i} ${MESES[mes - 1]}`, entradas: somar(entradas.filter((x) => dataCaixa(x) === dia)), saidas: somar(saidas.filter((x) => dataCaixa(x) === dia)) });
    }
  } else {
    const ano = p.inicio.slice(0, 4);
    MESES.forEach((m, i) => {
      const pre = `${ano}-${pad(i + 1)}`;
      serie.push({ chave: pre, rotulo: `${m}`, entradas: somar(entradas.filter((x) => dataCaixa(x).startsWith(pre))), saidas: somar(saidas.filter((x) => dataCaixa(x).startsWith(pre))) });
    });
  }

  const totalEntradas = somar(entradas);
  const totalSaidas = somar(saidas);
  const resultado = Math.round((totalEntradas - totalSaidas) * 100) / 100;

  // Receita por plano (aluguel/renovação)
  const porPlano = new Map<Modalidade | "taxas", number>();
  for (const x of entradas) {
    const k = x.categoria === "Aluguel" || x.categoria === "Renovação" ? x.modalidade ?? "taxas" : "taxas";
    porPlano.set(k, (porPlano.get(k) ?? 0) + x.valor);
  }

  let acumulado = 0;
  const mesAMes = serie.map((s) => {
    acumulado += s.entradas - s.saidas;
    return { ...s, resultado: Math.round((s.entradas - s.saidas) * 100) / 100, acumulado: Math.round(acumulado * 100) / 100 };
  });

  return {
    totalEntradas,
    totalSaidas,
    resultado,
    margem: totalEntradas > 0 ? resultado / totalEntradas : 0,
    entradasPorCategoria: agrupar(entradas),
    saidasPorCategoria: agrupar(saidas),
    porPlano: [...porPlano.entries()].map(([k, v]) => ({ plano: k === "taxas" ? "Taxas e outros" : k === "dias" ? "Nº de dias" : PERIODOS.find((x) => x.id === k)!.nome, valor: Math.round(v * 100) / 100 })).sort((a, b) => b.valor - a.valor),
    /** Vence no período e ainda não foi recebido. */
    aReceberNoPeriodo: somar(abertos.filter((x) => x.tipo === "entrada" && dentro(x.data, p))),
    aPagarNoPeriodo: somar(abertos.filter((x) => x.tipo === "saida" && dentro(x.data, p))),
    /** Tudo o que já venceu e não foi pago (qualquer período). */
    vencido: somar(abertos.filter((x) => x.tipo === "entrada" && x.data < hojeStr)),
    serie: mesAMes,
    lancamentos: pagos.sort((a, b) => dataCaixa(a).localeCompare(dataCaixa(b))),
    nEntradas: entradas.length,
    nSaidas: saidas.length,
  };
}

/* ------------------------------------------------------------------ Locações */

const aprovada = (l: Locacao) => l.status === "agendada" || l.status === "na_obra" || l.status === "finalizada";

export function relatorioLocacoes(d: Pick<Dados, "locacoes" | "lancamentos">, p: Periodo) {
  const criadas = d.locacoes.filter((l) => dentro(l.criado_em, p));
  const aprovadas = criadas.filter(aprovada);
  const recusadas = criadas.filter((l) => l.status === "recusada");
  const entregues = d.locacoes.filter((l) => dentro(l.entregue_em, p));
  const finalizadas = d.locacoes.filter((l) => dentro(l.recolhido_em, p));
  // Locações que estiveram na obra em algum dia do período
  const ativas = d.locacoes.filter((l) => l.entregue_em && l.entregue_em.slice(0, 10) <= p.fim && (!l.recolhido_em || l.recolhido_em.slice(0, 10) >= p.inicio));
  const contratado = aprovadas.reduce((s, l) => s + l.valor_total, 0);
  const duracoes = aprovadas.filter((l) => l.data_entrega && l.data_coleta).map((l) => diffDias(l.data_entrega, l.data_coleta));

  const porPlano = new Map<string, { qtd: number; valor: number }>();
  for (const l of aprovadas) {
    const nome = l.modalidade === "dias" ? "Nº de dias" : PERIODOS.find((x) => x.id === l.modalidade)!.nome;
    const v = porPlano.get(nome) ?? { qtd: 0, valor: 0 };
    porPlano.set(nome, { qtd: v.qtd + 1, valor: v.valor + l.valor_total });
  }
  const porCliente = new Map<string, { nome: string; qtd: number; valor: number }>();
  for (const l of aprovadas) {
    const k = l.cliente_id ?? l.cliente_nome;
    const v = porCliente.get(k) ?? { nome: l.cliente_nome || "Sem nome", qtd: 0, valor: 0 };
    porCliente.set(k, { ...v, qtd: v.qtd + 1, valor: v.valor + l.valor_total });
  }
  const porBairro = new Map<string, number>();
  for (const l of aprovadas) {
    const b = l.endereco.bairro || "Sem bairro";
    porBairro.set(b, (porBairro.get(b) ?? 0) + 1);
  }
  const decididas = aprovadas.length + recusadas.length;

  return {
    orcamentos: criadas.length,
    aprovadas: aprovadas.length,
    recusadas: recusadas.length,
    emAberto: criadas.filter((l) => l.status === "orcamento").length,
    conversao: decididas > 0 ? aprovadas.length / decididas : 0,
    entregues: entregues.length,
    finalizadas: finalizadas.length,
    ativas: ativas.length,
    contratado: Math.round(contratado * 100) / 100,
    ticketMedio: aprovadas.length ? Math.round((contratado / aprovadas.length) * 100) / 100 : 0,
    duracaoMedia: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : 0,
    porPlano: [...porPlano.entries()].map(([plano, v]) => ({ plano, ...v })).sort((a, b) => b.valor - a.valor),
    topClientes: [...porCliente.values()].sort((a, b) => b.valor - a.valor).slice(0, 8),
    porBairro: [...porBairro.entries()].map(([bairro, qtd]) => ({ bairro, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8),
    lista: [...criadas].sort((a, b) => a.numero - b.numero),
  };
}

/* ------------------------------------------------------------------ Estoque */

export function relatorioEstoque(d: Pick<Dados, "equipamentos" | "locacoes">, p: Periodo) {
  const aprovadasNoPeriodo = d.locacoes.filter((l) => aprovada(l) && l.data_entrega && l.data_entrega >= p.inicio && l.data_entrega <= p.fim);
  const linhas = d.equipamentos.map((e) => {
    let naObra = 0;
    let reservado = 0;
    for (const l of d.locacoes)
      for (const i of l.itens)
        if (i.equipamento_id === e.id) {
          if (l.status === "na_obra") naObra += i.quantidade;
          else if (l.status === "agendada") reservado += i.quantidade;
        }
    let receita = 0;
    let vezes = 0;
    let pecasAlugadas = 0;
    for (const l of aprovadasNoPeriodo) {
      const it = l.itens.find((i) => i.equipamento_id === e.id);
      if (!it) continue;
      vezes++;
      pecasAlugadas += it.quantidade;
      const { partes } = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
      receita += PERIODOS.reduce((s, pp) => s + partes[pp.id] * it.quantidade * (it.precos[pp.id] || 0), 0);
    }
    const uteis = Math.max(0, e.estoque_total - e.em_manutencao);
    return {
      id: e.id,
      nome: e.nome,
      categoria: e.categoria,
      unidade: e.unidade,
      total: e.estoque_total,
      manutencao: e.em_manutencao,
      naObra,
      reservado,
      disponivel: e.estoque_total - e.em_manutencao - naObra - reservado,
      ocupacao: uteis > 0 ? (naObra + reservado) / uteis : 0,
      patrimonio: e.estoque_total * e.valor_reposicao,
      receita: Math.round(receita * 100) / 100,
      vezes,
      pecasAlugadas,
      potencialMensal: e.estoque_total * e.preco_mensal,
    };
  });
  const tot = linhas.reduce(
    (a, x) => ({ total: a.total + x.total, naObra: a.naObra + x.naObra, reservado: a.reservado + x.reservado, manutencao: a.manutencao + x.manutencao, patrimonio: a.patrimonio + x.patrimonio, receita: a.receita + x.receita }),
    { total: 0, naObra: 0, reservado: 0, manutencao: 0, patrimonio: 0, receita: 0 },
  );
  const uteis = tot.total - tot.manutencao;
  return {
    linhas: linhas.sort((a, b) => b.receita - a.receita || a.nome.localeCompare(b.nome)),
    ...tot,
    receita: Math.round(tot.receita * 100) / 100,
    ocupacao: uteis > 0 ? (tot.naObra + tot.reservado) / uteis : 0,
    semGiro: linhas.filter((x) => x.vezes === 0 && x.total > 0),
    faltando: linhas.filter((x) => x.disponivel < 0),
  };
}

/* ------------------------------------------------------------------ CSV (abre no Excel) */

export function csv(linhas: (string | number)[][]): string {
  const cel = (v: string | number) => {
    const s = typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v ?? "";
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n");
}
