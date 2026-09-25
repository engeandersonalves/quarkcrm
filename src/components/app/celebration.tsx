"use client";

import { Trophy, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { imagePool, pickDaily } from "@/lib/inspiration";
import { brl } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./app-context";
import { CinematicBackdrop } from "./cinematic";

interface Win {
  title: string;
  name: string;
  amount?: number;
}

const Ctx = createContext<(w: Win) => void>(() => {});
export const useCelebrate = () => useContext(Ctx);

const LINES = ["O mundo é seu.", "Isso é só o começo.", "Mais um telhado gerando dinheiro.", "Fortuna favorece os audazes.", "Contrato fechado. Próximo!"];
const COLORS = ["#F3EA3B", "#9BD373", "#ffffff", "#F3EA3B", "#34d399"];

/** Comemoração em tela cheia quando uma venda fecha ou uma proposta é aceita. */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const [win, setWin] = useState<Win | null>(null);
  const enabled = settings.app.celebrate;

  const celebrate = useCallback((w: Win) => enabled && setWin(w), [enabled]);

  // Proposta aceita pelo cliente (link público) chega em tempo real.
  useEffect(() => {
    if (!enabled) return;
    const sb = supabase();
    const channel = sb
      .channel("celebrate-proposals")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "proposals" }, async (payload: { new: Record<string, unknown> }) => {
        const p = payload.new as unknown as { status: string; accepted_at: string | null; lead_id: string; final_price: number; number: number };
        if (p.status !== "aceita" || !p.accepted_at || Date.now() - new Date(p.accepted_at).getTime() > 120000) return;
        const { data } = await sb.from("leads").select("name").eq("id", p.lead_id).maybeSingle();
        setWin({ title: `Proposta #${p.number} aceita!`, name: data?.name ?? "Cliente", amount: Number(p.final_price) });
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [enabled]);

  useEffect(() => {
    if (!win) return;
    const t = setTimeout(() => setWin(null), 9000);
    return () => clearTimeout(t);
  }, [win]);

  return (
    <Ctx.Provider value={celebrate}>
      {children}
      {win && <Overlay win={win} images={settings.app.images} onClose={() => setWin(null)} />}
    </Ctx.Provider>
  );
}

function Overlay({ win, images, onClose }: { win: Win; images: string[]; onClose: () => void }) {
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center text-white" onClick={onClose} role="dialog" aria-label="Venda fechada">
      <CinematicBackdrop src={pickDaily(imagePool(images), 3)} />
      <Confetti />
      <button onClick={onClose} className="absolute top-6 right-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>
      <div className="animate-rise relative px-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#6CC690] shadow-[0_0_80px_rgba(247,215,116,0.5)]">
          <Trophy className="h-10 w-10 text-black" />
        </div>
        <p className="mt-6 text-sm tracking-[0.4em] text-[#F3EA3B] uppercase">{win.title}</p>
        <h2 className="mt-3 font-serif text-5xl italic sm:text-7xl">{line}</h2>
        <p className="mt-5 text-lg text-white/80">
          {win.name}
          {win.amount ? (
            <>
              {" "}
              · <span className="tnum text-gold font-semibold">{brl(win.amount, 0)}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/** Chuva de confete nas cores da marca. */
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 2.8 + Math.random() * 2.5,
        dx: `${(Math.random() - 0.5) * 30}vw`,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.6,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? 999 : 2,
            background: p.color,
            animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.2,.6,.4,1) forwards`,
            ["--dx" as string]: p.dx,
          }}
        />
      ))}
    </div>
  );
}
