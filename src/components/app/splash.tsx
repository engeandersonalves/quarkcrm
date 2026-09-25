"use client";

import { ArrowRight, Shuffle } from "lucide-react";
import { BrandLogo } from "./brand";
import { useEffect, useMemo, useState } from "react";
import { imagePool, pickDaily, quotePool } from "@/lib/inspiration";
import { brl } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./app-context";
import { CinematicBackdrop } from "./cinematic";
import { cx } from "../ui";

interface Snapshot {
  wonMonth: number;
  deals: number;
  tasksToday: number;
  viewed24h: number;
}

/** Tela de abertura cinematográfica: frase do dia, imagem e o placar do mês. */
export function Splash() {
  const { settings, settingsLoaded, user, profile } = useApp();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [shift, setShift] = useState(0);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const prefs = settings.app;

  // Decide se mostra (sempre por sessão, 1x por dia, ou nunca).
  useEffect(() => {
    if (!settingsLoaded || prefs.splash === "off") return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (prefs.splash === "daily") {
        const key = `splash-${user.id}`;
        if (localStorage.getItem(key) === today) return;
        localStorage.setItem(key, today);
      } else {
        if (sessionStorage.getItem("splash-shown")) return;
        sessionStorage.setItem("splash-shown", "1");
      }
    } catch {}
    setOpen(true);
  }, [settingsLoaded, prefs.splash, user.id]);

  useEffect(() => {
    if (!open) return;
    const sb = supabase();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    Promise.all([
      sb.from("proposals").select("final_price").eq("status", "aceita").gte("accepted_at", monthStart),
      sb.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lte("due_at", endToday.toISOString()),
      sb.from("proposals").select("id", { count: "exact", head: true }).gte("viewed_at", new Date(Date.now() - 86400000).toISOString()),
    ])
      .then(([won, tasks, viewed]) => {
        const rows = (won.data ?? []) as { final_price: number }[];
        setSnap({ wonMonth: rows.reduce((s, r) => s + Number(r.final_price), 0), deals: rows.length, tasksToday: tasks.count ?? 0, viewed24h: viewed.count ?? 0 });
      })
      .catch(() => {});
  }, [open]);

  const quotes = useMemo(() => quotePool(prefs.customQuotes, prefs.useDefaultQuotes), [prefs.customQuotes, prefs.useDefaultQuotes]);
  const images = useMemo(() => imagePool(prefs.images), [prefs.images]);
  const quote = pickDaily(quotes, shift)!;
  const image = pickDaily(images, shift);

  const close = () => {
    setLeaving(true);
    setTimeout(() => setOpen(false), 450);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const goalPct = prefs.monthlyGoal > 0 && snap ? Math.min(1, snap.wonMonth / prefs.monthlyGoal) : 0;
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  return (
    <div
      className={cx("fixed inset-0 z-[100] flex flex-col text-white transition-all duration-500", leaving ? "scale-[1.02] opacity-0" : "opacity-100")}
      role="dialog"
      aria-label="Abertura"
    >
      <CinematicBackdrop src={image} />

      <div className="relative flex items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-12">
        <BrandLogo className="h-10 sm:h-12" />
        <p className="hidden text-xs tracking-[0.3em] text-white/60 uppercase sm:block">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-24">
        <p key={`g${shift}`} className="animate-rise text-xs font-semibold tracking-[0.4em] text-[#F3EA3B] uppercase sm:text-sm">
          {greet}
          {firstName && `, ${firstName}`}
        </p>
        <blockquote key={`q${shift}`} className="animate-rise mt-6 max-w-4xl [animation-delay:150ms]">
          <p className="font-serif text-[34px] leading-[1.12] font-medium italic sm:text-6xl lg:text-7xl">
            <span className="text-gold not-italic">“</span>
            {quote.text}
            <span className="text-gold not-italic">”</span>
          </p>
          <footer className="mt-6 flex items-center gap-4 text-sm tracking-[0.2em] text-white/70 uppercase">
            <span className="h-px w-12 bg-gradient-to-r from-[#F3EA3B] to-transparent" />
            {quote.author}
          </footer>
        </blockquote>
      </div>

      <div className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-12 lg:px-24">
        <div className="animate-rise grid grid-cols-3 gap-2 [animation-delay:350ms] sm:gap-3">
          <Glass label="No mês" value={snap ? brl(snap.wonMonth, 0) : "—"}>
            {prefs.monthlyGoal > 0 && (
              <>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#6CC690] to-[#F3EA3B] transition-all duration-1000" style={{ width: `${goalPct * 100}%` }} />
                </div>
                <p className="mt-1.5 hidden text-[11px] text-white/50 sm:block">
                  {Math.round(goalPct * 100)}% da meta de {brl(prefs.monthlyGoal, 0)} · {daysLeft} dias restantes
                </p>
              </>
            )}
          </Glass>
          <Glass label="Tarefas hoje" value={snap ? String(snap.tasksToday) : "—"}>
            <p className="mt-1.5 hidden text-[11px] text-white/50 sm:block">{snap?.tasksToday ? "Cada follow-up é um contrato mais perto." : "Agenda limpa. Hora de prospectar."}</p>
          </Glass>
          <Glass label="Vistas 24h" value={snap ? String(snap.viewed24h) : "—"}>
            <p className="mt-1.5 hidden text-[11px] text-white/50 sm:block">{snap?.viewed24h ? "Clientes quentes: ligue agora." : "Envie propostas e acompanhe aqui."}</p>
          </Glass>
        </div>

        <div className="mt-4 flex flex-col-reverse items-stretch gap-2 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <button onClick={() => setShift((s) => s + 1)} className="flex items-center justify-center gap-2 text-sm text-white/60 transition hover:text-white">
            <Shuffle className="h-4 w-4" /> Outra frase
          </button>
          <button
            autoFocus
            onClick={close}
            className="group flex h-14 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] px-8 text-base font-bold text-black shadow-[0_10px_40px_-8px_rgba(224,169,59,0.6)] transition hover:brightness-110"
          >
            Entrar no jogo <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Glass({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-md sm:p-4">
      <p className="truncate text-[9px] tracking-[0.15em] text-white/50 uppercase sm:text-[11px] sm:tracking-[0.2em]">{label}</p>
      <p className="tnum mt-1 truncate font-serif text-lg sm:text-3xl">{value}</p>
      {children}
    </div>
  );
}
