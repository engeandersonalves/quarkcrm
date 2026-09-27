/**
 * Métricas dos relatórios e do painel. Funções puras (testáveis) sobre leads, propostas e perfis.
 * "Venda" = proposta aceita (accepted_at), a mesma regra do painel.
 */
import type { Lead, LeadStatus, Profile, Proposal } from "./types";

export type Period = "30d" | "90d" | "12m" | "ano";

export interface Range {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  label: string;
}

export function rangeOf(p: Period, now = new Date()): Range {
  const to = now;
  let from: Date;
  let label: string;
  if (p === "30d") {
    from = new Date(now.getTime() - 30 * 86400000);
    label = "Últimos 30 dias";
  } else if (p === "90d") {
    from = new Date(now.getTime() - 90 * 86400000);
    label = "Últimos 90 dias";
  } else if (p === "12m") {
    from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    label = "Últimos 12 meses";
  } else {
    from = new Date(now.getFullYear(), 0, 1);
    label = `Ano de ${now.getFullYear()}`;
  }
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from, label };
}

const inRange = (iso: string | null | undefined, a: Date, b: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= a.getTime() && t < b.getTime();
};

export const STAGE_ORDER: LeadStatus[] = ["novo", "contato", "visita", "proposta", "negociacao", "ganho"];
/** Chance de fechar por etapa, usada na previsão do pipeline. */
export const STAGE_PROBABILITY: Partial<Record<LeadStatus, number>> = { novo: 0.05, contato: 0.1, visita: 0.25, proposta: 0.4, negociacao: 0.6 };

type P = Pick<Proposal, "lead_id" | "status" | "final_price" | "profit_value" | "created_at" | "accepted_at" | "sent_at" | "viewed_at" | "created_by" | "power_kwp">;
type L = Pick<Lead, "id" | "status" | "source" | "segment" | "created_at" | "updated_at" | "owner_id" | "estimated_value" | "lost_reason">;

function core(leads: L[], proposals: P[], a: Date, b: Date) {
  const won = proposals.filter((p) => p.status === "aceita" && inRange(p.accepted_at, a, b));
  const sold = won.reduce((s, p) => s + Number(p.final_price), 0);
  const created = leads.filter((l) => inRange(l.created_at, a, b));
  const wonLeads = created.filter((l) => l.status === "ganho").length;
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const days = won
    .map((p) => {
      const l = leadById.get(p.lead_id);
      return l && p.accepted_at ? (new Date(p.accepted_at).getTime() - new Date(l.created_at).getTime()) / 86400000 : null;
    })
    .filter((d): d is number => d != null && d >= 0);
  return {
    sold,
    deals: won.length,
    ticket: won.length ? sold / won.length : 0,
    profit: won.reduce((s, p) => s + Number(p.profit_value), 0),
    kwp: won.reduce((s, p) => s + Number(p.power_kwp), 0),
    newLeads: created.length,
    conversion: created.length ? wonLeads / created.length : 0,
    avgDays: days.length ? days.reduce((s, d) => s + d, 0) / days.length : null,
  };
}

/** Variação contra o período anterior; null quando não há base de comparação. */
export function delta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return (cur - prev) / prev;
}

export function buildReport(leads: L[], proposals: P[], profiles: Pick<Profile, "id" | "full_name" | "email">[], range: Range, now = new Date()) {
  const cur = core(leads, proposals, range.from, range.to);
  const prev = core(leads, proposals, range.prevFrom, range.prevTo);
  const accepted = proposals.filter((p) => p.status === "aceita" && p.accepted_at);

  // Vendas por mês (12 meses) — sempre a mesma janela, para enxergar tendência.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const m = accepted.filter((p) => inRange(p.accepted_at, d, next));
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      full: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      value: m.reduce((s, p) => s + Number(p.final_price), 0),
      count: m.length,
    };
  });

  // Leads por semana (12 semanas).
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const a = new Date(weekStart.getTime() - (11 - i) * 7 * 86400000);
    const b = new Date(a.getTime() + 7 * 86400000);
    return { label: a.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: leads.filter((l) => inRange(l.created_at, a, b)).length };
  });

  const periodLeads = leads.filter((l) => inRange(l.created_at, range.from, range.to));

  // Funil: quantos leads do período chegaram pelo menos a cada etapa.
  const funnel = STAGE_ORDER.map((stage, i) => ({
    stage,
    count: periodLeads.filter((l) => l.status !== "perdido" ? STAGE_ORDER.indexOf(l.status) >= i : i === 0).length,
  }));

  const group = <K extends string>(list: L[], key: (l: L) => K) => {
    const m = new Map<K, { total: number; won: number }>();
    for (const l of list) {
      const k = key(l);
      const g = m.get(k) ?? { total: 0, won: 0 };
      g.total++;
      if (l.status === "ganho") g.won++;
      m.set(k, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, conversion: v.total ? v.won / v.total : 0 })).sort((a, b) => b.total - a.total);
  };

  const sources = group(periodLeads, (l) => (l.source || "Sem origem") as string);
  const segments = group(periodLeads, (l) => (l.segment || "solar") as string);

  const periodProps = proposals.filter((p) => inRange(p.created_at, range.from, range.to));
  const proposalFunnel = [
    { label: "Criadas", count: periodProps.length },
    // Cada etapa conta quem chegou pelo menos até ela (aceita também foi vista e enviada).
    { label: "Enviadas", count: periodProps.filter((p) => p.sent_at || p.viewed_at || p.status === "aceita").length },
    { label: "Visualizadas", count: periodProps.filter((p) => p.viewed_at || p.status === "aceita").length },
    { label: "Aceitas", count: periodProps.filter((p) => p.status === "aceita").length },
  ];

  // Previsão: valor em aberto ponderado pela chance de cada etapa.
  const bestByLead = new Map<string, number>();
  for (const p of proposals) if (p.status !== "recusada") bestByLead.set(p.lead_id, Math.max(bestByLead.get(p.lead_id) ?? 0, Number(p.final_price)));
  const forecastByStage = (["novo", "contato", "visita", "proposta", "negociacao"] as LeadStatus[]).map((stage) => {
    const ls = leads.filter((l) => l.status === stage);
    const value = ls.reduce((s, l) => s + (bestByLead.get(l.id) ?? Number(l.estimated_value ?? 0)), 0);
    return { stage, count: ls.length, value, weighted: value * (STAGE_PROBABILITY[stage] ?? 0) };
  });
  const forecast = forecastByStage.reduce((s, f) => s + f.weighted, 0);
  const pipeline = forecastByStage.reduce((s, f) => s + f.value, 0);

  // Vendedores: leads sob responsabilidade e vendas das propostas que criaram.
  const sellers = profiles
    .map((pr) => {
      const own = periodLeads.filter((l) => l.owner_id === pr.id);
      const w = accepted.filter((p) => p.created_by === pr.id && inRange(p.accepted_at, range.from, range.to));
      return {
        id: pr.id,
        name: pr.full_name || pr.email || "Usuário",
        leads: own.length,
        deals: w.length,
        sold: w.reduce((s, p) => s + Number(p.final_price), 0),
        conversion: own.length ? own.filter((l) => l.status === "ganho").length / own.length : 0,
      };
    })
    .filter((s) => s.leads || s.deals)
    .sort((a, b) => b.sold - a.sold || b.leads - a.leads);

  const lostMap = new Map<string, number>();
  for (const l of leads.filter((x) => x.status === "perdido" && inRange(x.updated_at, range.from, range.to))) {
    const k = (l.lost_reason || "Sem motivo informado").trim();
    lostMap.set(k, (lostMap.get(k) ?? 0) + 1);
  }
  const lostReasons = [...lostMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  return { cur, prev, months, weeks, funnel, sources, segments, proposalFunnel, forecastByStage, forecast, pipeline, sellers, lostReasons };
}

export type Report = ReturnType<typeof buildReport>;
