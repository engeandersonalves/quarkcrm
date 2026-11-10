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
          <p className="mt-0.5 text-[12px] text-white/50">Válida para fechamento {BF_LABEL}. Sujeito a análise de crédito.</p>
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

function Clock({ l, light }: { l: NonNullable<ReturnType<typeof timeLeft>>; light?: boolean }) {
  const parts: [number, string][] = [
    [l.d, "dias"],
    [l.h, "horas"],
    [l.m, "min"],
    [l.s, "seg"],
  ];
  return (
    <div className="flex items-start gap-1.5 sm:gap-2" role="timer" aria-label="Tempo restante da condição">
      {parts.map(([v, u], i) => (
        <div key={u} className="flex items-start gap-1.5 sm:gap-2">
          <div className="flex flex-col items-center">
            <span className={`grid h-14 w-12 place-items-center rounded-[12px] text-[26px] font-bold tabular-nums sm:h-[72px] sm:w-[64px] sm:text-[36px] ${light ? "bg-[#0A0D0B] text-white" : "bg-[#fff] text-[#0A0D0B] shadow-[0_10px_30px_-10px_rgba(255,255,255,0.4)]"}`}>{String(v).padStart(2, "0")}</span>
            <span className={`mt-1 text-[10px] font-semibold tracking-[0.14em] uppercase ${light ? "text-[#0A0D0B]/60" : "text-white/50"}`}>{u}</span>
          </div>
          {i < 3 && <span className={`mt-3 text-[22px] font-bold sm:mt-5 ${light ? "text-[#0A0D0B]/40" : "text-white/35"}`}>:</span>}
        </div>
      ))}
    </div>
  );
}

const PERKS = [
  { big: "72x", text: "sem entrada no financiamento" },
  { big: "120 dias", text: "para pagar a 1ª parcela" },
  { big: "21x", text: "no cartão, até em mais de um" },
  { big: "30 dias", text: "para estar instalado" },
];

/** Logo abaixo da capa: a condição de Black, em "cupons", com a contagem até acabar. */
export function BfPerks({ name }: { name?: string }) {
  const bf = useBf();
  if (!bf) return null;
  return (
    <section className="relative overflow-hidden bg-[#050706] px-6 py-10 sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.22)_0%,rgba(111,191,142,0)_62%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[1.1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-3 text-[12px] font-bold tracking-[0.18em] text-[#8FD9A8] uppercase">
            <span className={`h-1 w-8 rounded-full ${GRAD}`} />
            Black Friday antecipada
          </p>
          <p className="mt-3 text-[34px] leading-[0.95] font-bold tracking-[-0.045em] text-white sm:text-[52px]">
            {name ? `${name}, sua` : "Sua"} condição de Black <span className={`${GRAD} bg-clip-text text-transparent`}>já está garantida.</span>
          </p>
          <p className="mt-3 max-w-xl text-[15px] text-white/60 sm:text-[17px]">Feche {BF_LABEL} e leve tudo o que está nesta proposta com as condições da Black Friday. Depois, volta ao normal.</p>
        </div>
        {bf.left && (
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-white/50 uppercase">A condição termina em</p>
            <Clock l={bf.left} />
          </div>
        )}
      </div>
      <div className="scrollbar-none relative -mx-6 mt-7 flex snap-x gap-3 overflow-x-auto px-6 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
        {PERKS.map((c, i) => (
          <div key={c.big} className={`relative flex h-[96px] w-[220px] shrink-0 snap-start overflow-hidden rounded-[20px] sm:w-auto ${i === 0 ? `${GRAD} text-[#0A0D0B]` : "bg-[#111513] text-white ring-1 ring-white/[0.08]"}`}>
            <div className="flex flex-1 flex-col justify-center px-5">
              <span className="text-[28px] leading-none font-bold tracking-[-0.04em]">{c.big}</span>
              <span className={`mt-1.5 text-[12px] leading-tight font-semibold ${i === 0 ? "text-[#0A0D0B]/75" : "text-white/60"}`}>{c.text}</span>
            </div>
            <span className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#050706]" />
            <span className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#050706]" />
          </div>
        ))}
      </div>
      <p className="relative mt-2 text-[11px] text-white/35">Financiamento e cartão sujeitos a análise de crédito. Prazo de instalação contado da assinatura do contrato.</p>
    </section>
  );
}

/** Barra fixa de fechamento com contagem; fora da campanha mostra a barra normal. */
export function BfStickyBar({ onAccept, waHref, onWa, children }: { onAccept: () => void; waHref?: string | null; onWa?: () => void; children?: React.ReactNode }) {
  const bf = useBf();
  if (!bf) return <>{children}</>;
  const l = bf.left;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-[#111513]/92 p-2 pl-5 font-[family-name:var(--font-outfit)] text-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/10 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold sm:text-[14px]">Condição de Black Friday</p>
          {l && (
            <p className="truncate text-[12px] text-white/55">
              termina em{" "}
              <span className="font-semibold text-white tabular-nums">
                {l.d > 0 ? `${l.d}d ` : ""}
                {String(l.h).padStart(2, "0")}:{String(l.m).padStart(2, "0")}:{String(l.s).padStart(2, "0")}
              </span>
            </p>
          )}
        </div>
        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer" onClick={onWa} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[#6FBF8E] ring-1 ring-white/10" aria-label="Falar no WhatsApp">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z" />
            </svg>
          </a>
        )}
        <button onClick={onAccept} className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-5 text-[15px] font-bold text-[#0A0D0B] transition active:scale-[0.97] sm:px-6 ${GRAD}`}>
          Garantir condição
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Faixa diagonal da campanha entre seções. */
export function BfTape() {
  const bf = useBf();
  if (!bf) return null;
  const words = Array.from({ length: 12 }, (_, i) => (i % 2 ? "PREÇO DE BLACK" : "BLACK FRIDAY QUARK"));
  return (
    <div className="no-print relative z-[1] -my-3 overflow-hidden py-3" aria-hidden>
      <div className="-mx-[5%] rotate-[-1.8deg] bg-[#6FBF8E] py-2 whitespace-nowrap text-[#0A0D0B]">
        {words.map((w, i) => (
          <span key={i} className="px-5 text-[12px] font-bold tracking-[0.16em]">
            {w} •
          </span>
        ))}
      </div>
    </div>
  );
}
