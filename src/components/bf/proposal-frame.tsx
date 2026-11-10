"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BF_END, BF_LABEL, bfPhase, timeLeft } from "@/lib/black-friday";

/**
 * Veste a proposta do cliente com o visual da Black Friday enquanto a campanha
 * não termina. Depois do dia 27 a proposta volta ao visual normal sozinha.
 */
export function BfProposalFrame({ children }: { children: ReactNode }) {
  // Relógio só no navegador: evita diferença de segundos entre servidor e navegador
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { phase, target } = bfPhase(now ?? Date.now());
  if (phase === "encerrada") return <>{children}</>;
  const t = target && now ? timeLeft(target, now) : null;
  const tape = ["Black Friday Quark", BF_LABEL, "Instalação em até 30 dias", "72x sem entrada", "21x no cartão"];
  const row = [...tape, ...tape, ...tape];
  return (
    <div className="theme-dark bf-doc">
      <div className="no-print relative z-30 overflow-hidden bg-[#6FBF8E] py-2 whitespace-nowrap text-[#0A0D0B]">
        <div className="bf-marquee inline-flex">
          {[0, 1].map((k) => (
            <span key={k} className="inline-flex" aria-hidden={k === 1}>
              {row.map((x, i) => (
                <span key={i} className="px-5 text-[12px] font-bold tracking-[0.16em] uppercase sm:text-[13px]">
                  {x} <span className="pl-5 opacity-60">•</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="bf-strip no-print sticky top-0 z-30 border-b border-white/[0.06] bg-[#050706]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5">
          <p className="flex items-center gap-2 text-[13px] font-bold sm:text-[14px]">
            <span className="rounded-[6px] bg-[linear-gradient(95deg,#F3E93B,#9FDB7C,#4FC38A)] px-2 py-0.5 text-[11px] font-black tracking-[0.12em] text-[#0A0D0B]">BLACK FRIDAY</span>
            <span className="text-white">{phase === "antes" ? "Condição de Black garantida para você" : "Proposta com condição de Black Friday"}</span>
          </p>
          {t && (
            <p className="flex items-center gap-2 text-[12px] font-semibold text-white/60">
              {phase === "antes" ? "começa em" : "termina em"}
              <span className="flex gap-1 font-bold text-[#0A0D0B] tabular-nums">
                {[t.d, t.h, t.m, t.s].map((v, i) => (
                  <span key={i} className="grid h-6 min-w-[28px] place-items-center rounded-[6px] bg-[#fff] px-1 text-[12px]">
                    {String(v).padStart(2, "0")}
                    {i === 0 ? "d" : ""}
                  </span>
                ))}
              </span>
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export const BF_PROPOSAL_UNTIL = BF_END;
