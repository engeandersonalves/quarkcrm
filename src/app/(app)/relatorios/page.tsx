"use client";

import { BadgeDollarSign, CalendarClock, Download, FileBarChart, Handshake, Printer, Sparkles, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/components/app/app-context";
import { AreaChart, BarChart, DeltaBadge, Donut, Funnel, SERIES, Sparkline, topWithOther } from "@/components/charts";
import { Avatar, Card, CardHeader, Empty, PageHeader, Segmented, Select, Skeleton, Button, cx } from "@/components/ui";
import { buildReport, delta, rangeOf, type Period } from "@/lib/analytics";
import { SEGMENTS, stageOf } from "@/lib/constants";
import { downloadCsv, today } from "@/lib/csv";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum, pct } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal, Segment } from "@/lib/types";

const fmtDelta = (d: number | null) => (d == null ? "novo" : `${Math.round(d * 100)}%`);
const compact = (v: number) => (v >= 1_000_000 ? `R$ ${fmtNum(v / 1_000_000, 1)} mi` : v >= 1000 ? `R$ ${fmtNum(v / 1000, v >= 10000 ? 0 : 1)} mil` : brl(v, 0));

export default function ReportsPage() {
  const { profiles } = useApp();
  const [period, setPeriod] = useState<Period>("90d");
  const [segment, setSegment] = useState<"" | Segment>("");

  const { data, loading } = useLive(
    async () => {
      const sb = supabase();
      const [leads, proposals] = await Promise.all([
        sb.from("leads").select("id,name,status,source,segment,created_at,updated_at,owner_id,estimated_value,lost_reason").limit(5000),
        sb.from("proposals").select("id,lead_id,status,final_price,profit_value,created_at,accepted_at,sent_at,viewed_at,created_by,power_kwp").limit(5000),
      ]);
      return { leads: must(leads) as Lead[], proposals: must(proposals) as Proposal[] };
    },
    [],
    ["leads", "proposals"],
  );

  const range = useMemo(() => rangeOf(period), [period]);
  const report = useMemo(() => {
    if (!data) return null;
    const leads = segment ? data.leads.filter((l) => (l.segment ?? "solar") === segment) : data.leads;
    const ids = new Set(leads.map((l) => l.id));
    const proposals = segment ? data.proposals.filter((p) => ids.has(p.lead_id)) : data.proposals;
    return buildReport(leads, proposals, profiles, range);
  }, [data, segment, profiles, range]);

  const exportCsv = () => {
    if (!report) return;
    const r = report;
    downloadCsv(
      `relatorio-${today()}.csv`,
      ["Indicador", "Período atual", "Período anterior", "Variação"],
      [
        ["Vendido (R$)", r.cur.sold, r.prev.sold, fmtDelta(delta(r.cur.sold, r.prev.sold))],
        ["Contratos", r.cur.deals, r.prev.deals, fmtDelta(delta(r.cur.deals, r.prev.deals))],
        ["Ticket médio (R$)", Math.round(r.cur.ticket), Math.round(r.prev.ticket), fmtDelta(delta(r.cur.ticket, r.prev.ticket))],
        ["Lucro previsto (R$)", Math.round(r.cur.profit), Math.round(r.prev.profit), fmtDelta(delta(r.cur.profit, r.prev.profit))],
        ["Leads novos", r.cur.newLeads, r.prev.newLeads, fmtDelta(delta(r.cur.newLeads, r.prev.newLeads))],
        ["Conversão de leads", pct(r.cur.conversion, 1), pct(r.prev.conversion, 1), ""],
        ["Dias até fechar (média)", r.cur.avgDays == null ? "" : Math.round(r.cur.avgDays), r.prev.avgDays == null ? "" : Math.round(r.prev.avgDays), ""],
        [],
        ["Origem", "Leads", "Vendas", "Conversão"],
        ...r.sources.map((s) => [s.key, s.total, s.won, pct(s.conversion, 1)]),
        [],
        ["Vendedor", "Leads", "Contratos", "Vendido (R$)"],
        ...r.sellers.map((s) => [s.name, s.leads, s.deals, Math.round(s.sold)]),
      ],
    );
  };

  return (
    <div className="animate-fade-up print:text-black">
      <PageHeader
        title="Relatórios"
        subtitle={`${range.label} · comparado ao período anterior`}
        actions={
          <div className="no-print flex gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={!report}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Planilha</span>
            </Button>
            <Button variant="secondary" onClick={() => window.print()} disabled={!report}>
              <Printer className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        }
      />

      {/* Filtros: sempre numa linha, acima dos gráficos */}
      <div className="no-print mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: "30d", label: "30 dias" },
            { value: "90d", label: "90 dias" },
            { value: "12m", label: "12 meses" },
            { value: "ano", label: "Este ano" },
          ]}
        />
        <Select value={segment} onChange={(e) => setSegment(e.target.value as "" | Segment)} className="sm:ml-auto sm:w-60">
          <option value="">Todos os serviços</option>
          {(Object.keys(SEGMENTS) as Segment[]).map((k) => (
            <option key={k} value={k}>
              {SEGMENTS[k].label}
            </option>
          ))}
        </Select>
      </div>

      {loading && !report ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : !report ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard dark icon={<BadgeDollarSign className="h-4 w-4" />} label="Vendido" value={brl(report.cur.sold, 0)} d={delta(report.cur.sold, report.prev.sold)} spark={report.months.map((m) => m.value)} />
            <KpiCard icon={<Handshake className="h-4 w-4" />} label="Contratos" value={fmtNum(report.cur.deals)} d={delta(report.cur.deals, report.prev.deals)} spark={report.months.map((m) => m.count)} sub={`${fmtNum(report.cur.kwp, 1)} kWp vendidos`} />
            <KpiCard icon={<Target className="h-4 w-4" />} label="Ticket médio" value={brl(report.cur.ticket, 0)} d={delta(report.cur.ticket, report.prev.ticket)} sub={`Lucro previsto ${compact(report.cur.profit)}`} />
            <KpiCard icon={<Users className="h-4 w-4" />} label="Leads novos" value={fmtNum(report.cur.newLeads)} d={delta(report.cur.newLeads, report.prev.newLeads)} spark={report.weeks.map((w) => w.value)} sub={`${pct(report.cur.conversion, 1)} viraram venda`} />
          </div>

          {/* Tendências */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader icon={<TrendingUp className="h-[18px] w-[18px]" />} title="Vendas por mês" subtitle="Propostas aceitas nos últimos 12 meses" />
              <div className="px-5 pb-5">
                <BarChart data={report.months} format={compact} sub={(i) => `${report.months[i].count} ${report.months[i].count === 1 ? "contrato" : "contratos"}`} />
              </div>
            </Card>
            <Card>
              <CardHeader icon={<Users className="h-[18px] w-[18px]" />} title="Leads por semana" subtitle="Últimas 12 semanas" />
              <div className="px-5 pb-5">
                <AreaChart data={report.weeks} format={(v) => `${fmtNum(v)} ${v === 1 ? "lead" : "leads"}`} />
              </div>
            </Card>
          </div>

          {/* Funis */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader icon={<Sparkles className="h-[18px] w-[18px]" />} title="Funil de vendas" subtitle="Leads do período que chegaram a cada etapa" />
              <div className="px-5 pb-5">
                {report.funnel[0].count ? <Funnel steps={report.funnel.map((f) => ({ label: stageOf(f.stage).label, count: f.count }))} /> : <Empty icon={<Users className="h-6 w-6" />} title="Sem leads no período" />}
              </div>
            </Card>
            <Card>
              <CardHeader icon={<FileBarChart className="h-[18px] w-[18px]" />} title="Jornada das propostas" subtitle="Das criadas às aceitas pelo cliente" />
              <div className="px-5 pb-5">
                {report.proposalFunnel[0].count ? <Funnel steps={report.proposalFunnel} color={SERIES[1]} /> : <Empty icon={<FileBarChart className="h-6 w-6" />} title="Sem propostas no período" />}
              </div>
            </Card>
          </div>

          {/* Composição */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="De onde vêm os leads" subtitle="Origem e conversão em venda" />
              <div className="px-5 pb-5">
                <Donut data={topWithOther(report.sources.map((s) => ({ label: s.key, value: s.total })))} center={fmtNum(report.cur.newLeads)} centerSub="leads no período" />
                {report.sources.length > 0 && (
                  <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    Melhor conversão: <b>{[...report.sources].filter((s) => s.total >= 2).sort((a, b) => b.conversion - a.conversion)[0]?.key ?? report.sources[0].key}</b> — invista mais onde o lead já chega pronto para comprar.
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Serviços procurados" subtitle="Leads por tipo de serviço" />
              <div className="px-5 pb-5">
                <Donut data={topWithOther(report.segments.map((s) => ({ label: SEGMENTS[s.key as Segment]?.label ?? s.key, value: s.total })))} center={fmtNum(report.cur.newLeads)} centerSub="leads no período" />
              </div>
            </Card>
          </div>

          {/* Previsão + vendedores */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card className="overflow-hidden">
              <div className="relative bg-ink-950 px-5 pt-5 pb-6 text-white">
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-sun-500/25 blur-3xl" />
                <p className="relative flex items-center gap-2 text-sm font-semibold text-ink-300">
                  <CalendarClock className="h-4 w-4 text-brand-lime" /> Previsão de fechamento
                </p>
                <p className="text-sun-gradient tnum relative mt-2 font-display text-4xl font-semibold">{brl(report.forecast, 0)}</p>
                <p className="relative mt-1 text-xs text-ink-400">
                  de {brl(report.pipeline, 0)} em aberto, ponderado pela chance de cada etapa
                </p>
              </div>
              <ul className="divide-y divide-ink-100 px-5">
                {report.forecastByStage.map((f) => (
                  <li key={f.stage} className="flex items-center gap-3 py-3 text-sm">
                    <span className={cx("h-2 w-2 shrink-0 rounded-full", stageOf(f.stage).dot)} />
                    <span className="flex-1 text-ink-700">
                      {stageOf(f.stage).label} <span className="text-ink-400">· {f.count}</span>
                    </span>
                    <span className="tnum text-ink-500">{compact(f.value)}</span>
                    <span className="tnum w-24 text-right font-semibold">{compact(f.weighted)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader icon={<Trophy className="h-[18px] w-[18px]" />} title="Desempenho da equipe" subtitle="Vendas das propostas criadas por cada vendedor" />
              <div className="px-5 pb-5">
                {report.sellers.length ? (
                  <ul className="grid gap-3">
                    {report.sellers.map((s, i) => {
                      const max = report.sellers[0].sold || 1;
                      return (
                        <li key={s.id} className="flex items-center gap-3">
                          <span className="tnum w-5 text-center text-sm font-bold text-ink-400">{i + 1}</span>
                          <Avatar name={s.name} className="h-8 w-8 text-[11px]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{s.name}</p>
                              <p className="tnum text-sm font-semibold">{brl(s.sold, 0)}</p>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                              <div className="h-full rounded-full bg-sun-gradient" style={{ width: `${Math.max(3, (s.sold / max) * 100)}%` }} />
                            </div>
                            <p className="mt-1 text-xs text-ink-500">
                              {s.deals} {s.deals === 1 ? "contrato" : "contratos"} · {s.leads} leads · {pct(s.conversion, 0)} de conversão
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty icon={<Trophy className="h-6 w-6" />} title="Sem vendas no período" />
                )}
              </div>
            </Card>
          </div>

          {/* Perdas + ciclo */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Por que perdemos" subtitle="Motivos informados ao marcar o lead como perdido" />
              <div className="px-5 pb-5">
                {report.lostReasons.length ? (
                  <ul className="grid gap-2.5">
                    {report.lostReasons.slice(0, 6).map((r) => (
                      <li key={r.reason}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="truncate text-ink-700">{r.reason}</span>
                          <span className="tnum font-semibold">{r.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full rounded-full" style={{ width: `${(r.count / report.lostReasons[0].count) * 100}%`, background: SERIES[2] }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon={<Sparkles className="h-6 w-6" />} title="Nenhuma perda no período" text="Continue assim." />
                )}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold text-ink-500">Ciclo médio de venda</p>
              <p className="tnum mt-2 font-display text-5xl font-semibold">{report.cur.avgDays == null ? "—" : fmtNum(report.cur.avgDays)}</p>
              <p className="text-sm text-ink-500">dias do primeiro contato ao contrato</p>
              {report.cur.avgDays != null && report.prev.avgDays != null && (
                <div className="mt-3">
                  <DeltaBadge value={delta(report.cur.avgDays, report.prev.avgDays)} invert />
                  <span className="ml-2 text-xs text-ink-400">quanto menor, melhor</span>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, d, sub, icon, spark, dark }: { label: string; value: string; d: number | null; sub?: string; icon: ReactNode; spark?: number[]; dark?: boolean }) {
  return (
    <Card className={cx("relative overflow-hidden p-4 sm:p-5", dark && "bg-ink-950 text-white ring-ink-950")}>
      {dark && <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-sun-500/25 blur-2xl" />}
      <div className="relative flex items-center justify-between gap-2">
        <p className={cx("text-xs font-semibold sm:text-[13px]", dark ? "text-ink-400" : "text-ink-500")}>{label}</p>
        <span className={cx("grid h-7 w-7 place-items-center rounded-lg", dark ? "bg-white/10 text-sun-400" : "bg-sun-50 text-sun-600")}>{icon}</span>
      </div>
      <p className={cx("tnum relative mt-2 truncate font-display text-xl font-semibold tracking-tight sm:text-[26px]", dark && "text-sun-gradient")}>{value}</p>
      <div className="relative mt-1 flex items-center gap-2">
        <DeltaBadge value={d} dark={dark} />
        {sub && <span className={cx("truncate text-xs", dark ? "text-ink-500" : "text-ink-400")}>{sub}</span>}
      </div>
      {spark && <Sparkline values={spark} color={dark ? "#9BD373" : SERIES[0]} className="relative mt-3" />}
    </Card>
  );
}
