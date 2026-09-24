import type { Config, Equipamento, ItemLocacao, Locacao, Modalidade, Periodo, Precos } from "./types.ts";

export const PERIODOS: { id: Periodo; dias: number; nome: string; singular: string; plural: string }[] = [
  { id: "diaria", dias: 1, nome: "Diária", singular: "dia", plural: "dias" },
  { id: "semanal", dias: 7, nome: "Semanal", singular: "semana", plural: "semanas" },
  { id: "quinzenal", dias: 15, nome: "Quinzenal", singular: "quinzena", plural: "quinzenas" },
  { id: "mensal", dias: 30, nome: "Mensal", singular: "mês", plural: "meses" },
];

export const DIAS: Record<Periodo, number> = { diaria: 1, semanal: 7, quinzenal: 15, mensal: 30 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function precosDe(e: Pick<Equipamento, "preco_diaria" | "preco_semanal" | "preco_quinzenal" | "preco_mensal">): Precos {
  return { diaria: e.preco_diaria, semanal: e.preco_semanal, quinzenal: e.preco_quinzenal, mensal: e.preco_mensal };
}

/**
 * Sugere os preços dos planos a partir do mensal: a diária é a mais cara
 * (proporcionalmente) e o preço por dia vai caindo até o mês.
 * Arredonda para R$ 0,10.
 */
export function sugerirPrecos(mensal: number, cfg: Pick<Config, "fator_diaria" | "fator_semanal" | "fator_quinzenal">): Precos {
  const round10 = (n: number) => Math.round(n * 10) / 10;
  return {
    diaria: round10(mensal * cfg.fator_diaria),
    semanal: round10(mensal * cfg.fator_semanal),
    quinzenal: round10(mensal * cfg.fator_quinzenal),
    mensal: r2(mensal),
  };
}

/** Soma de todos os itens para UM período do plano (ex.: 1 semana de tudo). */
export function subtotalPeriodo(itens: ItemLocacao[], p: Periodo): number {
  return r2(itens.reduce((s, i) => s + i.quantidade * (i.precos[p] || 0), 0));
}

export function precosDoPacote(itens: ItemLocacao[]): Precos {
  return {
    diaria: subtotalPeriodo(itens, "diaria"),
    semanal: subtotalPeriodo(itens, "semanal"),
    quinzenal: subtotalPeriodo(itens, "quinzenal"),
    mensal: subtotalPeriodo(itens, "mensal"),
  };
}

export type Partes = Record<Periodo, number>;
const vazio = (): Partes => ({ diaria: 0, semanal: 0, quinzenal: 0, mensal: 0 });

/**
 * Menor preço para cobrir pelo menos `dias` dias combinando meses, quinzenas,
 * semanas e diárias (às vezes 1 semana sai mais barato que 5 diárias).
 */
export function melhorCombinacao(dias: number, precos: Precos): { total: number; partes: Partes } {
  const n = Math.max(0, Math.ceil(dias));
  if (n === 0) return { total: 0, partes: vazio() };
  const planos = PERIODOS.filter((p) => precos[p.id] > 0);
  if (planos.length === 0) return { total: 0, partes: { ...vazio(), diaria: n } };

  const custo = new Array<number>(n + 1).fill(Infinity);
  const escolha = new Array<Periodo | null>(n + 1).fill(null);
  custo[0] = 0;
  for (let d = 1; d <= n; d++) {
    for (const p of planos) {
      const c = precos[p.id] + custo[Math.max(0, d - p.dias)];
      // Em empate, prefere o plano mais longo (menos cobranças para o cliente).
      if (c < custo[d] - 1e-9 || (Math.abs(c - custo[d]) < 1e-9 && escolha[d] && DIAS[p.id] > DIAS[escolha[d]!])) {
        custo[d] = c;
        escolha[d] = p.id;
      }
    }
  }
  const partes = vazio();
  let d = n;
  while (d > 0) {
    const p = escolha[d]!;
    partes[p]++;
    d = Math.max(0, d - DIAS[p]);
  }
  return { total: r2(custo[n]), partes };
}

export function diasDaLocacao(modalidade: Modalidade, quantidade: number): number {
  return modalidade === "dias" ? Math.max(1, Math.ceil(quantidade)) : DIAS[modalidade] * Math.max(1, quantidade);
}

/** Valor só do aluguel (sem taxas) e como ele foi composto. */
export function valorAluguel(itens: ItemLocacao[], modalidade: Modalidade, quantidade: number): { total: number; partes: Partes } {
  if (modalidade === "dias") return melhorCombinacao(quantidade, precosDoPacote(itens));
  const q = Math.max(1, quantidade);
  return { total: r2(subtotalPeriodo(itens, modalidade) * q), partes: { ...vazio(), [modalidade]: q } };
}

export function descreverPartes(partes: Partes): string {
  const out: string[] = [];
  for (const p of [...PERIODOS].reverse()) {
    const q = partes[p.id];
    if (q > 0) out.push(`${q} ${q === 1 ? (p.id === "diaria" ? "diária" : p.singular) : p.id === "diaria" ? "diárias" : p.plural}`);
  }
  return out.join(" + ") || "—";
}

export function descreverModalidade(modalidade: Modalidade, quantidade: number): string {
  if (modalidade === "dias") return `${quantidade} ${quantidade === 1 ? "dia" : "dias"}`;
  const p = PERIODOS.find((x) => x.id === modalidade)!;
  if (modalidade === "diaria") return `${quantidade} ${quantidade === 1 ? "diária" : "diárias"}`;
  return `${quantidade} ${quantidade === 1 ? p.singular : p.plural}`;
}

type Valores = Pick<Locacao, "itens" | "modalidade" | "quantidade_periodos" | "taxa_entrega" | "taxa_retirada" | "desconto" | "acrescimo">;

export function totalLocacao(l: Valores): number {
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos).total;
  return Math.max(0, r2(aluguel + (l.taxa_entrega || 0) + (l.taxa_retirada || 0) + (l.acrescimo || 0) - (l.desconto || 0)));
}

export interface LinhaComparativo {
  periodo: Periodo;
  nome: string;
  dias: number;
  valor: number;
  porDia: number;
  /** Economia do preço por dia em relação à diária (0–1). */
  economia: number;
}

/** Os 4 planos lado a lado para o cliente comparar (1 período de cada). */
export function comparativo(itens: ItemLocacao[]): LinhaComparativo[] {
  const pac = precosDoPacote(itens);
  const baseDia = pac.diaria;
  return PERIODOS.map((p) => {
    const porDia = pac[p.id] / p.dias;
    return {
      periodo: p.id,
      nome: p.nome,
      dias: p.dias,
      valor: pac[p.id],
      porDia: r2(porDia),
      economia: baseDia > 0 ? Math.max(0, 1 - porDia / baseDia) : 0,
    };
  });
}

export function brl(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
