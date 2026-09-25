"use client";

import { Clock, Crown, FileText, Flame, Handshake, Lock, Phone, Send, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { CinematicBackdrop } from "@/components/app/cinematic";
import { useReward } from "@/components/app/rewards";
import { Avatar, Card, CardHeader, Empty, Segmented, Skeleton, cx } from "@/components/ui";
import { BADGES, LEVELS, USAGE_RULE, XP_TABLE, fmtMinutes, levelOf, type Stats } from "@/lib/gamification";
import { imagePool, pickDaily, quotePool } from "@/lib/inspiration";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

type Period = "hoje" | "semana" | "mes" | "sempre";

interface Row extends Stats {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  xp: number;
}

function periodStart(p: Period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (p === "mes") d.setDate(1);
  return p === "sempre" ? "-infinity" : d.toISOString();
}

const PERIOD_LABEL: Record<Period, string> = { hoje: "de hoje", semana: "da semana", mes: "do mês", sempre: "de todos os tempos" };

export default function RankingPage() {
  const { user, settings } = useApp();
  const { xp: myXp, streak } = useReward();
  const [period, setPeriod] = useState<Period>("semana");

  const { data, loading, error } = useLive(
    async () => {
      const sb = supabase();
      const [p, all] = await Promise.all([sb.rpc("leaderboard", { p_from: periodStart(period) }), sb.rpc("leaderboard", { p_from: "-infinity" })]);
      const norm = (rows: unknown) => ((rows ?? []) as Row[]).map((r) => ({ ...r, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v])) }) as Row);
      return { rows: norm(must(p)), all: norm(must(all)) };
    },
    [period],
    ["xp_events"],
  );

  const rows = data?.rows ?? [];
  const me = data?.all.find((r) => r.user_id === user.id);
  const totalXp = myXp ?? me?.total_xp ?? 0;
  const lv = levelOf(totalXp);
  const quote = useMemo(() => pickDaily(quotePool(settings.app.customQuotes, settings.app.useDefaultQuotes), 11) ?? { text: "O mundo é seu.", author: "Scarface (1983)" }, [settings.app]);
  const image = useMemo(() => pickDaily(imagePool(settings.app.images), 7), [settings.app.images]);
  const podium = [rows[1], rows[0], rows[2]];
  const myPos = rows.findIndex((r) => r.user_id === user.id);

  return (
    <div className="animate-fade-up">
      {/* Cabeçalho cinematográfico */}
      <section className="relative mb-5 overflow-hidden rounded-[28px] text-white">
        <CinematicBackdrop src={image} dim="medium" />
        <div className="relative grid gap-6 p-6 sm:p-9 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.4em] text-brand-yellow uppercase">
              Arena · temporada de {new Date().toLocaleDateString("pt-BR", { month: "long" })}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Quem manda no pregão?</h1>
            <p className="mt-4 max-w-xl font-serif text-xl text-white/85 italic">“{quote.text}”</p>
            <p className="mt-1 text-xs tracking-[0.3em] text-white/50 uppercase">— {quote.author}</p>
          </div>
          <div className="rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-white/60 uppercase">Seu nível · {lv.level.n}</p>
              {streak > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-brand-yellow">
                  <Flame className="h-3.5 w-3.5" /> {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
                </span>
              )}
            </div>
            <p className="text-sun-gradient mt-1 font-display text-4xl font-bold">{lv.level.title}</p>
            <p className="mt-1 text-sm text-white/70 italic">{lv.level.motto}</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-sun-gradient transition-all duration-1000" style={{ width: `${Math.max(3, lv.progress * 100)}%` }} />
            </div>
            <p className="tnum mt-2 text-xs text-white/60">
              {totalXp.toLocaleString("pt-BR")} XP
              {lv.next ? ` · faltam ${lv.toNext.toLocaleString("pt-BR")} para ${lv.next.title}` : " · você chegou ao topo"}
            </p>
            {myPos >= 0 && rows.length > 1 && (
              <p className="mt-3 text-sm font-semibold">
                {myPos === 0 ? "👑 Você lidera o ranking " : `#${myPos + 1} no ranking `}
                {PERIOD_LABEL[period]}
              </p>
            )}
          </div>
        </div>
      </section>

      <Segmented<Period>
        className="mb-5"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "hoje", label: "Hoje" },
          { value: "semana", label: "Semana" },
          { value: "mes", label: "Mês" },
          { value: "sempre", label: "Sempre" },
        ]}
      />

      {error ? (
        <Card>
          <Empty
            icon={<Trophy className="h-6 w-6" />}
            title="Falta ativar a gamificação no banco"
            text="Rode o arquivo supabase/schema.sql no SQL Editor do Supabase (ele não apaga nada). Depois, atualize esta página."
          />
        </Card>
      ) : loading && !data ? (
        <div className="grid gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="mb-5 grid grid-cols-3 items-end gap-2 sm:gap-4">
            {podium.map((r, i) => {
              const place = i === 1 ? 1 : i === 0 ? 2 : 3;
              if (!r) return <div key={i} />;
              const h = place === 1 ? "h-44 sm:h-52" : place === 2 ? "h-32 sm:h-40" : "h-24 sm:h-32";
              return (
                <div key={r.user_id} className="flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    {place === 1 && <Crown className="absolute -top-6 left-1/2 h-6 w-6 -translate-x-1/2 text-brand-yellow drop-shadow" />}
                    <div className={cx("rounded-full p-[3px]", place === 1 ? "bg-sun-gradient" : "bg-ink-200")}>
                      <Avatar name={r.full_name ?? r.email} className={cx("ring-2 ring-white", place === 1 ? "h-16 w-16 text-lg" : "h-12 w-12")} />
                    </div>
                  </div>
                  <p className="max-w-full truncate text-sm font-semibold">{(r.full_name ?? r.email ?? "").split(" ")[0]}</p>
                  <p className="text-[11px] text-ink-500">{levelOf(r.total_xp).level.title}</p>
                  <div
                    className={cx(
                      "mt-2 flex w-full flex-col items-center justify-start rounded-t-2xl pt-3 text-white",
                      h,
                      place === 1 ? "bg-ink-900" : place === 2 ? "bg-ink-700" : "bg-ink-600",
                    )}
                  >
                    <span className={cx("font-display font-bold", place === 1 ? "text-sun-gradient text-4xl" : "text-2xl text-white/80")}>{place}º</span>
                    <span className="tnum mt-1 text-sm font-semibold">{r.xp.toLocaleString("pt-BR")} XP</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela completa */}
          <Card className="mb-5 overflow-hidden">
            <CardHeader title={`Ranking ${PERIOD_LABEL[period]}`} subtitle="Atualiza em tempo real a cada ponto conquistado" />
            {rows.length === 0 ? (
              <Empty icon={<Users className="h-6 w-6" />} title="Ninguém pontuou ainda" text="O primeiro lead do dia já coloca você no topo." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-[11px] tracking-wider text-ink-500 uppercase">
                    <tr className="border-y border-ink-100 bg-ink-50/60">
                      <th className="px-5 py-2.5 font-semibold">#</th>
                      <th className="px-3 py-2.5 font-semibold">Vendedor</th>
                      <th className="px-3 py-2.5 text-right font-semibold">XP</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Leads</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Follow-ups</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Propostas</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Vendas</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Tempo no app</th>
                    </tr>
                  </thead>
                  <tbody className="tnum divide-y divide-ink-100">
                    {rows.map((r, i) => (
                      <tr key={r.user_id} className={cx(r.user_id === user.id && "bg-sun-50/70")}>
                        <td className="px-5 py-3 font-display font-bold text-ink-400">{i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}º`}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.full_name ?? r.email} className="h-8 w-8 text-xs" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink-900">
                                {r.full_name ?? r.email}
                                {r.user_id === user.id && <span className="ml-1.5 text-xs font-medium text-sun-700">(você)</span>}
                              </p>
                              <p className="text-xs text-ink-500">
                                Nível {levelOf(r.total_xp).level.n} · {levelOf(r.total_xp).level.title}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-display text-base font-bold">{r.xp.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-3 text-right">{r.leads}</td>
                        <td className="px-3 py-3 text-right">{r.followups}</td>
                        <td className="px-3 py-3 text-right">
                          {r.proposals}
                          {r.sent ? <span className="text-ink-400"> · {r.sent} env.</span> : null}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-sun-700">{r.sales}</td>
                        <td className="px-5 py-3 text-right text-ink-600">{fmtMinutes(r.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* Conquistas */}
            <Card>
              <CardHeader title="Suas conquistas" subtitle={`${BADGES.filter((b) => me && b.done(me)).length} de ${BADGES.length} desbloqueadas`} />
              <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
                {BADGES.map((b) => {
                  const done = !!me && b.done(me);
                  const [cur, goal] = me ? b.progress(me) : [0, 1];
                  return (
                    <div key={b.id} className={cx("rounded-2xl p-3 text-center ring-1", done ? "bg-gradient-to-b from-sun-50 to-white ring-sun-300" : "bg-ink-50 ring-ink-200/70")}>
                      <div className={cx("mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl", done ? "bg-white shadow-soft" : "bg-ink-100 grayscale")}>
                        {done ? b.icon : <Lock className="h-5 w-5 text-ink-400" />}
                      </div>
                      <p className={cx("mt-2 text-[13px] leading-tight font-semibold", done ? "text-ink-900" : "text-ink-500")}>{b.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{b.text}</p>
                      {!done && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-200">
                          <div className="h-full rounded-full bg-sun-gradient" style={{ width: `${Math.min(100, (cur / goal) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Regras */}
            <Card>
              <CardHeader title="Como ganhar XP" subtitle="Os pontos são contados automaticamente pelo sistema" />
              <ul className="grid gap-1 px-5 pb-4">
                {XP_TABLE.map((x) => (
                  <li key={x.kind} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">{KIND_ICON[x.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{x.label}</span>
                      <span className="block text-xs text-ink-500">{x.hint}</span>
                    </span>
                    <span className="tnum rounded-lg bg-sun-gradient px-2 py-1 text-xs font-bold text-ink-900">+{x.points}</span>
                  </li>
                ))}
                <li className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
                    <Clock className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{USAGE_RULE}</span>
                </li>
              </ul>
              <div className="border-t border-ink-100 px-5 py-4">
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">Níveis</p>
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l) => (
                    <span
                      key={l.n}
                      className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", l.n <= lv.level.n ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500")}
                      title={`${l.min.toLocaleString("pt-BR")} XP`}
                    >
                      {l.n}. {l.title}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

const KIND_ICON: Record<string, React.ReactNode> = {
  lead: <Users className="h-4 w-4" />,
  followup: <Phone className="h-4 w-4" />,
  tarefa: <Flame className="h-4 w-4" />,
  proposta: <FileText className="h-4 w-4" />,
  envio: <Send className="h-4 w-4" />,
  venda: <Handshake className="h-4 w-4" />,
  aceite: <Trophy className="h-4 w-4" />,
};
