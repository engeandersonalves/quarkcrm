"use client";

import { useEffect, useState } from "react";
import { BF_LABEL, bfPhase, timeLeft } from "@/lib/black-friday";

/** Campanha ainda valendo (antes ou durante). */
export function useBf() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const p = bfPhase(now);
  return p.phase === "encerrada" ? null : { ...p, left: p.target ? timeLeft(p.target, now) : null };
}

const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";

/** Selo e faixas diagonais na capa da proposta. */
export function BfCoverStamp() {
  const bf = useBf();
  if (!bf) return null;
  const words = Array.from({ length: 10 }, () => "BLACK FRIDAY QUARK");
  return (
    <>
      <div className="pointer-events-none absolute top-[38%] right-[6%] z-[1] hidden rotate-[-8deg] sm:block">
        <div className={`rounded-[18px] px-6 py-4 text-center text-[#0A0D0B] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] ${GRAD}`}>
          <p className="text-[13px] font-bold tracking-[0.18em]">CONDIÇÃO DE</p>
          <p className="text-[44px] leading-[0.9] font-bold tracking-[-0.05em]">Black</p>
          <p className="text-[44px] leading-[0.9] font-bold tracking-[-0.05em]">Friday</p>
          <p className="mt-1 text-[12px] font-bold">{BF_LABEL}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-[-10%] bottom-[-6px] z-[1] rotate-[-2.5deg] overflow-hidden bg-[#6FBF8E] py-2 whitespace-nowrap text-[#0A0D0B] print:hidden">
        {words.map((w, i) => (
          <span key={i} className="px-5 text-[12px] font-bold tracking-[0.16em]">
            {w} •
          </span>
        ))}
      </div>
    </>
  );
}

/** Faixa da condição de Black no bloco de investimento. */
export function BfInvestBanner() {
  const bf = useBf();
  if (!bf) return null;
  const l = bf.left;
  return (
    <div className="relative mt-6 overflow-hidden rounded-[22px] bg-[#050706]/70 ring-1 ring-[#6FBF8E]/40">
      <div className={`h-1.5 w-full ${GRAD}`} />
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">
            <span className={`rounded-[6px] px-1.5 py-0.5 text-[10px] font-black text-[#0A0D0B] ${GRAD}`}>BLACK FRIDAY</span>
            Condição especial
          </p>
          <p className="mt-1.5 text-[17px] font-bold text-white sm:text-[19px]">Instalação em até 30 dias · 72x sem entrada · 1ª parcela em 120 dias</p>
          <p className="mt-0.5 text-[12px] text-white/50">Válida para fechamento de {BF_LABEL}. Sujeito a análise de crédito.</p>
        </div>
        {l && (
          <div className="text-right">
            <p className="text-[11px] font-bold tracking-[0.14em] text-white/50 uppercase">{bf.phase === "antes" ? "Começa em" : "Termina em"}</p>
            <div className="mt-1 flex gap-1 tabular-nums">
              {[
                [l.d, "d"],
                [l.h, "h"],
                [l.m, "m"],
                [l.s, "s"],
              ].map(([v, u]) => (
                <span key={u as string} className="grid h-10 min-w-[42px] place-items-center rounded-[10px] bg-[#fff] px-1 text-[17px] font-bold text-[#0A0D0B]">
                  {String(v).padStart(2, "0")}
                  <span className="text-[10px] text-[#0A0D0B]/50">{u}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
