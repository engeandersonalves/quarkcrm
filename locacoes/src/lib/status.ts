import { diffDias, hoje } from "./format";
import type { Lancamento, Locacao, StatusLocacao } from "./types";

export const STATUS: Record<StatusLocacao, { nome: string; curto: string; cor: string; ponto: string }> = {
  orcamento: { nome: "Orçamento", curto: "Orçamento", cor: "bg-violet-50 text-violet-700 ring-violet-200", ponto: "bg-violet-500" },
  agendada: { nome: "Aguardando entrega", curto: "A entregar", cor: "bg-sky-50 text-sky-700 ring-sky-200", ponto: "bg-sky-500" },
  na_obra: { nome: "Na obra", curto: "Na obra", cor: "bg-emerald-50 text-emerald-700 ring-emerald-200", ponto: "bg-emerald-500" },
  finalizada: { nome: "Finalizada", curto: "Finalizada", cor: "bg-ink-100 text-ink-600 ring-ink-200", ponto: "bg-ink-400" },
  recusada: { nome: "Recusada", curto: "Recusada", cor: "bg-rose-50 text-rose-700 ring-rose-200", ponto: "bg-rose-400" },
};

export type Alerta = { tipo: "critico" | "atencao" | "info"; texto: string };

/** Situação do prazo para mostrar em destaque no card. */
export function alertaPrazo(l: Locacao): Alerta | null {
  const h = hoje();
  if (l.status === "agendada" && l.data_entrega) {
    const d = diffDias(h, l.data_entrega);
    if (d < 0) return { tipo: "critico", texto: `Entrega atrasada ${-d}d` };
    if (d === 0) return { tipo: "atencao", texto: "Entregar hoje" };
    if (d === 1) return { tipo: "info", texto: "Entregar amanhã" };
  }
  if (l.status === "na_obra" && l.data_coleta) {
    const d = diffDias(h, l.data_coleta);
    if (d < 0) return { tipo: "critico", texto: `Venceu há ${-d}d` };
    if (d === 0) return { tipo: "atencao", texto: "Vence hoje" };
    if (d <= 3) return { tipo: "info", texto: `Vence em ${d}d` };
  }
  if (l.status === "orcamento") {
    const d = diffDias(l.criado_em.slice(0, 10), h);
    if (d >= 3) return { tipo: "info", texto: `Sem resposta há ${d}d` };
  }
  return null;
}

export const ALERTA_COR: Record<Alerta["tipo"], string> = {
  critico: "bg-rose-600 text-white",
  atencao: "bg-amber-400 text-ink-950",
  info: "bg-ink-100 text-ink-700",
};

/** Progresso do período de locação (0–1) para a barrinha do card. */
export function progresso(l: Locacao): number {
  if (l.status !== "na_obra" || !l.data_entrega || !l.data_coleta) return 0;
  const total = Math.max(1, diffDias(l.data_entrega, l.data_coleta));
  return Math.min(1, Math.max(0, diffDias(l.data_entrega, hoje()) / total));
}

export function saldoLocacao(l: Locacao, lancs: Lancamento[]) {
  const doc = lancs.filter((x) => x.locacao_id === l.id && x.tipo === "entrada");
  const cobrado = doc.reduce((s, x) => s + x.valor, 0);
  const pago = doc.filter((x) => x.pago).reduce((s, x) => s + x.valor, 0);
  return { cobrado, pago, aberto: Math.max(0, cobrado - pago), lancamentos: doc };
}
