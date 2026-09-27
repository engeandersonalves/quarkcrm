"use client";

import { BellRing, CheckSquare, ChevronRight, Clock, Flame, Plus, Settings2, Sparkles, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { ALERT_STYLE } from "@/components/app/attention";
import { Mantra } from "@/components/app/mantra";
import { useQuick } from "@/components/app/shell";
import { TaskRow } from "@/components/app/task-row";
import { Button, Card, Empty, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { computeAlerts, type SmartAlert } from "@/lib/alerts";
import { TASK_TYPES } from "@/lib/constants";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow, Lead, Proposal, Task, TaskType } from "@/lib/types";

interface Data {
  tasks: Task[];
  leads: Lead[];
  proposals: Proposal[];
  documents: DocumentRow[];
}

const SNOOZE_KEY = "quark.alerts.snooze";
const readSnooze = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

export default function TasksPage() {
  const { user, settings } = useApp();
  const { openTask } = useQuick();
  const [scope, setScope] = useState<"minhas" | "todas">("minhas");
  const [type, setType] = useState<TaskType | "todas" | "auto">("todas");
  const [showDone, setShowDone] = useState(false);
  const [snooze, setSnooze] = useState<Record<string, number>>({});
  useEffect(() => setSnooze(readSnooze()), []);

  const { data, loading } = useLive<Data>(
    async () => {
      const sb = supabase();
      const [tasks, leads, proposals, docs] = await Promise.all([
        sb.from("tasks").select("*, lead:leads(id,name,phone,email,city,segment,status)").order("due_at", { ascending: true, nullsFirst: false }).limit(1500),
        sb.from("leads").select("id,name,status,segment,created_at,updated_at,owner_id,created_by"),
        sb.from("proposals").select("id,number,lead_id,status,sent_at,viewed_at,valid_until,created_by, lead:leads(id,name)").in("status", ["enviada", "visualizada"]),
        sb.from("documents").select("id,kind,title,lead_id,status,updated_at,signers:document_signers(name,signed_at)").neq("status", "assinado"),
      ]);
      return {
        tasks: must(tasks) as Task[],
        leads: must(leads) as Lead[],
        proposals: must(proposals) as unknown as Proposal[],
        documents: docs.error ? [] : ((docs.data ?? []) as unknown as DocumentRow[]),
      };
    },
    [],
    ["tasks", "leads", "proposals", "documents"],
  );

  const mine = (t: Task) => scope === "todas" || t.assigned_to === user.id || (!t.assigned_to && (t.created_by === user.id || !t.created_by));

  const view = useMemo(() => {
    const all = (data?.tasks ?? []).filter(mine);
    const rows = all.filter((t) => type === "todas" || (type === "auto" ? !!t.cadence : t.type === type));
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const week = new Date(start);
    week.setDate(week.getDate() + 7);
    const at = (t: Task) => (t.due_at ? new Date(t.due_at) : null);
    const open = rows.filter((t) => !t.done);
    const groups = [
      { key: "late", title: "Atrasadas", tone: "text-rose-600", items: open.filter((t) => at(t) && at(t)! < now) },
      { key: "today", title: "Hoje", tone: "text-ink-900", items: open.filter((t) => at(t) && at(t)! >= now && at(t)! < end) },
      { key: "week", title: "Próximos 7 dias", tone: "text-ink-900", items: open.filter((t) => at(t) && at(t)! >= end && at(t)! < week) },
      { key: "later", title: "Mais tarde", tone: "text-ink-900", items: open.filter((t) => at(t) && at(t)! >= week) },
      { key: "nodate", title: "Sem data", tone: "text-ink-900", items: open.filter((t) => !at(t)) },
      ...(showDone ? [{ key: "done", title: "Concluídas", tone: "text-emerald-700", items: rows.filter((t) => t.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")).slice(0, 50) }] : []),
    ].filter((g) => g.items.length);

    const allOpen = all.filter((t) => !t.done);
    const late = allOpen.filter((t) => at(t) && at(t)! < now).length;
    const dueToday = all.filter((t) => at(t) && at(t)! >= start && at(t)! < end);
    const doneToday = all.filter((t) => t.done && t.done_at && new Date(t.done_at) >= start).length;
    const todayTotal = Math.max(dueToday.length, doneToday + dueToday.filter((t) => !t.done).length);
    const next7 = allOpen.filter((t) => at(t) && at(t)! >= end && at(t)! < week).length;
    const auto = allOpen.filter((t) => t.cadence).length;
    const counts = Object.fromEntries((Object.keys(TASK_TYPES) as TaskType[]).map((k) => [k, allOpen.filter((t) => t.type === k).length])) as Record<TaskType, number>;
    return { groups, late, doneToday, todayTotal, next7, auto, counts, pending: allOpen.length };
  }, [data, scope, type, showDone, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const alerts = useMemo(() => {
    if (!data) return [];
    const myLeads = scope === "todas" ? data.leads : data.leads.filter((l) => !l.owner_id || l.owner_id === user.id || l.created_by === user.id);
    const ids = new Set(myLeads.map((l) => l.id));
    const now = Date.now();
    return computeAlerts({
      leads: myLeads,
      proposals: data.proposals.filter((p) => ids.has(p.lead_id)),
      tasks: data.tasks,
      documents: data.documents,
    }).filter((a) => a.kind !== "overdue" && !(snooze[a.id] > now));
  }, [data, scope, snooze, user.id]);

  const dismiss = (id: string) => {
    const next = { ...readSnooze(), [id]: Date.now() + 86400000 };
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
    } catch {
      /* navegação privada */
    }
    setSnooze(next);
  };

  const resolve = async (a: SmartAlert) => {
    if (!a.suggest || !a.leadId) return;
    const row = {
      title: a.suggest.title,
      type: a.suggest.type,
      priority: "alta",
      due_at: new Date(Date.now() + 5 * 60000).toISOString(),
      lead_id: a.leadId,
      assigned_to: user.id,
      created_by: user.id,
    };
    let { error } = await supabase().from("tasks").insert({ ...row, copy: a.suggest.copy });
    // Banco ainda sem a coluna "copy" (schema.sql antigo): cria a tarefa mesmo assim.
    if (error && /copy/.test(error.message)) ({ error } = await supabase().from("tasks").insert({ ...row, description: a.suggest.copy }));
    if (error) return toast.error(error.message);
    toast.success("Follow-up agendado com mensagem pronta", { description: "Abra a tarefa em “Hoje” e envie com um toque." });
    dismiss(a.id);
  };

  const cadenceOn = settings.cadence.enabled;
  const pct = view.todayTotal ? Math.round((view.doneToday / view.todayTotal) * 100) : 0;

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      <PageHeader
        title="Tarefas e follow-ups"
        subtitle={`${view.pending} pendente${view.pending === 1 ? "" : "s"} · cadência automática ${cadenceOn ? "ligada" : "desligada"} · o responsável recebe alerta por e-mail`}
        actions={
          <>
            <Link href="/configuracoes?aba=cadencias">
              <Button variant="secondary">
                <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Cadências</span>
              </Button>
            </Link>
            <Button onClick={() => openTask()}>
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          </>
        }
      />
      <Mantra seed={21} />

      {/* Indicadores do dia */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="relative col-span-2 flex items-center gap-4 overflow-hidden rounded-2xl bg-ink-950 p-4 text-white shadow-lift lg:col-span-1">
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-sun-500/30 blur-2xl" />
          <Ring value={pct} />
          <div className="relative min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/50 uppercase">Hoje</p>
            <p className="font-display text-xl font-semibold tabular-nums">
              {view.doneToday}/{view.todayTotal || 0} <span className="text-sm font-medium text-white/60">feitas</span>
            </p>
            <p className="text-xs text-white/60">{pct >= 100 && view.todayTotal ? "Dia zerado. Lenda! 🏆" : view.todayTotal ? "Cada follow-up é uma venda mais perto." : "Nada para hoje — adiante a semana."}</p>
          </div>
        </div>
        <Stat icon={<Flame className="h-4 w-4" />} tone="bg-rose-50 text-rose-600" label="Atrasadas" value={view.late} hint={view.late ? "Resolva primeiro" : "Nenhuma 🎉"} />
        <Stat icon={<Clock className="h-4 w-4" />} tone="bg-sky-50 text-sky-600" label="Próximos 7 dias" value={view.next7} hint="Já agendadas" />
        <Stat icon={<Zap className="h-4 w-4" />} tone="bg-ink-900 text-brand-yellow" label="Da cadência" value={view.auto} hint={cadenceOn ? "Criadas sozinhas pelo funil" : "Cadência desligada"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Alertas */}
        <aside className="grid content-start gap-4 lg:order-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3.5">
              <div>
                <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
                  <BellRing className="h-4 w-4 text-sun-600" /> Alertas inteligentes
                </h2>
                <p className="text-xs text-ink-500">Oportunidades esfriando e pendências</p>
              </div>
              {alerts.length > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600 tabular-nums">{alerts.length}</span>}
            </div>
            {loading && !data ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : !alerts.length ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">Nenhum alerta. Seu funil está sob controle ✨</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {alerts.slice(0, 12).map((a) => (
                  <li key={a.id} className="group px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${ALERT_STYLE[a.kind].tone}`}>{ALERT_STYLE[a.kind].icon}</span>
                      <Link href={a.href} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900 group-hover:underline">{a.title}</span>
                        <span className="line-clamp-2 text-xs text-ink-500">{a.text}</span>
                      </Link>
                      <button onClick={() => dismiss(a.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-ink-100 hover:text-ink-600" aria-label="Lembrar amanhã" title="Lembrar amanhã">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-11">
                      {a.suggest && (
                        <button onClick={() => resolve(a)} className="inline-flex h-7 items-center gap-1 rounded-lg bg-ink-900 px-2.5 text-[12px] font-semibold text-white hover:bg-ink-800">
                          <Sparkles className="h-3.5 w-3.5 text-brand-yellow" /> Agendar follow-up
                        </button>
                      )}
                      {a.cta && (
                        <Link href={a.cta.href} className="inline-flex h-7 items-center gap-1 rounded-lg bg-sun-gradient px-2.5 text-[12px] font-semibold text-ink-950">
                          {a.cta.label} <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Link
            href="/configuracoes?aba=cadencias"
            className="group relative block overflow-hidden rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70 transition hover:ring-ink-300"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-yellow">
                <Zap className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Cadência automática {cadenceOn ? "ligada" : "desligada"}</p>
                <p className="text-xs text-ink-500">Ao criar ou mover um lead no funil, as tarefas da etapa nascem sozinhas com a mensagem pronta. Personalize os passos e as copys.</p>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-ink-300 group-hover:text-ink-500" />
            </div>
          </Link>
        </aside>

        {/* Lista */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: "minhas", label: "Minhas" },
                { value: "todas", label: "Toda a equipe" },
              ]}
            />
            <button onClick={() => setShowDone((v) => !v)} className="text-[13px] font-semibold text-ink-500 hover:text-ink-900">
              {showDone ? "Ocultar concluídas" : "Mostrar concluídas"}
            </button>
          </div>
          <div className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip on={type === "todas"} onClick={() => setType("todas")}>
              Todas
            </Chip>
            <Chip on={type === "auto"} onClick={() => setType("auto")}>
              <Zap className="h-3 w-3" /> Cadência <b className="tabular-nums">{view.auto}</b>
            </Chip>
            {(Object.keys(TASK_TYPES) as TaskType[])
              .filter((k) => view.counts[k] > 0 || type === k)
              .map((k) => (
                <Chip key={k} on={type === k} onClick={() => setType(k)}>
                  {TASK_TYPES[k]} <b className="tabular-nums">{view.counts[k]}</b>
                </Chip>
              ))}
          </div>

          {loading && !data ? (
            <div className="grid gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !view.groups.length ? (
            <Card>
              <Empty icon={<CheckSquare className="h-6 w-6" />} title="Tudo em dia! 🎉" text="Nenhuma tarefa pendente aqui. Que tal agendar o próximo follow-up?" action={<Button onClick={() => openTask()}>Criar tarefa</Button>} />
            </Card>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
              {view.groups.map((g) => (
                <section key={g.key}>
                  <h2 className={cx("mb-2 flex items-center gap-2 px-1 text-[13px] font-bold tracking-wide uppercase", g.tone)}>
                    {g.title}
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">{g.items.length}</span>
                  </h2>
                  <Card className="p-1.5">
                    {g.items.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </Card>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1 transition",
        on ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: string; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink-500">{label}</p>
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs text-ink-400">{hint}</p>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 60 60" className="relative h-16 w-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6" />
      <circle cx="30" cy="30" r={r} fill="none" stroke="url(#ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(value, 100) / 100)} className="transition-all duration-700" />
      <defs>
        <linearGradient id="ring" x1="0" x2="1">
          <stop offset="0" stopColor="#F3EA3B" />
          <stop offset="1" stopColor="#6CC690" />
        </linearGradient>
      </defs>
      <text x="30" y="34" textAnchor="middle" className="rotate-90 fill-white text-[13px] font-bold" style={{ transformOrigin: "30px 30px" }}>
        {value}%
      </text>
    </svg>
  );
}
