"use client";

import {
  AlarmClock,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  ListTodo,
  Send,
  Timer,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Timeline } from "@/components/app/timeline";
import { Avatar, Empty, Segmented, Skeleton, cx } from "@/components/ui";
import { OPEN_STAGES, STAGES, TASK_TYPES, stageOf } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { brl, fmtNum } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import {
  PERIOD_LABEL,
  buildFeed,
  leadOwner,
  periodStart,
  personStats,
  presence,
  taskBuckets,
  taskOwner,
  type FeedItem,
  type Period,
  type TTask,
  type TeamData,
} from "@/lib/team";
import type { Profile, TaskType } from "@/lib/types";

type Tab = "timeline" | "tarefas" | "leads";

const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);
export default function EquipePage() {
  const { user, profile, profiles } = useApp();
  const isAdmin = profile?.role === "admin";
  const [period, setPeriod] = useState<Period>("7d");
  const [picked, setPicked] = useState<string>("todos");
  const [tab, setTab] = useState<Tab>("timeline");
  const [feedLimit, setFeedLimit] = useState(60);
  const sel = isAdmin ? picked : user.id;

  const { data, loading } = useLive<TeamData>(
    async () => {
      const sb = supabase();
      const since = periodStart("30d").toISOString();
      const sinceDay = since.slice(0, 10);
      const [openT, doneT, acts, leads, props, xp, usage] = await Promise.all([
        sb.from("tasks").select("id,title,type,priority,due_at,done,done_at,assigned_to,created_by,lead_id,cadence, lead:leads(id,name)").eq("done", false).limit(4000),
        sb.from("tasks").select("id,title,type,priority,due_at,done,done_at,assigned_to,created_by,lead_id,cadence, lead:leads(id,name)").eq("done", true).gte("done_at", since).limit(4000),
        sb.from("activities").select("id,lead_id,type,content,created_by,created_at, lead:leads(id,name)").gte("created_at", since).order("created_at", { ascending: false }).limit(3000),
        sb.from("leads").select("id,name,status,owner_id,created_by,created_at,updated_at,estimated_value").limit(6000),
        sb.from("proposals").select("id,number,lead_id,status,final_price,created_by,created_at,sent_at, lead:leads(id,name)").or(`created_at.gte.${since},sent_at.gte.${since}`).limit(3000),
        sb.from("xp_events").select("user_id,kind,points,created_at").gte("created_at", since).limit(8000),
        sb.from("usage_daily").select("user_id,day,minutes,last_ping").gte("day", sinceDay).limit(4000),
      ]);
      const rows = <T,>(r: { data: unknown; error: unknown }) => (r.error ? [] : ((r.data ?? []) as T[]));
      return {
        tasks: [...new Map([...rows<TTask>(openT), ...rows<TTask>(doneT)].map((t) => [t.id, t])).values()],
        activities: rows(acts),
        leads: rows(leads),
        proposals: rows(props),
        xp: rows(xp),
        usage: rows(usage),
      };
    },
    [],
    ["tasks", "activities", "leads", "proposals"],
  );

  const from = useMemo(() => periodStart(period), [period]);
  const team = useMemo(() => profiles.filter((p) => p.active !== false), [profiles]);
  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const people = useMemo(() => {
    if (!data) return [];
    const list = (isAdmin ? team : team.filter((p) => p.id === user.id)).map((p) => ({ p, s: personStats(p.id, data, from) }));
    return list.sort((a, b) => b.s.xp - a.s.xp || b.s.actions - a.s.actions);
  }, [data, team, from, isAdmin, user.id]);

  const totals = useMemo(() => {
    const online = people.filter(({ s }) => presence(s.lastSeen).online).length;
    return {
      online,
      actions: people.reduce((n, { s }) => n + s.actions + s.done + s.leads + s.proposals, 0),
      late: people.reduce((n, { s }) => n + s.late, 0),
      done: people.reduce((n, { s }) => n + s.done, 0),
      sales: people.reduce((n, { s }) => n + s.sales, 0),
    };
  }, [people]);

  const feed = useMemo(() => (data ? buildFeed(data, from, sel === "todos" ? null : sel, (s) => stageOf(s).label) : []), [data, from, sel]);
  const selProfile = sel === "todos" ? null : byId.get(sel) ?? null;

  const pick = (id: string, t?: Tab) => {
    setPicked(id);
    if (t) setTab(t);
    setFeedLimit(60);
    requestAnimationFrame(() => document.getElementById("detalhe")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="animate-fade-up space-y-5">
      {/* --------------------------------------------------------- topo */}
      <section className="glass-dark relative overflow-hidden rounded-[28px] p-5 text-white sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#9BD373]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#5B34D6]/40 blur-[100px]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-[#F3EA3B] uppercase ring-1 ring-white/15">
              {isAdmin ? <Crown className="h-3.5 w-3.5" /> : <Flame className="h-3.5 w-3.5" />} {isAdmin ? "Visão master" : "Meu desempenho"}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{isAdmin ? "Central da equipe" : "Minhas ações"}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/60">
              {isAdmin ? "Veja o que cada pessoa fez, quem está online, as tarefas de cada um e onde o funil está travando." : "Tudo o que você fez no período. Só o master vê a equipe inteira."}
            </p>
          </div>
          <div className="flex rounded-2xl bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur" role="tablist">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={period === k}
                onClick={() => setPeriod(k)}
                className={cx("h-9 rounded-xl px-4 text-sm font-semibold transition", period === k ? "bg-white text-[#1C1234] shadow" : "text-white/65 hover:text-white")}
              >
                {PERIOD_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { k: "Online agora", v: `${totals.online}/${people.length}`, icon: <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span> },
            { k: "Ações no período", v: fmtNum(totals.actions), icon: <Zap className="h-4 w-4 text-[#F3EA3B]" /> },
            { k: "Tarefas concluídas", v: fmtNum(totals.done), icon: <CheckCircle2 className="h-4 w-4 text-[#9BD373]" /> },
            { k: "Tarefas atrasadas", v: fmtNum(totals.late), icon: <AlarmClock className={cx("h-4 w-4", totals.late ? "text-rose-400" : "text-white/50")} />, alert: totals.late > 0 },
          ].map((x) => (
            <div key={x.k} className={cx("rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 backdrop-blur", x.alert && "ring-rose-400/40")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-white/55 uppercase">{x.k}</p>
                {x.icon}
              </div>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{loading && !data ? "—" : x.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- pessoas */}
      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : (
        isAdmin && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {people.map(({ p, s }, i) => (
              <PersonCard key={p.id} p={p} s={s} rank={i + 1} active={sel === p.id} me={p.id === user.id} onPick={(t) => pick(p.id, t)} />
            ))}
          </div>
        )
      )}

      {/* --------------------------------------------------------- detalhe */}
      <section id="detalhe" className="glass scroll-mt-20 overflow-hidden rounded-3xl">
        <div className="flex flex-col gap-3 border-b border-ink-900/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            {selProfile ? (
              <Avatar name={selProfile.full_name} src={selProfile.avatar_url} className="h-11 w-11 ring-2 ring-white" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#1C1234] to-[#3a2a6b] text-[#F3EA3B]">
                <Users className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              {selProfile ? (
                <Link href={`/perfil/${selProfile.id}`} className="block truncate font-display text-lg font-semibold hover:underline">
                  {selProfile.full_name ?? selProfile.email}
                </Link>
              ) : (
                <p className="truncate font-display text-lg font-semibold">Toda a equipe</p>
              )}
              <p className="text-xs text-ink-500">{PERIOD_LABEL[period]} · {feed.length} ações registradas</p>
            </div>
            {isAdmin && sel !== "todos" && (
              <button onClick={() => pick("todos")} className="ml-1 shrink-0 rounded-full bg-ink-900/[0.05] px-3 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-900/10">
                Ver todos
              </button>
            )}
          </div>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "timeline", label: "Linha do tempo" },
              { value: "tarefas", label: "Tarefas" },
              { value: "leads", label: "Leads" },
            ]}
          />
        </div>

        {isAdmin && (
          <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-ink-900/[0.06] px-4 py-3 sm:px-5">
            <PersonChip on={sel === "todos"} onClick={() => pick("todos")} label="Todos" />
            {team.map((p) => (
              <PersonChip key={p.id} on={sel === p.id} onClick={() => pick(p.id)} label={(p.full_name ?? p.email ?? "?").split(" ")[0]} profile={p} />
            ))}
          </div>
        )}

        <div className="p-4 sm:p-5">
          {!data ? (
            <Skeleton className="h-64" />
          ) : tab === "timeline" ? (
            <Timeline feed={feed.slice(0, feedLimit)} total={feed.length} more={() => setFeedLimit((n) => n + 80)} showUser={sel === "todos"} byId={byId} />
          ) : tab === "tarefas" ? (
            sel === "todos" ? (
              <TeamTasks data={data} from={from} people={people.map((x) => x.p)} onPick={(id) => pick(id, "tarefas")} byId={byId} />
            ) : (
              <PersonTasks data={data} uid={sel} from={from} team={team} canEdit={isAdmin || sel === user.id} />
            )
          ) : (
            <LeadsView data={data} uid={sel === "todos" ? null : sel} byId={byId} />
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ cartões */

function PersonCard({ p, s, rank, active, me, onPick }: { p: Profile; s: ReturnType<typeof personStats>; rank: number; active: boolean; me: boolean; onPick: (t?: Tab) => void }) {
  const pr = presence(s.lastSeen);
  const pct = s.completion == null ? null : Math.round(s.completion * 100);
  return (
    <article
      onClick={() => onPick()}
      className={cx(
        "glass group relative cursor-pointer overflow-hidden rounded-3xl p-4 transition duration-300 hover:-translate-y-0.5 sm:p-5",
        active && "ring-2 ring-[#1C1234] [box-shadow:0_20px_40px_-18px_rgba(28,18,52,0.45)]",
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-gradient-to-br from-[#F3EA3B]/30 to-[#9BD373]/20 opacity-0 blur-2xl transition group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar name={p.full_name} src={p.avatar_url} className="h-12 w-12 ring-2 ring-white" />
          <span className={cx("absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white", pr.online ? "bg-emerald-500" : "bg-ink-300")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/perfil/${p.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-display text-[15px] font-semibold hover:underline">
              {p.full_name ?? p.email}
            </Link>
            {me && <span className="shrink-0 text-[10px] font-semibold text-ink-400">(você)</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {p.role === "admin" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#1C1234] to-[#3a2a6b] px-2 py-0.5 text-[10px] font-bold text-[#F3EA3B]">
                <Crown className="h-3 w-3" /> Master
              </span>
            ) : (
              <span className="rounded-full bg-ink-900/[0.05] px-2 py-0.5 text-[10px] font-bold text-ink-600">Vendedor</span>
            )}
            <span className={cx("text-[11px]", pr.online ? "font-semibold text-emerald-600" : "text-ink-400")}>{pr.label}</span>
          </div>
        </div>
        <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-sm font-bold", rank === 1 ? "bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234]" : "bg-ink-900/[0.05] text-ink-500")}>
          {rank}º
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPick("tarefas");
          }}
          className={cx("rounded-2xl p-2.5 text-left ring-1 transition hover:bg-white", s.late ? "bg-rose-50/80 ring-rose-200" : "bg-white/60 ring-ink-900/5")}
        >
          <p className="text-[10px] font-semibold text-ink-500 uppercase">Abertas</p>
          <p className="font-display text-xl font-semibold tabular-nums">{s.open}</p>
          <p className={cx("text-[10px] font-semibold", s.late ? "text-rose-600" : "text-ink-400")}>{s.late ? `${s.late} atrasada${s.late > 1 ? "s" : ""}` : `${s.today} para hoje`}</p>
        </button>
        <div className="rounded-2xl bg-white/60 p-2.5 ring-1 ring-ink-900/5">
          <p className="text-[10px] font-semibold text-ink-500 uppercase">Feitas</p>
          <p className="font-display text-xl font-semibold tabular-nums">{s.done}</p>
          <p className="text-[10px] font-semibold text-ink-400">{pct == null ? "no período" : `${pct}% em dia`}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPick("timeline");
          }}
          className="rounded-2xl bg-white/60 p-2.5 text-left ring-1 ring-ink-900/5 transition hover:bg-white"
        >
          <p className="text-[10px] font-semibold text-ink-500 uppercase">Ações</p>
          <p className="font-display text-xl font-semibold tabular-nums">{s.actions + s.leads + s.proposals}</p>
          <p className="text-[10px] font-semibold text-ink-400">{fmtNum(s.xp)} XP</p>
        </button>
      </div>

      {pct != null && (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-ink-900/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="relative mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1">
          <UserPlus className="h-3 w-3" /> {s.leads} leads
        </span>
        <span className="inline-flex items-center gap-1">
          <Send className="h-3 w-3" /> {s.sent} propostas
        </span>
        <span className="inline-flex items-center gap-1">
          <Crown className="h-3 w-3" /> {s.sales} vendas
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" /> {fmtMin(s.minutes)} no app
        </span>
      </div>
    </article>
  );
}

function PersonChip({ on, onClick, label, profile }: { on: boolean; onClick: () => void; label: string; profile?: Profile }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full pr-3.5 text-[13px] font-semibold ring-1 transition",
        profile ? "pl-1" : "pl-3.5",
        on ? "bg-[#1C1234] text-white ring-[#1C1234]" : "bg-white/70 text-ink-700 ring-ink-900/10 hover:bg-white",
      )}
    >
      {profile && <Avatar name={profile.full_name} src={profile.avatar_url} className="h-7 w-7" />}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ tarefas */

function TeamTasks({ data, from, people, onPick, byId }: { data: TeamData; from: Date; people: Profile[]; onPick: (id: string) => void; byId: Map<string, Profile> }) {
  const rows = people.map((p) => ({ p, b: taskBuckets(data.tasks, p.id, from) }));
  const max = Math.max(1, ...rows.map(({ b }) => b.late.length + b.today.length + b.upcoming.length + b.done.length));
  const late = taskBuckets(data.tasks, null, from).late.slice(0, 12);
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-[11px] font-bold tracking-wide text-ink-500 uppercase">Tarefas por pessoa</p>
        <div className="space-y-2">
          {rows.map(({ p, b }) => {
            const seg = [
              { n: b.late.length, cls: "bg-rose-500", l: "atrasadas" },
              { n: b.today.length, cls: "bg-amber-400", l: "hoje" },
              { n: b.upcoming.length, cls: "bg-sky-400", l: "próximas" },
              { n: b.done.length, cls: "bg-gradient-to-r from-[#9BD373] to-[#6CC690]", l: "feitas" },
            ];
            return (
              <button key={p.id} onClick={() => onPick(p.id)} className="group flex w-full items-center gap-3 rounded-2xl bg-white/50 p-2.5 text-left ring-1 ring-ink-900/5 transition hover:bg-white">
                <Avatar name={p.full_name} src={p.avatar_url} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{p.full_name ?? p.email}</p>
                    <p className="shrink-0 text-[11px] text-ink-500 tabular-nums">
                      {b.late.length > 0 && <b className="text-rose-600">{b.late.length} atrasadas · </b>}
                      {b.today.length} hoje · {b.upcoming.length} próximas · {b.done.length} feitas
                    </p>
                  </div>
                  <div className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-ink-900/[0.05]">
                    {seg.map((x) => x.n > 0 && <div key={x.l} className={cx("h-full first:rounded-l-full last:rounded-r-full", x.cls)} style={{ width: `${(x.n / max) * 100}%` }} title={`${x.n} ${x.l}`} />)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-500" />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-500">
          {[
            ["bg-rose-500", "Atrasadas"],
            ["bg-amber-400", "Hoje"],
            ["bg-sky-400", "Próximas"],
            ["bg-[#9BD373]", "Feitas no período"],
          ].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span className={cx("h-2 w-2 rounded-full", c)} /> {l}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wide text-rose-600 uppercase">Mais atrasadas da equipe</p>
        {late.length ? (
          <div className="divide-y divide-ink-900/[0.05] overflow-hidden rounded-2xl bg-white/50 ring-1 ring-ink-900/5">
            {late.map((t) => (
              <TaskLine key={t.id} t={t} owner={byId.get(taskOwner(t) ?? "")} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-emerald-50/80 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">Nenhuma tarefa atrasada. Equipe em dia! 🎉</p>
        )}
      </div>
    </div>
  );
}

function PersonTasks({ data, uid, from, team, canEdit }: { data: TeamData; uid: string; from: Date; team: Profile[]; canEdit: boolean }) {
  const b = taskBuckets(data.tasks, uid, from);
  const [busy, setBusy] = useState<string | null>(null);
  const complete = async (t: TTask) => {
    setBusy(t.id);
    const { error } = await supabase().from("tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", t.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("Tarefa concluída");
  };
  const reassign = async (t: TTask, to: string) => {
    setBusy(t.id);
    const { error } = await supabase().from("tasks").update({ assigned_to: to }).eq("id", t.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Tarefa passada para ${team.find((p) => p.id === to)?.full_name?.split(" ")[0] ?? "outra pessoa"}`);
  };
  const sections: { k: string; title: string; list: TTask[]; cls: string; icon: typeof AlarmClock }[] = [
    { k: "late", title: "Atrasadas", list: b.late, cls: "text-rose-600", icon: AlarmClock },
    { k: "today", title: "Para hoje", list: b.today, cls: "text-amber-700", icon: CalendarClock },
    { k: "up", title: "Próximas", list: b.upcoming, cls: "text-sky-700", icon: ListTodo },
    { k: "done", title: "Concluídas no período", list: b.done, cls: "text-emerald-700", icon: CheckCircle2 },
  ];
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link href={`/tarefas?pessoa=${uid}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-sun-700 hover:underline">
          Abrir na tela de Tarefas <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {sections.map(({ k, title, list, cls, icon: Icon }) => (
        <div key={k}>
          <p className={cx("mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase", cls)}>
            <Icon className="h-3.5 w-3.5" /> {title} <span className="text-ink-400">({list.length})</span>
          </p>
          {list.length ? (
            <div className="divide-y divide-ink-900/[0.05] overflow-hidden rounded-2xl bg-white/50 ring-1 ring-ink-900/5">
              {list.slice(0, k === "done" || k === "up" ? 15 : 50).map((t) => (
                <TaskLine
                  key={t.id}
                  t={t}
                  actions={
                    canEdit && !t.done ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <select
                          aria-label="Passar para"
                          value={taskOwner(t) ?? ""}
                          disabled={busy === t.id}
                          onChange={(e) => reassign(t, e.target.value)}
                          className="h-8 max-w-[7.5rem] rounded-lg bg-white/80 px-2 text-xs ring-1 ring-ink-900/10"
                        >
                          {team.map((p) => (
                            <option key={p.id} value={p.id}>
                              {(p.full_name ?? p.email ?? "").split(" ")[0]}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => complete(t)}
                          disabled={busy === t.id}
                          aria-label="Concluir"
                          className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234] shadow-sm transition active:scale-90 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </div>
                    ) : null
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-ink-900/[0.03] px-4 py-3 text-sm text-ink-400">Nada aqui.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function TaskLine({ t, owner, actions }: { t: TTask; owner?: Profile; actions?: React.ReactNode }) {
  const late = !t.done && t.due_at && new Date(t.due_at) < new Date();
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {owner && <Avatar name={owner.full_name} src={owner.avatar_url} className="h-8 w-8" />}
      <div className="min-w-0 flex-1">
        <p className={cx("truncate text-sm font-medium", t.done && "text-ink-400 line-through")}>{t.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          <span className="rounded bg-ink-900/[0.05] px-1.5 py-px text-[10px] font-semibold">{TASK_TYPES[t.type as TaskType] ?? t.type}</span>
          {t.cadence && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sun-700"><Zap className="h-2.5 w-2.5" /> cadência</span>}
          {t.done ? (
            <span>feita {relativeTime(t.done_at)}</span>
          ) : t.due_at ? (
            <span className={cx(late && "font-semibold text-rose-600")}>{late ? `venceu ${relativeTime(t.due_at)}` : new Date(t.due_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          ) : (
            <span>sem prazo</span>
          )}
          {t.lead && (
            <Link href={`/leads/${t.lead.id}`} className="truncate font-semibold text-sun-700 hover:underline">
              {t.lead.name}
            </Link>
          )}
        </p>
      </div>
      {actions}
    </div>
  );
}

/* ------------------------------------------------------------------ leads */

function LeadsView({ data, uid, byId }: { data: TeamData; uid: string | null; byId: Map<string, Profile> }) {
  const mine = data.leads.filter((l) => !uid || leadOwner(l) === uid);
  const open = mine.filter((l) => (OPEN_STAGES as string[]).includes(l.status));
  const lastTouch = new Map<string, string>();
  for (const a of data.activities) if (!lastTouch.has(a.lead_id)) lastTouch.set(a.lead_id, a.created_at);
  const stale = (l: (typeof open)[number]) => {
    const t = lastTouch.get(l.id) ?? l.updated_at;
    return Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
  };
  const list = [...open].sort((a, b) => stale(b) - stale(a));
  const total = open.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {STAGES.map((st) => {
          const n = mine.filter((l) => l.status === st.id).length;
          return (
            <div key={st.id} className="rounded-2xl bg-white/60 p-3 ring-1 ring-ink-900/5">
              <p className="flex items-center gap-1.5 truncate text-[11px] font-semibold text-ink-500">
                <span className={cx("h-2 w-2 shrink-0 rounded-full", st.dot)} /> {st.label}
              </p>
              <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">{n}</p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">Leads em aberto · mais parados primeiro</p>
        <p className="text-sm text-ink-600">
          Em negociação: <b className="text-ink-900">{brl(total, 0)}</b>
        </p>
      </div>
      {list.length ? (
        <div className="divide-y divide-ink-900/[0.05] overflow-hidden rounded-2xl bg-white/50 ring-1 ring-ink-900/5">
          {list.slice(0, 40).map((l) => {
            const d = stale(l);
            const owner = byId.get(leadOwner(l) ?? "");
            const st = stageOf(l.status);
            return (
              <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/80">
                {!uid && owner && <Avatar name={owner.full_name} src={owner.avatar_url} className="h-8 w-8" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="flex items-center gap-2 text-xs text-ink-500">
                    <span className={cx("inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1", st.soft)}>{st.label}</span>
                    {l.estimated_value ? <span>{brl(l.estimated_value, 0)}</span> : null}
                  </p>
                </div>
                <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", d >= 7 ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : d >= 3 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")}>
                  {d === 0 ? "mexido hoje" : `parado há ${d}d`}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Users className="h-6 w-6" />} title="Sem leads em aberto" />
      )}
    </div>
  );
}
