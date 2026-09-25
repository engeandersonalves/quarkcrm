"use client";

import { ArrowUpRight, Calculator, CheckCircle2, ChevronRight, Eye, FileText, Flame, Lightbulb, Target, TrendingUp, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { useQuick } from "@/components/app/shell";
import { TaskRow } from "@/components/app/task-row";
import { CinematicBackdrop } from "@/components/app/cinematic";
import { SALES_TIPS, imagePool, pickDaily, quotePool } from "@/lib/inspiration";
import { Avatar, Badge, Button, Card, CardHeader, Empty, Skeleton, cx } from "@/components/ui";
import { OPEN_STAGES, PROPOSAL_STATUS, STAGES } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum, pct } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal, Task } from "@/lib/types";

interface DashData {
  leads: Lead[];
  proposals: Proposal[];
  tasks: Task[];
}

export default function Dashboard() {
  const { profile, settings } = useApp();
  const { openLead, openTask } = useQuick();
  const { data, loading } = useLive<DashData>(
    async () => {
      const sb = supabase();
      const [leads, proposals, tasks] = await Promise.all([
        sb.from("leads").select("*").order("created_at", { ascending: false }),
        sb
          .from("proposals")
          // sem "inputs" (JSON grande do cálculo), que o painel não usa
          .select(
            "id,number,lead_id,title,status,power_kwp,monthly_generation,direct_cost,commission_value,tax_value,profit_value,final_price,public_token,valid_until,sent_at,viewed_at,view_count,accepted_at,accepted_by,created_by,created_at,updated_at, lead:leads(id,name,city,phone)",
          ).order("updated_at", { ascending: false }),
        sb.from("tasks").select("*, lead:leads(id,name)").eq("done", false).order("due_at", { ascending: true, nullsFirst: false }),
      ]);
      return { leads: must(leads) as Lead[], proposals: must(proposals) as Proposal[], tasks: must(tasks) as Task[] };
    },
    [],
    ["leads", "proposals", "tasks"],
  );

  const m = useMemo(() => (data ? metrics(data) : null), [data]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  return (
    <div className="animate-fade-up">
      <HeroBanner greet={greet} firstName={firstName} wonMonth={m?.wonMonth ?? 0} deals={m?.wonMonthCount ?? 0} onNewLead={() => openLead()} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!m ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px]" />)
        ) : (
          <>
            <Kpi dark label="Vendido no mês" value={brl(m.wonMonth, 0)} sub={`${m.wonMonthCount} ${m.wonMonthCount === 1 ? "contrato" : "contratos"} · ${fmtNum(m.kwpMonth, 1)} kWp`} icon={<TrendingUp className="h-4 w-4" />} />
            <Kpi label="Pipeline em aberto" value={brl(m.pipeline, 0)} sub={`${m.openLeads} leads em negociação`} icon={<Zap className="h-4 w-4" />} />
            <Kpi label="Novos leads (30 dias)" value={fmtNum(m.newLeads30)} sub={m.hotLeads ? `${m.hotLeads} quentes 🔥` : "Cadastre e acompanhe"} icon={<Users className="h-4 w-4" />} />
            <Kpi label="Taxa de conversão" value={m.conversion == null ? "—" : pct(m.conversion, 0)} sub={`Lucro previsto no mês: ${brl(m.profitMonth, 0)}`} icon={<CheckCircle2 className="h-4 w-4" />} />
          </>
        )}
      </div>

      {settings.app.showTips && <TipCard />}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Vendas por mês */}
        <Card>
          <CardHeader title="Vendas por mês" subtitle="Valor das propostas aceitas nos últimos 6 meses" />
          <div className="px-5 pb-5">{m ? <SalesBars data={m.months} /> : <Skeleton className="h-52" />}</div>
        </Card>

        {/* Funil */}
        <Card>
          <CardHeader title="Funil de vendas" subtitle="Leads por etapa" action={<Link href="/leads" className="text-[13px] font-semibold text-sun-700 hover:text-sun-800">Ver funil</Link>} />
          <div className="grid gap-3 px-5 pb-5">
            {m
              ? STAGES.map((s) => {
                  const count = m.byStage[s.id] ?? 0;
                  const max = Math.max(1, ...Object.values(m.byStage));
                  return (
                    <Link key={s.id} href={`/leads?etapa=${s.id}`} className="group grid grid-cols-[132px_1fr_28px] items-center gap-3">
                      <span className="flex items-center gap-2 truncate text-[13px] text-ink-600 group-hover:text-ink-900">
                        <span className={cx("h-2 w-2 shrink-0 rounded-full", s.dot)} />
                        {s.label}
                      </span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                        <span className="block h-full rounded-full bg-sun-600 transition-all" style={{ width: `${count ? Math.max(4, (count / max) * 100) : 0}%` }} />
                      </span>
                      <span className="tnum text-right text-[13px] font-semibold text-ink-800">{count}</span>
                    </Link>
                  );
                })
              : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Tarefas */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Suas próximas tarefas"
            subtitle={m ? (m.overdue ? `${m.overdue} atrasada${m.overdue > 1 ? "s" : ""}` : "Tudo em dia") : undefined}
            action={
              <Button size="sm" variant="secondary" onClick={() => openTask()}>
                + Tarefa
              </Button>
            }
          />
          <div className="px-2 pb-3">
            {loading ? (
              <div className="grid gap-2 px-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : !data?.tasks.length ? (
              <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="Nenhuma tarefa pendente" text="Agende follow-ups para não perder nenhum negócio." />
            ) : (
              data.tasks.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)
            )}
            {(data?.tasks.length ?? 0) > 6 && (
              <Link href="/tarefas" className="block px-3 py-2 text-center text-[13px] font-semibold text-sun-700">
                Ver todas ({data!.tasks.length})
              </Link>
            )}
          </div>
        </Card>

        {/* Propostas recentes */}
        <Card className="lg:col-span-1">
          <CardHeader title="Movimento nas propostas" subtitle="Visualizações e aceites em tempo real" />
          <div className="px-2 pb-3">
            {loading ? (
              <div className="grid gap-2 px-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : !data?.proposals.length ? (
              <Empty icon={<FileText className="h-6 w-6" />} title="Nenhuma proposta ainda" action={<Link href="/propostas/nova"><Button size="sm" variant="sun">Criar orçamento</Button></Link>} />
            ) : (
              data.proposals.slice(0, 6).map((p) => (
                <Link key={p.id} href={`/propostas/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50">
                  <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", p.status === "aceita" ? "bg-emerald-50 text-emerald-600" : p.view_count ? "bg-violet-50 text-violet-600" : "bg-ink-100 text-ink-500")}>
                    {p.status === "aceita" ? <CheckCircle2 className="h-4 w-4" /> : p.view_count ? <Eye className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.lead?.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      #{p.number} · {p.view_count ? `vista ${p.view_count}× · ${relativeTime(p.viewed_at)}` : relativeTime(p.updated_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-sm font-semibold">{brl(p.final_price, 0)}</p>
                    <Badge className={cx("mt-0.5 !px-2 !text-[10px]", PROPOSAL_STATUS[p.status].cls)}>{PROPOSAL_STATUS[p.status].label}</Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Leads recentes */}
        <Card className="lg:col-span-1">
          <CardHeader title="Leads recentes" action={<Link href="/leads" className="text-[13px] font-semibold text-sun-700">Ver todos</Link>} />
          <div className="px-2 pb-3">
            {loading ? (
              <div className="grid gap-2 px-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : !data?.leads.length ? (
              <Empty icon={<Users className="h-6 w-6" />} title="Nenhum lead ainda" action={<Button size="sm" onClick={() => openLead()}>Cadastrar lead</Button>} />
            ) : (
              data.leads.slice(0, 6).map((l) => {
                const st = STAGES.find((s) => s.id === l.status)!;
                return (
                  <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50">
                    <Avatar name={l.name} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {l.name} {l.temperature === "quente" && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {[l.city, l.source].filter(Boolean).join(" · ")} · {relativeTime(l.created_at)}
                      </p>
                    </div>
                    <Badge className={st.soft} dot={st.dot}>
                      {st.label}
                    </Badge>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function metrics({ leads, proposals, tasks }: DashData) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const accepted = proposals.filter((p) => p.status === "aceita" && p.accepted_at);
  const thisMonth = accepted.filter((p) => new Date(p.accepted_at!) >= monthStart);

  // Pipeline: maior proposta de cada lead em aberto (ou valor estimado).
  const bestByLead = new Map<string, number>();
  for (const p of proposals) if (p.status !== "recusada") bestByLead.set(p.lead_id, Math.max(bestByLead.get(p.lead_id) ?? 0, Number(p.final_price)));
  const open = leads.filter((l) => OPEN_STAGES.includes(l.status));
  const pipeline = open.reduce((s, l) => s + (bestByLead.get(l.id) ?? Number(l.estimated_value ?? 0)), 0);

  const byStage: Record<string, number> = {};
  for (const l of leads) byStage[l.status] = (byStage[l.status] ?? 0) + 1;
  const closed = (byStage.ganho ?? 0) + (byStage.perdido ?? 0);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const inMonth = accepted.filter((p) => {
      const t = new Date(p.accepted_at!);
      return t >= d && t < next;
    });
    return { label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), value: inMonth.reduce((s, p) => s + Number(p.final_price), 0), count: inMonth.length };
  });

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return {
    wonMonth: thisMonth.reduce((s, p) => s + Number(p.final_price), 0),
    wonMonthCount: thisMonth.length,
    kwpMonth: thisMonth.reduce((s, p) => s + Number(p.power_kwp), 0),
    profitMonth: thisMonth.reduce((s, p) => s + Number(p.profit_value), 0),
    pipeline,
    openLeads: open.length,
    newLeads30: leads.filter((l) => Date.now() - new Date(l.created_at).getTime() < 30 * 86400000).length,
    hotLeads: open.filter((l) => l.temperature === "quente").length,
    conversion: closed ? (byStage.ganho ?? 0) / closed : null,
    byStage,
    months,
    overdue: tasks.filter((t) => t.due_at && new Date(t.due_at) < now).length,
    dueToday: tasks.filter((t) => t.due_at && new Date(t.due_at) <= endOfToday).length,
  };
}

function Kpi({ label, value, sub, icon, dark }: { label: string; value: string; sub: string; icon: React.ReactNode; dark?: boolean }) {
  return (
    <Card className={cx("relative overflow-hidden p-4 sm:p-5", dark && "bg-ink-950 text-white ring-ink-950")}>
      {dark && <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-sun-500/25 blur-2xl" />}
      <div className="relative flex items-center justify-between">
        <p className={cx("text-xs font-semibold sm:text-[13px]", dark ? "text-ink-400" : "text-ink-500")}>{label}</p>
        <span className={cx("grid h-7 w-7 place-items-center rounded-lg", dark ? "bg-white/10 text-sun-400" : "bg-sun-50 text-sun-600")}>{icon}</span>
      </div>
      <p className={cx("tnum relative mt-3 font-display text-xl font-semibold tracking-tight sm:text-[26px]", dark && "text-sun-gradient")}>{value}</p>
      <p className={cx("relative mt-1 truncate text-xs", dark ? "text-ink-500" : "text-ink-400")}>{sub}</p>
    </Card>
  );
}

function SalesBars({ data }: { data: { label: string; value: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.some((d) => d.value)) {
    return (
      <div className="grid h-52 place-items-center rounded-2xl border border-dashed border-ink-200 text-center text-sm text-ink-400">
        <div>
          <ArrowUpRight className="mx-auto mb-2 h-5 w-5" />
          As vendas aparecem aqui quando uma proposta for aceita.
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-52 items-end gap-2 sm:gap-4">
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          {d.value > 0 && <p className="tnum text-[11px] font-semibold text-ink-600">{fmtNum(d.value / 1000, d.value >= 100000 ? 0 : 1)} mil</p>}
          <div
            className={cx("w-full max-w-14 rounded-t-[4px] transition-opacity", i === data.length - 1 ? "bg-sun-600" : "bg-sun-600/75", hover !== null && hover !== i && "opacity-50")}
            style={{ height: `${d.value ? Math.max(3, (d.value / max) * 78) : 1.5}%` }}
          />
          <p className="text-xs text-ink-500 capitalize">{d.label}</p>
          {hover === i && (
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-xl bg-ink-950 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lift">
              <p className="tnum font-semibold">{brl(d.value, 0)}</p>
              <p className="text-ink-400">{d.count} {d.count === 1 ? "venda" : "vendas"}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HeroBanner({ greet, firstName, wonMonth, deals, onNewLead }: { greet: string; firstName: string; wonMonth: number; deals: number; onNewLead: () => void }) {
  const { settings } = useApp();
  const prefs = settings.app;
  const quote = pickDaily(quotePool(prefs.customQuotes, prefs.useDefaultQuotes), 0);
  const image = pickDaily(imagePool(prefs.images), 1);
  const pct = prefs.monthlyGoal > 0 ? Math.min(1, wonMonth / prefs.monthlyGoal) : 0;
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const missing = Math.max(0, prefs.monthlyGoal - wonMonth);
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative mb-5 overflow-hidden rounded-[28px] text-white shadow-lift">
      <CinematicBackdrop src={image} dim="medium" />
      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.35em] text-[#F3EA3B] uppercase">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {greet}
            {firstName && `, ${firstName}`}.
          </h1>
          {quote && (
            <blockquote className="mt-4">
              <p className="font-serif text-xl leading-snug italic text-white/90 sm:text-2xl">“{quote.text}”</p>
              <footer className="mt-2 text-[11px] tracking-[0.2em] text-white/50 uppercase">— {quote.author}</footer>
            </blockquote>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/propostas/nova">
              <Button className="bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] text-black shadow-[0_8px_30px_-8px_rgba(224,169,59,0.6)] hover:brightness-110">
                <Calculator className="h-4 w-4" /> Novo orçamento
              </Button>
            </Link>
            <Button variant="outline" onClick={onNewLead} className="text-white ring-white/25 hover:bg-white/10">
              <Users className="h-4 w-4" /> Novo lead
            </Button>
          </div>
        </div>
        {prefs.monthlyGoal > 0 && (
          <div className="flex items-center gap-5 rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-md">
            <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
              <defs>
                <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#F3EA3B" />
                  <stop offset="1" stopColor="#6CC690" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
              <circle cx="50" cy="50" r={R} fill="none" stroke="url(#goalGrad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-all duration-1000" />
              <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" className="fill-white font-serif text-[22px]">
                {Math.round(pct * 100)}%
              </text>
            </svg>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] tracking-[0.2em] text-white/50 uppercase">
                <Target className="h-3.5 w-3.5" /> Meta do mês
              </p>
              <p className="tnum mt-1 font-serif text-2xl">{brl(wonMonth, 0)}</p>
              <p className="tnum text-xs text-white/60">de {brl(prefs.monthlyGoal, 0)} · {deals}/{prefs.monthlyGoalDeals} contratos</p>
              <p className="mt-1 text-xs text-[#F3EA3B]">{missing > 0 ? `Faltam ${brl(missing, 0)} em ${daysLeft} dias` : "Meta batida! 🏆"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TipCard() {
  const [shift, setShift] = useState(0);
  const tip = pickDaily(SALES_TIPS, shift)!;
  return (
    <div className="mt-5 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sun-50 to-white p-4 ring-1 ring-sun-500/20">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sun-100 text-sun-700">
        <Lightbulb className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-wider text-sun-700 uppercase">Dica de venda · {tip.title}</p>
        <p className="text-sm text-ink-700">{tip.text}</p>
      </div>
      <button onClick={() => setShift((v) => v + 1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sun-700 hover:bg-sun-100" aria-label="Próxima dica">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
