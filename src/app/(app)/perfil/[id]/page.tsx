"use client";

import { Camera, CalendarDays, Crown, Flame, ImagePlus, Loader2, Lock, Mail, MessageCircle, Pencil, Send, Sparkles, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { AvatarPicker } from "@/components/app/onboarding";
import { Timeline } from "@/components/app/timeline";
import { Avatar, Button, Empty, Field, Input, Modal, Segmented, Skeleton, Textarea, cx } from "@/components/ui";
import { POSTERS, posterUrl } from "@/lib/cinema";
import { stageOf } from "@/lib/constants";
import { relativeTime, whatsappUrl } from "@/lib/format";
import { BADGES, TIER_STYLE, fmtMinutes, levelOf, type Stats } from "@/lib/gamification";
import { useLive } from "@/lib/live";
import { fmtNum } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import { buildFeed, type TeamData } from "@/lib/team";
import { uploadImage } from "@/lib/upload";

type Tab = "geral" | "mural" | "atividades" | "conquistas";
interface Update {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

/** Capas prontas em degradê (além dos pôsteres e de foto enviada). */
const GRADIENTS: Record<string, string> = {
  aurora: "linear-gradient(120deg, #1C1234 0%, #3a2a6b 35%, #2f7a5a 75%, #9BD373 100%)",
  solar: "linear-gradient(120deg, #1C1234 0%, #6b4b12 45%, #F3EA3B 100%)",
  neon: "linear-gradient(120deg, #07060F 0%, #5B34D6 50%, #ff3b8d 100%)",
  oceano: "linear-gradient(120deg, #07131f 0%, #0f4c75 50%, #6CC690 100%)",
};
const DEFAULT_COVER = "gradient:aurora";

function coverBg(url: string | null | undefined): React.CSSProperties {
  const v = url || DEFAULT_COVER;
  if (v.startsWith("gradient:")) return { backgroundImage: GRADIENTS[v.slice(9)] ?? GRADIENTS.aurora };
  return { backgroundImage: `url("${v}")`, backgroundSize: "cover", backgroundPosition: "center 60%" };
}

const EMPTY_STATS: Stats = { total_xp: 0, leads: 0, followups: 0, proposals: 0, sent: 0, sales: 0, minutes: 0, active_days: 0 };

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, profile: me, profiles } = useApp();
  const person = profiles.find((p) => p.id === id) ?? null;
  const isMe = id === user.id;
  const canEdit = isMe || me?.role === "admin";
  const [tab, setTab] = useState<Tab>("geral");
  const [editing, setEditing] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [feedLimit, setFeedLimit] = useState(40);
  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const { data, loading } = useLive(
    async () => {
      const sb = supabase();
      const since = new Date(Date.now() - 84 * 86400000).toISOString();
      const [lb, xp, usage, acts, doneT, leads, props, ups] = await Promise.all([
        sb.rpc("leaderboard", { p_from: "-infinity" }),
        sb.from("xp_events").select("kind,points,created_at").eq("user_id", id).gte("created_at", since).limit(6000),
        sb.from("usage_daily").select("day,minutes").eq("user_id", id).gte("day", since.slice(0, 10)).limit(200),
        sb.from("activities").select("id,lead_id,type,content,created_by,created_at, lead:leads(id,name)").eq("created_by", id).gte("created_at", since).order("created_at", { ascending: false }).limit(800),
        sb.from("tasks").select("id,title,type,priority,due_at,done,done_at,assigned_to,created_by,lead_id, lead:leads(id,name)").eq("assigned_to", id).eq("done", true).gte("done_at", since).limit(800),
        sb.from("leads").select("id,name,status,owner_id,created_by,created_at,updated_at,estimated_value").eq("created_by", id).gte("created_at", since).limit(800),
        sb.from("proposals").select("id,number,lead_id,status,final_price,created_by,created_at,sent_at, lead:leads(id,name)").eq("created_by", id).gte("created_at", since).limit(800),
        sb.from("profile_updates").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(60),
      ]);
      const board = (lb.data ?? []) as (Stats & { user_id: string })[];
      const rank = board.findIndex((r) => r.user_id === id);
      const rows = <T,>(r: { data: unknown; error: unknown }) => (r.error ? [] : ((r.data ?? []) as T[]));
      const team: TeamData = { activities: rows(acts), tasks: rows(doneT), leads: rows(leads), proposals: rows(props), xp: [], usage: [] };
      return {
        stats: rank >= 0 ? { ...EMPTY_STATS, ...board[rank] } : EMPTY_STATS,
        rank: rank >= 0 ? rank + 1 : null,
        teamSize: board.length,
        xp: rows<{ kind: string; points: number; created_at: string }>(xp),
        usage: rows<{ day: string; minutes: number }>(usage),
        team,
        updates: rows<Update>(ups),
        updatesMissing: !!ups.error,
      };
    },
    [id],
    ["activities", "tasks", "leads", "proposals", "xp_events", "profile_updates", "profiles"],
  );

  const stats = data?.stats ?? EMPTY_STATS;
  const lvl = levelOf(Number(stats.total_xp) || 0);
  const unlocked = BADGES.filter((b) => b.done(stats));
  const feed = useMemo(() => (data ? buildFeed(data.team, new Date(0), id, (s) => stageOf(s).label) : []), [data, id]);

  // Mapa de calor: 12 semanas de XP + tempo de uso por dia.
  const heat = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const x of data?.xp ?? []) {
      const d = new Date(x.created_at).toLocaleDateString("en-CA");
      byDay.set(d, (byDay.get(d) ?? 0) + x.points);
    }
    for (const u of data?.usage ?? []) byDay.set(u.day, (byDay.get(u.day) ?? 0) + Math.floor(Math.min(u.minutes, 240) / 10));
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 83 - today.getDay());
    const days: { day: string; v: number; future: boolean }[] = [];
    for (let d = new Date(start); days.length < 12 * 7; d.setDate(d.getDate() + 1)) {
      const key = d.toLocaleDateString("en-CA");
      days.push({ day: key, v: byDay.get(key) ?? 0, future: d > today });
    }
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].future) continue;
      if (days[i].v > 0) streak++;
      else if (i !== days.length - 1 || days[i].day !== today.toLocaleDateString("en-CA")) break;
    }
    const max = Math.max(1, ...days.map((d) => d.v));
    const active = days.filter((d) => d.v > 0).length;
    return { days, max, streak, active };
  }, [data]);

  if (!person) {
    return (
      <div className="glass mx-auto max-w-lg rounded-3xl">
        <Empty icon={<Crown className="h-6 w-6" />} title="Perfil não encontrado" text="Essa pessoa não faz parte da equipe ou o acesso foi bloqueado." action={<Link href="/"><Button size="sm">Voltar ao painel</Button></Link>} />
      </div>
    );
  }

  const first = (person.full_name ?? person.email ?? "").split(" ")[0];
  const since = person.created_at ? new Date(person.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : null;

  return (
    <div className="animate-fade-up -mt-1 space-y-5">
      {/* ------------------------------------------------ capa + cabeçalho */}
      <section className="glass overflow-hidden rounded-[28px]">
        <div className="relative h-44 sm:h-64" style={coverBg(person.cover_url)}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#07060F]/80 via-[#07060F]/10 to-transparent" />
          <div className="pointer-events-none absolute -top-16 right-10 h-56 w-56 rounded-full bg-[#F3EA3B]/20 blur-3xl" />
          {canEdit && (
            <button onClick={() => setEditing(true)} className="absolute top-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/40 px-3 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-black/60">
              <ImagePlus className="h-4 w-4" /> Trocar capa
            </button>
          )}
        </div>
        <div className="relative px-5 pb-5 sm:px-8 sm:pb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
              <div className="relative -mt-14 w-fit shrink-0 sm:-mt-16">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#F3EA3B] via-[#9BD373] to-[#6CC690] opacity-90 blur-[2px]" />
                <Avatar name={person.full_name} src={person.avatar_url} className="relative h-28 w-28 text-2xl ring-4 ring-white sm:h-32 sm:w-32" />
                {isMe && (
                  <button onClick={() => setAvatarOpen(true)} aria-label="Trocar foto" className="absolute right-0 bottom-1 grid h-9 w-9 place-items-center rounded-full bg-[#1C1234] text-[#F3EA3B] ring-4 ring-white transition active:scale-90">
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="min-w-0 sm:pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">{person.full_name ?? person.email}</h1>
                  {person.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#1C1234] to-[#3a2a6b] px-2.5 py-0.5 text-[11px] font-bold text-[#F3EA3B]">
                      <Crown className="h-3 w-3" /> Master
                    </span>
                  ) : (
                    <span className="rounded-full bg-ink-900/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-ink-600">Vendedor</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink-600">{person.headline || (isMe ? "Adicione uma frase que te define ✍️" : `${lvl.level.title} da equipe`)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-700">
                    <Trophy className="h-3.5 w-3.5 text-[#c7be40]" /> Nível {lvl.level.n} · {lvl.level.title}
                  </span>
                  {heat.streak > 1 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-orange-600">
                      <Flame className="h-3.5 w-3.5" /> {heat.streak} dias seguidos
                    </span>
                  )}
                  {since && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> Desde {since}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pt-4">
              {canEdit && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Editar perfil
                </Button>
              )}
              {!isMe && person.phone && (
                <a href={whatsappUrl(person.phone, `Oi, ${first}!`)} target="_blank" rel="noreferrer">
                  <Button>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
              {!isMe && person.email && (
                <a href={`mailto:${person.email}`}>
                  <Button variant="secondary">
                    <Mail className="h-4 w-4" /> E-mail
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* XP */}
          <div className="mt-5 rounded-2xl bg-gradient-to-r from-[#1C1234] to-[#2a1d4d] p-4 text-white ring-1 ring-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-[15px] text-white/80 italic">“{lvl.level.motto}”</p>
              <p className="text-xs text-white/60">
                <b className="font-display text-base text-[#F3EA3B]">{fmtNum(Number(stats.total_xp) || 0)} XP</b>
                {lvl.next ? ` · faltam ${fmtNum(lvl.toNext)} para ${lvl.next.title}` : " · nível máximo"}
              </p>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] transition-all duration-1000" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
            </div>
          </div>

          {/* Números */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { k: "Leads", v: stats.leads },
              { k: "Follow-ups", v: stats.followups },
              { k: "Propostas", v: stats.sent },
              { k: "Vendas", v: stats.sales, hi: true },
              { k: "Dias ativos", v: stats.active_days },
              { k: "No app", v: fmtMinutes(Number(stats.minutes) || 0), raw: true },
            ].map((x) => (
              <div key={x.k} className={cx("rounded-2xl p-3 text-center ring-1", x.hi ? "bg-gradient-to-br from-[#F3EA3B]/30 to-[#9BD373]/30 ring-[#9BD373]/40" : "bg-white/60 ring-ink-900/5")}>
                <p className="font-display text-xl font-semibold tabular-nums">{loading && !data ? "—" : x.raw ? x.v : fmtNum(Number(x.v) || 0)}</p>
                <p className="text-[11px] font-semibold text-ink-500">{x.k}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ abas */}
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "geral", label: "Visão geral" },
            { value: "mural", label: `Atualizações${data?.updates.length ? ` · ${data.updates.length}` : ""}` },
            { value: "atividades", label: "Atividades" },
            { value: "conquistas", label: `Conquistas · ${unlocked.length}/${BADGES.length}` },
          ]}
        />
      </div>

      {!data ? (
        <Skeleton className="h-72 rounded-3xl" />
      ) : tab === "geral" ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="glass rounded-3xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-[15px] font-semibold">Ritmo das últimas 12 semanas</h2>
                <p className="text-xs text-ink-500">
                  {heat.active} {heat.active === 1 ? "dia" : "dias"} com ação{heat.streak > 1 ? ` · sequência atual de ${heat.streak}` : ""}
                </p>
              </div>
              <Heatmap days={heat.days} max={heat.max} />
            </section>
            <section className="glass rounded-3xl p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-[15px] font-semibold">Conquistas recentes</h2>
                <button onClick={() => setTab("conquistas")} className="text-[13px] font-semibold text-sun-700 hover:underline">
                  Ver todas
                </button>
              </div>
              {unlocked.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[...unlocked].reverse().slice(0, 4).map((b) => (
                    <BadgeTile key={b.id} b={b} stats={stats} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Nenhuma ainda. A primeira vem no primeiro lead cadastrado! 🎯</p>
              )}
            </section>
          </div>
          <div className="space-y-5">
            <section className="glass rounded-3xl p-5">
              <h2 className="font-display text-[15px] font-semibold">Sobre</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-700">{person.bio || (isMe ? "Conte um pouco sobre você: há quanto tempo vende energia solar, sua especialidade, uma meta." : "Sem apresentação ainda.")}</p>
              {isMe && !person.bio && (
                <button onClick={() => setEditing(true)} className="mt-3 text-[13px] font-semibold text-sun-700 hover:underline">
                  Escrever minha bio
                </button>
              )}
            </section>
            <section className="glass rounded-3xl p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-[15px] font-semibold">Últimas atualizações</h2>
                <button onClick={() => setTab("mural")} className="text-[13px] font-semibold text-sun-700 hover:underline">
                  Abrir mural
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {data.updates.slice(0, 3).map((u) => (
                  <div key={u.id} className="rounded-2xl bg-white/60 p-3 ring-1 ring-ink-900/5">
                    <p className="text-sm whitespace-pre-line text-ink-800">{u.content}</p>
                    <p className="mt-1 text-[11px] text-ink-400">{relativeTime(u.created_at)}</p>
                  </div>
                ))}
                {!data.updates.length && <p className="text-sm text-ink-500">{isMe ? "Compartilhe uma conquista, uma dica ou a meta da semana." : "Nada publicado ainda."}</p>}
              </div>
            </section>
          </div>
        </div>
      ) : tab === "mural" ? (
        <Mural updates={data.updates} missing={data.updatesMissing} canPost={isMe} canDelete={(u) => u.user_id === user.id || me?.role === "admin"} person={person} />
      ) : tab === "atividades" ? (
        <section className="glass rounded-3xl p-4 sm:p-5">
          <p className="mb-3 text-xs text-ink-500">Últimas 12 semanas · {feed.length} ações</p>
          <Timeline feed={feed.slice(0, feedLimit)} total={feed.length} more={() => setFeedLimit((n) => n + 60)} showUser={false} byId={byId} />
        </section>
      ) : (
        <section className="glass rounded-3xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[15px] font-semibold">
              {unlocked.length} de {BADGES.length} conquistas desbloqueadas
            </h2>
            <div className="flex gap-2 text-[11px] font-semibold">
              {(Object.keys(TIER_STYLE) as (keyof typeof TIER_STYLE)[]).map((t) => (
                <span key={t} className={cx("rounded-full bg-gradient-to-br px-2 py-0.5 ring-1", TIER_STYLE[t].bg, TIER_STYLE[t].ring, TIER_STYLE[t].text)}>
                  {TIER_STYLE[t].label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {BADGES.map((b) => (
              <BadgeTile key={b.id} b={b} stats={stats} />
            ))}
          </div>
        </section>
      )}

      {editing && <EditProfile person={person} onClose={() => setEditing(false)} />}
      <AvatarPicker open={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ peças */

function Heatmap({ days, max }: { days: { day: string; v: number; future: boolean }[]; max: number }) {
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const shade = (v: number) => (v <= 0 ? "bg-ink-900/[0.06]" : v < max * 0.25 ? "bg-[#d9efc4]" : v < max * 0.5 ? "bg-[#b5e08f]" : v < max * 0.75 ? "bg-[#86cf7d]" : "bg-[#3f9c6a]");
  return (
    <div className="mt-4">
      <div className="scrollbar-none flex gap-[5px] overflow-x-auto pb-1">
        <div className="mr-1 grid grid-rows-7 gap-[5px] text-[9px] leading-none text-ink-400">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <span key={i} className="flex h-[15px] items-center">
              {i % 2 ? d : ""}
            </span>
          ))}
        </div>
        {weeks.map((w, i) => (
          <div key={i} className="grid grid-rows-7 gap-[5px]">
            {w.map((d) => (
              <span
                key={d.day}
                title={`${new Date(d.day + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${d.v} XP`}
                className={cx("h-[15px] w-[15px] rounded-[4px]", d.future ? "bg-transparent" : shade(d.v))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-ink-400">
        menos
        {["bg-ink-900/[0.06]", "bg-[#d9efc4]", "bg-[#b5e08f]", "bg-[#86cf7d]", "bg-[#3f9c6a]"].map((c) => (
          <span key={c} className={cx("h-2.5 w-2.5 rounded-[3px]", c)} />
        ))}
        mais
      </div>
    </div>
  );
}

function BadgeTile({ b, stats }: { b: (typeof BADGES)[number]; stats: Stats }) {
  const done = b.done(stats);
  const [cur, goal] = b.progress(stats);
  const tier = TIER_STYLE[b.tier ?? "bronze"];
  return (
    <div className={cx("relative overflow-hidden rounded-2xl p-3.5 ring-1 transition", done ? cx("bg-gradient-to-br shadow-[0_10px_24px_-14px_rgba(28,18,52,0.45)]", tier.bg, tier.ring) : "bg-white/50 ring-ink-900/5")}>
      {done && <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-white/50 blur-xl" />}
      <div className="relative flex items-start justify-between gap-2">
        <span className={cx("grid h-11 w-11 place-items-center rounded-2xl text-2xl", done ? "bg-white/70 shadow-sm" : "bg-ink-900/[0.05] grayscale")}>{b.icon}</span>
        {done ? (
          <span className={cx("rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold", tier.text)}>{tier.label}</span>
        ) : (
          <Lock className="h-4 w-4 text-ink-300" />
        )}
      </div>
      <p className={cx("relative mt-2 text-sm font-semibold", done ? "text-ink-950" : "text-ink-500")}>{b.title}</p>
      <p className={cx("relative text-[11px]", done ? "text-ink-700" : "text-ink-400")}>{b.text}</p>
      {!done && (
        <div className="relative mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373]" style={{ width: `${Math.round((cur / goal) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-ink-400 tabular-nums">
            {fmtNum(cur)}/{fmtNum(goal)}
          </p>
        </div>
      )}
    </div>
  );
}

function Mural({ updates, missing, canPost, canDelete, person }: { updates: Update[]; missing: boolean; canPost: boolean; canDelete: (u: Update) => boolean; person: { full_name: string | null; avatar_url?: string | null } }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const post = async () => {
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    const { error } = await supabase().from("profile_updates").insert({ content });
    setBusy(false);
    if (error) return toast.error(/profile_updates/.test(error.message) ? "Rode novamente o supabase/schema.sql para liberar o mural." : error.message);
    setText("");
    toast.success("Publicado no seu mural");
  };
  const remove = async (u: Update) => {
    const { error } = await supabase().from("profile_updates").delete().eq("id", u.id);
    if (error) toast.error(error.message);
  };
  const ideas = ["🏆 Fechei mais um contrato hoje!", "🎯 Minha meta da semana: ", "💡 Dica que funcionou comigo: ", "☀️ Obra entregue: "];
  return (
    <section className="space-y-4">
      {missing && <p className="rounded-2xl bg-amber-50/90 p-4 text-sm text-amber-800 ring-1 ring-amber-200">O mural precisa de uma atualização no banco: rode novamente o arquivo supabase/schema.sql no Supabase.</p>}
      {canPost && !missing && (
        <div className="glass rounded-3xl p-4">
          <div className="flex gap-3">
            <Avatar name={person.full_name} src={person.avatar_url} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} placeholder="Compartilhe uma conquista, uma dica ou a meta da semana…" className="min-h-[76px]" />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ideas.map((i) => (
                  <button key={i} onClick={() => setText(i)} className="rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-900/10">
                    {i.trim()}
                  </button>
                ))}
                <Button size="sm" className="ml-auto" onClick={post} loading={busy} disabled={!text.trim()}>
                  <Send className="h-3.5 w-3.5" /> Publicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {updates.length ? (
        updates.map((u) => (
          <article key={u.id} className="glass rounded-3xl p-4">
            <div className="flex items-start gap-3">
              <Avatar name={person.full_name} src={person.avatar_url} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {person.full_name} <span className="font-normal text-ink-400">· {relativeTime(u.created_at)}</span>
                </p>
                <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line text-ink-800">{u.content}</p>
              </div>
              {canDelete(u) && (
                <button onClick={() => remove(u)} aria-label="Apagar" className="grid h-8 w-8 place-items-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </article>
        ))
      ) : (
        !missing && (
          <div className="glass rounded-3xl">
            <Empty icon={<Sparkles className="h-6 w-6" />} title="Mural vazio" text={canPost ? "Sua primeira publicação aparece aqui para toda a equipe." : "Nenhuma atualização publicada ainda."} />
          </div>
        )
      )}
    </section>
  );
}

function EditProfile({ person, onClose }: { person: { id: string; headline?: string | null; bio?: string | null; cover_url?: string | null }; onClose: () => void }) {
  const [headline, setHeadline] = useState(person.headline ?? "");
  const [bio, setBio] = useState(person.bio ?? "");
  const [cover, setCover] = useState(person.cover_url || DEFAULT_COVER);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase()
      .from("profiles")
      .update({ headline: headline.trim() || null, bio: bio.trim() || null, cover_url: cover })
      .eq("id", person.id);
    setSaving(false);
    if (error) return toast.error(/cover_url|headline|bio/.test(error.message) ? "Rode novamente o supabase/schema.sql para liberar a capa e a bio." : error.message);
    toast.success("Perfil atualizado");
    onClose();
  };
  const upload = async (f: File) => {
    setUploading(true);
    try {
      setCover(await uploadImage(f, "covers"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio");
    }
    setUploading(false);
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar perfil"
      subtitle="Capa, frase de apresentação e bio aparecem para toda a equipe."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar perfil
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-600">Capa</p>
          <div className="relative h-28 overflow-hidden rounded-2xl ring-1 ring-ink-900/10" style={coverBg(cover)}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <button onClick={() => fileRef.current?.click()} className="absolute right-2 bottom-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/50 px-3 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Enviar foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          <div className="scrollbar-none mt-2 flex gap-2 overflow-x-auto pb-1">
            {Object.keys(GRADIENTS).map((g) => (
              <button key={g} onClick={() => setCover(`gradient:${g}`)} aria-label={`Degradê ${g}`} className={cx("h-14 w-20 shrink-0 rounded-xl ring-2 transition", cover === `gradient:${g}` ? "ring-[#1C1234]" : "ring-transparent hover:ring-ink-300")} style={coverBg(`gradient:${g}`)} />
            ))}
            {POSTERS.map((p) => (
              <button key={p.id} onClick={() => setCover(posterUrl(p.id))} aria-label={p.title} title={p.title} className={cx("h-14 w-20 shrink-0 rounded-xl bg-cover bg-center ring-2 transition", cover === posterUrl(p.id) ? "ring-[#1C1234]" : "ring-transparent hover:ring-ink-300")} style={{ backgroundImage: `url("${posterUrl(p.id)}")`, backgroundPosition: "center 60%" }} />
            ))}
          </div>
        </div>
        <Field label="Frase de apresentação" hint={`${headline.length}/80 · ex.: “Especialista em energia solar para comércios”`}>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value.slice(0, 80))} placeholder="O que te define em uma frase?" />
        </Field>
        <Field label="Bio" hint={`${bio.length}/400`}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 400))} placeholder="Há quanto tempo vende energia solar, sua especialidade, sua meta do ano…" className="min-h-[110px]" />
        </Field>
      </div>
    </Modal>
  );
}
