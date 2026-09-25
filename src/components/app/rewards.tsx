"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { REWARD_LINES, levelOf, pick, type Level, type XpKind } from "@/lib/gamification";
import { imagePool, pickDaily } from "@/lib/inspiration";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./app-context";
import { Confetti } from "./celebration";
import { CinematicBackdrop } from "./cinematic";

interface Pop {
  id: number;
  points: number;
  line: string;
  kind: XpKind;
}

interface RewardCtx {
  /** Mostra os pontos ganhos por uma ação (confere no banco se o ponto foi realmente concedido). */
  reward: (kind: XpKind, refId: string | null | undefined) => void;
  xp: number | null;
  streak: number;
  refresh: () => void;
}

const Ctx = createContext<RewardCtx>({ reward: () => {}, xp: null, streak: 0, refresh: () => {} });
export const useReward = () => useContext(Ctx);

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export function RewardProvider({ children }: { children: ReactNode }) {
  const { user, settings } = useApp();
  const [xp, setXp] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [levelUp, setLevelUp] = useState<Level | null>(null);
  const xpRef = useRef<number | null>(null);
  const enabled = useRef(true); // desliga em silêncio se o banco ainda não tem a gamificação

  const refresh = useCallback(async () => {
    if (!enabled.current) return;
    const sb = supabase();
    const [lb, days] = await Promise.all([
      sb.rpc("leaderboard", { p_from: "-infinity" }),
      sb.from("usage_daily").select("day, minutes").eq("user_id", user.id).order("day", { ascending: false }).limit(60),
    ]);
    if (lb.error) {
      if (/function|schema cache|does not exist/i.test(lb.error.message)) enabled.current = false;
      return;
    }
    const me = (lb.data as { user_id: string; total_xp: number }[]).find((r) => r.user_id === user.id);
    const total = Number(me?.total_xp ?? 0);
    const prev = xpRef.current;
    xpRef.current = total;
    setXp(total);
    if (prev != null && levelOf(total).level.n > levelOf(prev).level.n) setLevelUp(levelOf(total).level);

    // Sequência: dias seguidos com pelo menos 5 minutos de uso (hoje ou ontem ainda contam).
    const set = new Set(((days.data ?? []) as { day: string; minutes: number }[]).filter((d) => d.minutes >= 5).map((d) => d.day));
    let n = 0;
    const d = new Date(`${today()}T12:00:00`);
    if (!set.has(today())) d.setDate(d.getDate() - 1);
    while (set.has(d.toLocaleDateString("sv-SE"))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    setStreak(n);
  }, [user.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tempo de uso: um "ping" por minuto enquanto a tela está visível e a pessoa interagiu nos últimos 3 minutos.
  useEffect(() => {
    let last = Date.now();
    const mark = () => (last = Date.now());
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    let count = 0;
    const timer = setInterval(async () => {
      if (!enabled.current || document.visibilityState !== "visible" || Date.now() - last > 180000) return;
      const { error } = await supabase().rpc("track_usage");
      if (error && /function|schema cache|does not exist/i.test(error.message)) enabled.current = false;
      if (++count % 10 === 0) refresh(); // a cada 10 minutos, +1 XP
    }, 60000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [refresh]);

  const reward = useCallback(
    async (kind: XpKind, refId: string | null | undefined) => {
      if (!refId || !enabled.current) return;
      const { data, error } = await supabase().from("xp_events").select("points").eq("user_id", user.id).eq("kind", kind).eq("ref_id", refId).maybeSingle();
      if (error || !data) return; // limite do dia ou follow-up repetido: sem pontos, sem festa
      const pop: Pop = { id: Date.now() + Math.random(), points: data.points, line: pick(REWARD_LINES[kind]), kind };
      setPops((p) => [...p.slice(-2), pop]);
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== pop.id)), 3700);
      refresh();
    },
    [user.id, refresh],
  );

  return (
    <Ctx.Provider value={{ reward, xp, streak, refresh }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-8 lg:pl-[264px]">
        {pops.map((p) => (
          <XpPop key={p.id} pop={p} />
        ))}
      </div>
      {levelUp && <LevelUpOverlay level={levelUp} images={settings.app.images} onClose={() => setLevelUp(null)} />}
    </Ctx.Provider>
  );
}

function XpPop({ pop }: { pop: Pop }) {
  const big = pop.points >= 100;
  return (
    <div className="animate-xp-pop relative flex max-w-md items-center gap-3 rounded-2xl bg-ink-950/95 py-2.5 pr-5 pl-2.5 text-white shadow-lift ring-1 ring-white/10">
      <span className="tnum relative grid h-12 min-w-12 place-items-center rounded-xl bg-sun-gradient px-2 font-display text-lg font-bold text-ink-950">
        +{pop.points}
        <span className="animate-xp-float absolute -top-5 text-xs font-bold text-brand-lime">XP</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold tracking-[0.2em] text-brand-yellow uppercase">{big ? "Jogada de mestre" : "Mandou bem"}</span>
        <span className="block text-sm leading-snug text-white/90">{pop.line}</span>
      </span>
    </div>
  );
}

function LevelUpOverlay({ level, images, onClose }: { level: Level; images: string[]; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 10000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center text-white" onClick={onClose} role="dialog" aria-label="Novo nível">
      <CinematicBackdrop src={pickDaily(imagePool(images), 5)} />
      <Confetti />
      <button onClick={onClose} className="absolute top-6 right-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>
      <div className="animate-rise relative px-6 text-center">
        <p className="text-sm tracking-[0.5em] text-brand-yellow uppercase">Novo nível · {level.n}</p>
        <h2 className="text-sun-gradient mt-4 font-display text-6xl font-bold tracking-tight sm:text-8xl">{level.title}</h2>
        <p className="mt-6 font-serif text-2xl text-white/85 italic sm:text-3xl">“{level.motto}”</p>
        <p className="mt-8 text-xs tracking-[0.3em] text-white/50 uppercase">Toque para continuar</p>
      </div>
    </div>
  );
}
