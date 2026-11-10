"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BF_FAQ,
  BF_INSTAGRAM,
  BF_LABEL,
  BF_START,
  BF_WHATSAPP,
  CONDITIONS,
  MOTOS,
  SOLAR_INCLUDED,
  SOLAR_KITS,
  SOLAR_SPECS,
  WALLBOXES,
  WALLBOX_INCLUDED,
  bfMessage,
  bfPhase,
  bfSegment,
  brl,
  num,
  timeLeft,
  type BfCategory,
  type BfPhase,
  type SolarKit,
} from "@/lib/black-friday";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GRAD_TEXT = `${GRAD} bg-clip-text text-transparent`;

type Pick = { id: string; label: string; cat: BfCategory };

/* =============================================================== ícones */

const I = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  plug: <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5" />,
  moto: (
    <>
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M15 6h3l2.5 7M5.5 17 9 10h6l3.5 7M9 10 7 6H4" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </>
  ),
  home: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  fire: <path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-1 2-2 3-4 3 1-2 0-4-1-6-1 4-5 7-5 13a7 7 0 0 0 7 7z" />,
};
function Ico({ d, className, stroke = 2.2 }: { d: ReactNode; className?: string; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {d}
    </svg>
  );
}

/* ========================================================= contagem */

function useClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Countdown({ target, size = "md", className }: { target: number | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const now = useClock();
  const t = target && now ? timeLeft(target, now) : null;
  const parts: [string, string][] = [
    [t ? String(t.d).padStart(2, "0") : "--", "dias"],
    [t ? String(t.h).padStart(2, "0") : "--", "horas"],
    [t ? String(t.m).padStart(2, "0") : "--", "min"],
    [t ? String(t.s).padStart(2, "0") : "--", "seg"],
  ];
  const box = size === "lg" ? "h-[68px] w-[62px] text-[34px] sm:h-[84px] sm:w-[78px] sm:text-[44px]" : size === "md" ? "h-12 w-11 text-[22px]" : "h-7 w-7 text-[13px]";
  return (
    <div className={cx("flex items-start", size === "sm" ? "gap-1" : "gap-2", className)} role="timer" aria-label="Tempo restante">
      {parts.map(([v, l], i) => (
        <div key={l} className="flex items-start gap-1">
          <div className="flex flex-col items-center">
            <span className={cx("grid place-items-center rounded-[12px] bg-white font-bold text-[#0A0D0B] tabular-nums shadow-[0_10px_30px_-10px_rgba(255,255,255,0.4)]", size === "sm" && "rounded-[6px]", box)}>{v}</span>
            {size !== "sm" && <span className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">{l}</span>}
          </div>
          {i < 3 && <span className={cx("font-bold text-white/40", size === "lg" ? "mt-3 text-[32px] sm:mt-5" : size === "md" ? "mt-2 text-[20px]" : "mt-0.5 text-[13px]")}>:</span>}
        </div>
      ))}
    </div>
  );
}

/* ============================================================ peças */

function Tape({ items, className, dark }: { items: string[]; className?: string; dark?: boolean }) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className={cx("overflow-hidden py-2.5 whitespace-nowrap", dark ? "bg-[#1A1F1C] text-white" : "bg-[#6FBF8E] text-[#0A0D0B]", className)}>
      <div className="bf-marquee inline-flex">
        {[0, 1].map((k) => (
          <span key={k} className="inline-flex" aria-hidden={k === 1}>
            {row.map((t, i) => (
              <span key={i} className="px-5 text-[13px] font-bold tracking-[0.16em] uppercase sm:text-[15px]">
                {t} <span className="pl-5 opacity-60">•</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[12px] font-bold tracking-[0.18em] text-[#8FD9A8] uppercase sm:text-[13px]">
      <span className={cx("h-1 w-8 rounded-full", GRAD)} />
      {children}
    </p>
  );
}

function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("mt-3 text-[36px] leading-[0.98] font-bold tracking-[-0.045em] sm:text-[60px]", className)}>{children}</h2>;
}

function Cta({ children, onClick, href, variant = "green", className, big }: { children: ReactNode; onClick?: () => void; href?: string; variant?: "green" | "white" | "ghost" | "grad"; className?: string; big?: boolean }) {
  const cls = cx(
    "inline-flex items-center justify-center gap-3 rounded-full font-bold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3E93B]",
    big ? "h-[60px] px-8 text-[18px]" : "h-12 px-6 text-[15px]",
    variant === "green" && "bg-[#6FBF8E] text-[#0A0D0B] hover:bg-[#82CC9E]",
    variant === "grad" && `${GRAD} text-[#0A0D0B] shadow-[0_18px_50px_-14px_rgba(159,219,124,0.7)] hover:brightness-105`,
    variant === "white" && "bg-white text-[#0A0D0B] hover:bg-white/90",
    variant === "ghost" && "bg-white/[0.07] text-white ring-1 ring-white/15 hover:bg-white/[0.12]",
    className,
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Composição do kit: placas atrás e inversor na frente (como nas artes). */
function KitArt({ inverter, className, large }: { inverter: "a" | "b"; className?: string; large?: boolean }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[22px] bg-[linear-gradient(160deg,#F4F7F4,#D9E3DC)]", className)}>
      <Image src="/bf/placa-bifacial.png" alt="" width={565} height={900} className="absolute top-[-14%] right-[4%] h-[135%] w-auto rotate-[10deg] drop-shadow-[0_8px_14px_rgba(0,0,0,0.25)]" sizes="160px" loading={large ? "eager" : "lazy"} />
      <Image src="/bf/placa-bifacial.png" alt="" width={565} height={900} className="absolute top-[-8%] right-[22%] h-[130%] w-auto rotate-[10deg] drop-shadow-[0_8px_14px_rgba(0,0,0,0.25)]" sizes="160px" loading={large ? "eager" : "lazy"} />
      <Image
        src={inverter === "a" ? "/bf/inversor-a.png" : "/bf/inversor-b.png"}
        alt="Inversor solar"
        width={inverter === "a" ? 1397 : 838}
        height={inverter === "a" ? 1600 : 900}
        className={cx("absolute bottom-[6%] left-[7%] h-[78%] w-auto drop-shadow-[0_14px_18px_rgba(0,0,0,0.35)]", large && "left-[10%]")}
        sizes="220px"
        loading={large ? "eager" : "lazy"}
      />
    </div>
  );
}

/* ============================================================ página */

export function BlackFridayLanding({ whatsapp, companyName }: { whatsapp: string | null; companyName: string }) {
  const now = useClock();
  const [{ phase, target }, setPh] = useState<{ phase: BfPhase; target: number | null }>(() => bfPhase());
  useEffect(() => {
    if (now) setPh(bfPhase(now));
  }, [now]);

  const wa = useMemo(() => {
    const d = (whatsapp ?? "").replace(/\D/g, "");
    return d ? (d.length <= 11 ? `55${d}` : d) : BF_WHATSAPP;
  }, [whatsapp]);
  const waLink = (items: string[], name?: string) => `https://wa.me/${wa}?text=${encodeURIComponent(bfMessage(items, name))}`;

  const [picks, setPicks] = useState<Pick[]>([]);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 560);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const [open, setOpen] = useState(false);
  const want = (p: Pick) => {
    setPicks((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    setOpen(true);
  };
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const star = SOLAR_KITS.find((k) => k.highlight === "Mais procurado") ?? SOLAR_KITS[1];
  const kitLabel = (k: SolarKit) => `Kit ${num(k.kwh)} kWh/mês (${num(k.kwp, 2)} kWp)`;
  const live = phase === "durante";
  const headline = phase === "antes" ? "Começa em" : phase === "durante" ? "Termina em" : "Encerrada";

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#050706] pb-28 font-[family-name:var(--font-outfit)] text-white antialiased selection:bg-[#6FBF8E]/40">
      {/* faixa topo */}
      <Tape items={["Black Friday Quark", BF_LABEL, "Instalação em até 30 dias", "72x sem entrada", "21x no cartão"]} />

      {/* cabeçalho */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050706]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Image src="/bf/logo.png" alt={companyName} width={806} height={194} priority className="h-8 w-auto sm:h-9" />
          <div className="flex items-center gap-3">
            {target && (
              <div className="hidden items-center gap-2 md:flex">
                <span className="text-[12px] font-bold tracking-[0.12em] text-white/55 uppercase">{headline}</span>
                <Countdown target={target} size="sm" />
              </div>
            )}
            <Cta href={waLink([])} variant="green" className="!h-10 !px-4 !text-[14px]">
              <Ico d={I.chat} className="h-4 w-4" /> <span className="hidden sm:inline">Falar no</span> WhatsApp
            </Cta>
          </div>
        </div>
      </header>

      {/* ======================= HERÓI ======================= */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-60 -right-60 h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.22)_0%,rgba(111,191,142,0)_62%)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(243,233,59,0.10)_0%,rgba(243,233,59,0)_62%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-6 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-6">
          <div className="bf-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[13px] font-semibold text-white/80 ring-1 ring-white/10">
              <span className="relative flex h-2 w-2">
                <span className={cx("absolute inline-flex h-full w-full rounded-full opacity-70", live ? "animate-ping bg-[#6FBF8E]" : "bg-[#F3E93B]")} />
                <span className={cx("relative inline-flex h-2 w-2 rounded-full", live ? "bg-[#6FBF8E]" : "bg-[#F3E93B]")} />
              </span>
              {phase === "antes" ? `Em breve · ${BF_LABEL}` : phase === "durante" ? `Black antecipada no ar · ${BF_LABEL}` : "Campanha encerrada"}
            </p>
            <h1 className="mt-5 text-[84px] leading-[0.84] font-bold tracking-[-0.065em] sm:text-[150px]">
              Black
              <br />
              <span className={GRAD_TEXT}>Friday</span>
            </h1>
            <p className="mt-6 max-w-lg text-[20px] leading-snug font-bold sm:text-[26px]">Energia solar, wallbox e moto elétrica com preço de Black.</p>
            <p className="mt-2 max-w-lg text-[16px] text-white/60 sm:text-[18px]">A Black Friday que instala em até 30 dias. Sem entrada, com a primeira parcela só daqui a 120 dias.</p>

            {target && (
              <div className="mt-7">
                <p className="mb-2 text-[12px] font-bold tracking-[0.16em] text-white/55 uppercase">{headline}</p>
                <Countdown target={target} size="lg" />
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Cta variant="grad" big onClick={() => go("ofertas")}>
                Ver as ofertas <Ico d={I.arrow} className="h-5 w-5" stroke={2.6} />
              </Cta>
              <Cta variant="ghost" big href={waLink(["Quero receber a tabela da Black Friday"])}>
                <Ico d={I.chat} className="h-5 w-5" /> Receber a tabela
              </Cta>
            </div>
          </div>

          {/* colagem dos produtos */}
          <div className="relative h-[420px] sm:h-[560px]" aria-hidden>
            <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(159,219,124,0.28)_0%,rgba(159,219,124,0)_65%)]" />
            <Image src="/bf/placa.png" alt="" width={797} height={1600} priority className="bf-float absolute top-[2%] right-[6%] h-[78%] w-auto rotate-[14deg] brightness-[0.9] drop-shadow-[0_40px_60px_rgba(0,0,0,0.8)]" sizes="300px" style={{ animationDelay: "-2s" }} />
            <Image src="/bf/inversor-a.png" alt="" width={1397} height={1600} priority className="bf-float absolute top-[24%] left-[18%] h-[42%] w-auto drop-shadow-[0_30px_50px_rgba(0,0,0,0.85)]" sizes="260px" />
            <Image src="/bf/moto-retro.png" alt="" width={1337} height={967} priority className="bf-float absolute bottom-[0%] left-[-6%] h-[44%] w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,0.85)]" sizes="340px" style={{ animationDelay: "-4s" }} />
            <Image src="/bf/wallbox.png" alt="" width={746} height={800} priority className="bf-float absolute right-[0%] bottom-[4%] h-[34%] w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,0.85)]" sizes="220px" style={{ animationDelay: "-1s" }} />
            <span className={cx("absolute top-[10%] left-[4%] rotate-[-8deg] rounded-[14px] px-4 py-2 text-[18px] font-bold text-[#0A0D0B] shadow-xl sm:text-[22px]", GRAD)}>Preço de Black</span>
            <span className="absolute right-[8%] bottom-[44%] rotate-[6deg] rounded-[14px] bg-white px-4 py-2 text-[15px] font-bold text-[#0A0D0B] shadow-xl sm:text-[18px]">72x sem entrada</span>
          </div>
        </div>

        <div className="relative -mt-2 rotate-[-2deg] sm:-mt-6">
          <Tape items={["Black Friday Quark", "Preço de Black", "Sol o ano inteiro"]} />
        </div>
        <div className="relative -mt-3 rotate-[1.5deg]">
          <Tape dark items={["Instalação em até 30 dias", "Projeto e homologação inclusos", "Wallbox · Moto elétrica · Energia solar"]} />
        </div>
      </section>

      {/* categorias */}
      <nav className="sticky top-16 z-30 border-y border-white/[0.06] bg-[#050706]/90 backdrop-blur-xl" aria-label="Categorias">
        <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {[
            { id: "solar", label: "Energia solar", icon: I.sun },
            { id: "wallbox", label: "Wallbox", icon: I.plug },
            { id: "motos", label: "Moto elétrica", icon: I.moto },
            { id: "condicoes", label: "Condições", icon: I.card },
            { id: "duvidas", label: "Dúvidas", icon: I.chevron },
          ].map((c) => (
            <button key={c.id} onClick={() => go(c.id)} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#111513] px-4 text-[14px] font-semibold text-white/85 ring-1 ring-white/[0.06] transition hover:bg-[#1A1F1C] hover:text-white">
              <Ico d={c.icon} className="h-4 w-4 text-[#8FD9A8]" /> {c.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* condições em "cupons" */}
        <section id="condicoes" className="scroll-mt-36 pt-10">
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
            {CONDITIONS.map((c, i) => (
              <div key={c.big} className={cx("relative flex h-[104px] w-[260px] shrink-0 snap-start overflow-hidden rounded-[20px] sm:w-auto", i === 0 ? `${GRAD} text-[#0A0D0B]` : "bg-[#111513] text-white ring-1 ring-white/[0.08]")}>
                <div className="flex flex-1 flex-col justify-center px-5">
                  <span className="text-[32px] leading-none font-bold tracking-[-0.04em]">{c.big}</span>
                  <span className={cx("mt-1.5 text-[13px] leading-tight font-semibold", i === 0 ? "text-[#0A0D0B]/75" : "text-white/60")}>{c.text}</span>
                </div>
                <span className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#050706]" />
                <span className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#050706]" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-white/40">*Financiamento e cartão sujeitos a análise de crédito.</p>
        </section>

        {/* ======================= DESTAQUE ======================= */}
        <section id="ofertas" className="scroll-mt-36 pt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Oferta relâmpago</Eyebrow>
              <H2>
                O kit que todo mundo <span className={GRAD_TEXT}>está levando.</span>
              </H2>
            </div>
            {target && (
              <div className="flex items-center gap-3 rounded-full bg-[#111513] py-2 pr-2 pl-4 ring-1 ring-white/[0.08]">
                <Ico d={I.fire} className="h-5 w-5 text-[#F3E93B]" />
                <span className="text-[13px] font-semibold text-white/70">{headline}</span>
                <Countdown target={target} size="sm" />
              </div>
            )}
          </div>

          <article className="mt-6 grid overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B] lg:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[300px] p-4 sm:min-h-[420px] sm:p-6">
              <div className="absolute inset-4 sm:inset-6">
                <KitArt inverter={star.inverter} large className="h-full w-full" />
              </div>
              <span className="absolute top-8 left-8 rounded-full bg-[#0A0D0B] px-3.5 py-1.5 text-[13px] font-bold text-[#F3E93B] sm:top-10 sm:left-10">{star.highlight}</span>
            </div>
            <div className="flex flex-col justify-center p-6 pt-2 sm:p-10">
              <p className="text-[13px] font-bold tracking-[0.16em] uppercase opacity-70">Kit solar completo</p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-[88px] leading-[0.85] font-bold tracking-[-0.06em] sm:text-[112px]">{num(star.kwh)}</span>
                <span className="text-[24px] font-bold">kWh/mês</span>
              </p>
              <p className="mt-2 text-[18px] font-semibold opacity-75">{num(star.kwp, 2)} kWp · instalado em até 30 dias</p>
              <div className="mt-6 rounded-[24px] bg-[#0A0D0B] p-5 text-white">
                <p className="text-[14px] font-semibold text-white/60">{star.installments}x de</p>
                <p className="text-[52px] leading-none font-bold tracking-[-0.04em] text-[#8FD9A8] sm:text-[64px]">{brl(star.installment)}</p>
                <p className="mt-1 text-[15px] text-white/60">ou {brl(star.cash)} à vista</p>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => want({ id: star.id, label: kitLabel(star), cat: "solar" })} className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#0A0D0B] text-[17px] font-bold text-white transition active:scale-[0.97]">
                  Quero o Kit {num(star.kwh)} <Ico d={I.arrow} className="h-5 w-5" stroke={2.6} />
                </button>
              </div>
            </div>
          </article>
        </section>

        {/* ======================= SOLAR ======================= */}
        <section id="solar" className="scroll-mt-36 pt-20">
          <Eyebrow>Energia solar · Tabela Black Friday</Eyebrow>
          <H2>
            Escolha pelo seu consumo. <span className={GRAD_TEXT}>A gente cuida do resto.</span>
          </H2>
          <p className="mt-4 max-w-2xl text-[17px] text-white/60">Veja quantos kWh você consome na sua conta de luz e escolha o kit. Todos com projeto, homologação e instalação inclusos.</p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SOLAR_KITS.map((k) => {
              const hot = !!k.highlight;
              const picked = picks.some((p) => p.id === k.id);
              return (
                <article key={k.id} className={cx("group flex flex-col rounded-[26px] p-2.5 transition hover:-translate-y-1", hot ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]" : "bg-[#111513] ring-1 ring-white/[0.06]")}>
                  <div className="relative">
                    <KitArt inverter={k.inverter} className="h-[110px] sm:h-[130px]" />
                    {k.highlight && <span className="absolute top-2 left-2 rounded-full bg-[#0A0D0B] px-2.5 py-1 text-[11px] font-bold text-[#F3E93B]">{k.highlight}</span>}
                  </div>
                  <div className="flex flex-1 flex-col px-2 pt-3 pb-1.5">
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-[34px] leading-none font-bold tracking-[-0.045em] sm:text-[40px]">{num(k.kwh)}</span>
                      <span className="text-[14px] font-bold">kWh/mês</span>
                    </p>
                    <p className={cx("text-[13px]", hot ? "text-[#0A0D0B]/65" : "text-white/50")}>{num(k.kwp, 2)} kWp</p>
                    <p className={cx("mt-3 text-[12px] font-bold", hot ? "text-[#0A0D0B]/65" : "text-white/50")}>{k.installments}x de</p>
                    <p className={cx("text-[26px] leading-none font-bold tracking-[-0.03em] sm:text-[30px]", hot ? "text-[#0A0D0B]" : "text-[#8FD9A8]")}>{brl(k.installment)}</p>
                    <p className={cx("mt-1 text-[12px]", hot ? "text-[#0A0D0B]/65" : "text-white/50")}>ou {brl(k.cash)} à vista</p>
                    <button
                      onClick={() => want({ id: k.id, label: kitLabel(k), cat: "solar" })}
                      className={cx(
                        "mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-[14px] font-bold transition active:scale-[0.97]",
                        hot ? "bg-[#0A0D0B] text-white" : picked ? "bg-[#6FBF8E]/20 text-[#8FD9A8]" : "bg-white text-[#0A0D0B] hover:bg-white/90",
                      )}
                    >
                      {picked ? <Ico d={I.check} className="h-4 w-4" stroke={3} /> : null}
                      {picked ? "Escolhido" : "Quero este"}
                    </button>
                  </div>
                </article>
              );
            })}
            <article className="col-span-2 flex flex-col justify-center gap-3 rounded-[26px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:col-span-1 lg:col-span-1">
              <p className="text-[22px] leading-tight font-bold">Consumo diferente?</p>
              <p className="text-[14px] text-white/60">Mande uma foto da sua conta de luz e montamos o kit sob medida, com preço de Black.</p>
              <Cta variant="green" href={waLink(["Kit sob medida: vou mandar a foto da minha conta de luz"])} className="!h-11 self-start !text-[14px]">
                <Ico d={I.chat} className="h-4 w-4" /> Enviar minha conta
              </Cta>
            </article>
          </div>
          <p className="mt-3 text-[12px] text-white/40">Valores e parcelas da tabela Black Friday, sujeitos a análise de crédito e à visita técnica.</p>

          {/* incluso + especificações */}
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-[32px] bg-[#111513] p-7 ring-1 ring-white/[0.06] sm:p-9">
              <p className="text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">Em todos os kits</p>
              <p className="mt-3 max-w-sm text-[32px] leading-[1] font-bold tracking-[-0.04em] sm:text-[40px]">Você não compra placa. Compra o sistema pronto.</p>
              <ul className="mt-6 grid gap-3.5">
                {SOLAR_INCLUDED.map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[16px] font-semibold sm:text-[17px]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#6FBF8E] text-[#0A0D0B]">
                      <Ico d={I.check} className="h-4 w-4" stroke={3.2} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <Image src="/bf/inversor-b.png" alt="" width={838} height={900} className="pointer-events-none absolute -right-8 -bottom-6 hidden h-48 w-auto opacity-90 drop-shadow-[0_30px_40px_rgba(0,0,0,0.8)] sm:block" sizes="200px" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SOLAR_SPECS.map((s, i) => (
                <div key={s.label} className="flex flex-col justify-between rounded-[26px] bg-[#111513] p-5 ring-1 ring-white/[0.06]">
                  <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#6FBF8E]/15 text-[#8FD9A8]">
                    <Ico d={[I.bolt, I.sun, I.shield, I.shield][i]} className="h-5 w-5" />
                  </span>
                  <div className="mt-6">
                    <p className="text-[26px] leading-none font-bold tracking-[-0.03em] sm:text-[30px]">{s.value}</p>
                    <p className="mt-1 text-[14px] text-white/55">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 30 dias */}
          <Calendar30 onCta={() => want({ id: "data-instalacao", label: "Garantir minha data de instalação", cat: "solar" })} />
        </section>

        {/* ======================= WALLBOX ======================= */}
        <section id="wallbox" className="scroll-mt-36 pt-20">
          <div className="relative overflow-hidden rounded-[36px] bg-[#111513] ring-1 ring-white/[0.06]">
            <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.25)_0%,rgba(111,191,142,0)_62%)]" />
            <div className="relative grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <Eyebrow>Wallbox · Carro elétrico</Eyebrow>
                <H2>
                  Seu carro carregado <span className={GRAD_TEXT}>enquanto você dorme.</span>
                </H2>
                <p className="mt-4 max-w-md text-[17px] text-white/60">Venda e instalação num lugar só: do equipamento ao último teste, com responsável técnico. Você só pluga o carro.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {WALLBOXES.map((w) => {
                    const picked = picks.some((p) => p.id === w.id);
                    return (
                      <div key={w.id} className="rounded-[24px] bg-[#050706]/70 p-5 ring-1 ring-white/[0.08]">
                        <p className="text-[44px] leading-none font-bold tracking-[-0.05em]">{w.power}</p>
                        <p className="mt-1 text-[14px] text-white/55">{w.grid}</p>
                        <div className="mt-4">
                          <div className="flex justify-between text-[12px] text-white/55">
                            <span>Carga de 50 kWh*</span>
                            <span className="font-bold text-white">~{num(w.hours, w.hours < 3 ? 1 : 0)} h</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className={cx("h-full rounded-full", GRAD)} style={{ width: `${Math.max(12, 100 - (w.hours / 8) * 100 + 12)}%` }} />
                          </div>
                        </div>
                        <button
                          onClick={() => want({ id: w.id, label: `${w.name} instalado (${w.grid.toLowerCase()})`, cat: "wallbox" })}
                          className={cx("mt-5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-bold transition active:scale-[0.97]", picked ? "bg-[#6FBF8E]/20 text-[#8FD9A8]" : "bg-[#6FBF8E] text-[#0A0D0B]")}
                        >
                          {picked && <Ico d={I.check} className="h-4 w-4" stroke={3} />}
                          {picked ? "Escolhido" : "Quero preço de Black"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[12px] text-white/40">*Tempo estimado; a velocidade real depende do carregador interno do carro.</p>
              </div>
              <div className="relative">
                <Image src="/bf/wallbox.png" alt="Wallbox para carro elétrico" width={746} height={800} className="mx-auto h-auto w-[78%] drop-shadow-[0_40px_60px_rgba(0,0,0,0.85)] lg:w-full" sizes="(min-width:1024px) 460px, 80vw" />
                <ul className="mt-4 grid gap-2.5">
                  {WALLBOX_INCLUDED.map((t) => (
                    <li key={t} className="flex items-center gap-3 text-[15px] font-semibold">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#6FBF8E] text-[#0A0D0B]">
                        <Ico d={I.check} className="h-3.5 w-3.5" stroke={3.2} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ======================= MOTOS ======================= */}
        <section id="motos" className="scroll-mt-36 pt-20">
          <Eyebrow>Moto elétrica · Novidade</Eyebrow>
          <H2>
            Sua próxima moto <span className={GRAD_TEXT}>não vai ao posto.</span>
          </H2>
          <p className="mt-4 max-w-2xl text-[17px] text-white/60">Carrega na tomada de casa, não usa gasolina nem óleo, e é silenciosa. Escolha a sua.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {MOTOS.map((m, i) => {
              const picked = picks.some((p) => p.id === m.id);
              return (
                <article key={m.id} className="group relative overflow-hidden rounded-[32px] bg-[#111513] ring-1 ring-white/[0.06]">
                  <div className="relative h-[240px] overflow-hidden sm:h-[300px]">
                    <div className={cx("absolute inset-0", i === 0 ? "bg-[radial-gradient(circle_at_50%_70%,rgba(243,233,59,0.22),transparent_60%)]" : "bg-[radial-gradient(circle_at_50%_70%,rgba(111,191,142,0.28),transparent_60%)]")} />
                    <Image src={m.image} alt={`Moto elétrica ${m.name}`} width={i === 0 ? 1337 : 900} height={i === 0 ? 967 : 809} className="absolute inset-x-0 bottom-2 mx-auto h-[88%] w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,0.8)] transition duration-700 group-hover:scale-[1.04]" sizes="(min-width:768px) 520px, 90vw" />
                    <span className={cx("absolute top-5 left-5 rounded-full px-3 py-1.5 text-[12px] font-bold text-[#0A0D0B]", GRAD)}>Preço de Black</span>
                  </div>
                  <div className="p-6 pt-2">
                    <p className="text-[38px] leading-none font-bold tracking-[-0.045em]">{m.name}</p>
                    <p className="mt-1.5 text-[15px] text-white/60">{m.highlight}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-2">
                      {[
                        ["Autonomia", m.range],
                        ["Velocidade", m.speed],
                        ["Motor", m.power],
                        ["Bateria", m.battery],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-[18px] bg-[#050706]/70 px-4 py-3 ring-1 ring-white/[0.06]">
                          <dt className="text-[12px] text-white/50">{l}</dt>
                          <dd className="text-[18px] font-bold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 flex items-center gap-2 text-[13px] text-white/55">
                      <Ico d={I.clock} className="h-4 w-4 text-[#8FD9A8]" /> {m.charge}
                    </p>
                    <button
                      onClick={() => want({ id: m.id, label: `Moto elétrica ${m.name}`, cat: "moto" })}
                      className={cx("mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold transition active:scale-[0.97]", picked ? "bg-[#6FBF8E]/20 text-[#8FD9A8]" : "bg-white text-[#0A0D0B]")}
                    >
                      {picked ? <Ico d={I.check} className="h-4 w-4" stroke={3} /> : null}
                      {picked ? "Escolhida" : `Quero a ${m.name}`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-white/40">Ficha técnica conforme o fabricante. Regras de habilitação conforme o Contran.</p>
        </section>

        {/* combo */}
        <section className="pt-20">
          <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] p-7 text-[#0A0D0B] sm:p-12">
            <div className="relative z-10 max-w-xl">
              <p className="text-[13px] font-bold tracking-[0.16em] uppercase opacity-70">O combo do futuro</p>
              <p className="mt-3 text-[40px] leading-[0.95] font-bold tracking-[-0.05em] sm:text-[64px]">Abasteça no seu telhado.</p>
              <p className="mt-4 text-[17px] font-medium opacity-80">O sol gera a energia, o wallbox carrega o carro e a moto roda o dia todo. Juntos, com uma condição só de Black Friday.</p>
              <button
                onClick={() => {
                  setPicks((l) => [...l.filter((x) => x.id !== "combo"), { id: "combo", label: "Combo: energia solar + wallbox + moto elétrica", cat: "solar" }]);
                  setOpen(true);
                }}
                className="mt-7 inline-flex h-14 items-center gap-2 rounded-full bg-[#0A0D0B] px-7 text-[17px] font-bold text-white transition active:scale-[0.97]"
              >
                Quero o combo <Ico d={I.arrow} className="h-5 w-5" stroke={2.6} />
              </button>
            </div>
            <div className="pointer-events-none relative mt-8 h-[220px] sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:h-auto sm:w-[52%]" aria-hidden>
              <Image src="/bf/placa.png" alt="" width={797} height={1600} className="absolute top-[-6%] right-[10%] h-[95%] w-auto rotate-[12deg] drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" sizes="260px" />
              <Image src="/bf/wallbox.png" alt="" width={746} height={800} className="absolute right-[2%] bottom-[6%] h-[42%] w-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)]" sizes="180px" />
              <Image src="/bf/moto-urbana.png" alt="" width={900} height={809} className="absolute bottom-[0%] left-[2%] h-[62%] w-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)]" sizes="300px" />
            </div>
          </div>
        </section>

        {/* dúvidas */}
        <section id="duvidas" className="scroll-mt-36 pt-20">
          <Eyebrow>Dúvidas</Eyebrow>
          <H2>Perguntas rápidas.</H2>
          <div className="mt-8 overflow-hidden rounded-[28px] bg-[#111513] ring-1 ring-white/[0.06]">
            {BF_FAQ.map((f, i) => (
              <details key={f.q} className="group border-white/[0.07] [&:not(:last-child)]:border-b">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] transition group-open:rotate-45">
                    <Ico d={I.plus} className="h-4 w-4" />
                  </span>
                </summary>
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-white/65">{f.a}</p>
                <span className="sr-only">{i}</span>
              </details>
            ))}
          </div>
        </section>

        {/* chamada final */}
        <section className="pt-20">
          <div className="relative overflow-hidden rounded-[36px] bg-[#111513] px-6 py-14 text-center ring-1 ring-white/[0.06] sm:py-20">
            <div className="pointer-events-none absolute -bottom-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.28)_0%,rgba(111,191,142,0)_62%)]" />
            <p className="relative text-[48px] leading-[0.9] font-bold tracking-[-0.055em] sm:text-[96px]">
              Preço de Black.
              <br />
              <span className={GRAD_TEXT}>Sol o ano inteiro.</span>
            </p>
            <p className="relative mt-5 text-[17px] text-white/60">O desconto acaba dia 27. A economia, não.</p>
            {target && <Countdown target={target} size="md" className="relative mt-7 justify-center" />}
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Cta variant="grad" big onClick={() => setOpen(true)}>
                Garantir minha oferta <Ico d={I.arrow} className="h-5 w-5" stroke={2.6} />
              </Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-14 flex max-w-6xl flex-col items-center gap-3 px-4 text-center text-[13px] text-white/45 sm:px-6">
        <Image src="/bf/logo.png" alt={companyName} width={806} height={194} className="h-8 w-auto opacity-80" />
        <p>
          {companyName} · {BF_INSTAGRAM} · Black Friday {BF_LABEL}
        </p>
        <p className="max-w-2xl text-[12px] text-white/35">Ofertas válidas no período da campanha ou enquanto durarem os equipamentos da tabela. Financiamento e parcelamento sujeitos a análise de crédito. Prazo de instalação contado da assinatura do contrato; vistoria e ligação seguem os prazos da distribuidora. Imagens ilustrativas.</p>
      </footer>

      {/* barra fixa */}
      <div className={cx("fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition duration-500", scrolled || picks.length ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")}>
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-full bg-[#111513]/90 p-2 pl-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/10 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold">{picks.length ? `${picks.length} ${picks.length === 1 ? "oferta escolhida" : "ofertas escolhidas"}` : phase === "antes" ? "Garanta prioridade na Black" : "Black Friday Quark"}</p>
            {target ? (
              <p className="truncate text-[12px] text-white/55">
                {headline.toLowerCase()} <ShortLeft target={target} />
              </p>
            ) : (
              <p className="truncate text-[12px] text-white/55">Fale com a gente</p>
            )}
          </div>
          <button onClick={() => setOpen(true)} className={cx("inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-6 text-[15px] font-bold text-[#0A0D0B] transition active:scale-[0.97]", GRAD)}>
            Garantir <Ico d={I.arrow} className="h-4 w-4" stroke={2.8} />
          </button>
        </div>
      </div>

      <LeadSheet open={open} onClose={() => setOpen(false)} picks={picks} setPicks={setPicks} waLink={waLink} phase={phase} />
    </div>
  );
}

function ShortLeft({ target }: { target: number }) {
  const now = useClock();
  if (!now) return null;
  const t = timeLeft(target, now);
  return (
    <span className="font-semibold text-white tabular-nums">
      {t.d > 0 ? `${t.d}d ` : ""}
      {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:{String(t.s).padStart(2, "0")}
    </span>
  );
}

/* ====================================================== calendário */

const BF_FIRST_DAY = Number(BF_START.slice(8, 10));

function Calendar30({ onCta }: { onCta: () => void }) {
  // Novembro de 2026 começa num domingo
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div className="mt-10 grid gap-6 rounded-[32px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:p-9 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <div>
        <p className="text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">Nosso diferencial</p>
        <p className="mt-3 text-[34px] leading-[1] font-bold tracking-[-0.045em] sm:text-[48px]">
          Comprou na Black, <span className={GRAD_TEXT}>instalado em até 30 dias.</span>
        </p>
        <p className="mt-4 text-[16px] text-white/60">Sem fila e sem promessa vaga. A data entra no contrato.</p>
        <button onClick={onCta} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#6FBF8E] px-6 text-[15px] font-bold text-[#0A0D0B] transition active:scale-[0.97]">
          Garantir minha data <Ico d={I.arrow} className="h-4 w-4" stroke={2.6} />
        </button>
        <p className="mt-3 text-[12px] text-white/40">Prazo contado da assinatura do contrato. Vistoria e ligação seguem os prazos da distribuidora.</p>
      </div>
      <div>
        <p className="mb-3 text-[15px] font-bold">Novembro 2026</p>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <span key={i} className="pb-1 text-[11px] font-bold text-white/40">
              {d}
            </span>
          ))}
          {days.map((d) => {
            const bf = d >= BF_FIRST_DAY && d <= 27;
            const after = d > 27;
            return (
              <span key={d} className={cx("grid h-10 place-items-center rounded-[12px] text-[15px] font-bold sm:h-12", bf ? "bg-[#6FBF8E] text-[#0A0D0B]" : after ? "bg-white/10 text-white" : "text-white/25")}>
                {d}
              </span>
            );
          })}
        </div>
        <div className="mt-4 flex gap-5 text-[13px] font-semibold">
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] bg-[#6FBF8E]" /> Black Friday
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[4px] bg-white/20" /> Já instalando
          </span>
        </div>
      </div>
    </div>
  );
}

/* ======================================================== formulário */

const QUICK: Pick[] = [
  { id: "q-solar", label: "Energia solar", cat: "solar" },
  { id: "q-wallbox", label: "Wallbox", cat: "wallbox" },
  { id: "q-moto", label: "Moto elétrica", cat: "moto" },
];

function LeadSheet({ open, onClose, picks, setPicks, waLink, phase }: { open: boolean; onClose: () => void; picks: Pick[]; setPicks: (f: (p: Pick[]) => Pick[]) => void; waLink: (items: string[], name?: string) => string; phase: BfPhase }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const opened = useRef(Date.now());
  const owner = useRef("");
  useEffect(() => {
    if (!open) return;
    opened.current = Date.now();
    try {
      owner.current = new URLSearchParams(window.location.search).get("v") ?? "";
    } catch {
      /* sem parâmetros */
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;

  const items = picks.map((p) => p.label);
  const valid = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 10;
  const toggleQuick = (q: Pick) => setPicks((l) => (l.some((x) => x.id === q.id) ? l.filter((x) => x.id !== q.id) : [...l, q]));

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setErr("");
    // Abre o WhatsApp já (navegadores bloqueiam janelas abertas depois de um await)
    const win = window.open(waLink(items, form.name), "_blank");
    try {
      await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          notes: `Black Friday (${phase === "antes" ? "antes de começar" : "durante a campanha"}):\n${items.length ? items.map((i) => `• ${i}`).join("\n") : "• Quer conhecer as ofertas"}`,
          segment: bfSegment(picks.map((p) => p.cat)),
          source: "Black Friday",
          temperature: "quente",
          owner: owner.current,
          website: form.website,
          elapsed: Date.now() - opened.current,
        }),
      });
      setDone(true);
      if (!win) window.location.href = waLink(items, form.name);
    } catch {
      setErr("Não conseguimos registrar agora, mas o WhatsApp foi aberto para você falar com a gente.");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-14 w-full rounded-[16px] bg-white/[0.07] px-4 text-[17px] text-white ring-1 ring-white/10 placeholder:text-white/35 outline-none focus:ring-2 focus:ring-[#6FBF8E]";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="bf-sheet-title">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
      <div className="bf-sheet relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[32px] bg-[#111513] ring-1 ring-white/10 sm:max-w-lg sm:rounded-[32px]">
        <div className={cx("h-1.5 w-full", GRAD)} />
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
            <p className="text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">Black Friday Quark</p>
            <h2 id="bf-sheet-title" className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.04em]">
              {done ? "Oferta garantida!" : phase === "antes" ? "Garanta prioridade" : "Garanta sua oferta"}
            </h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08]" aria-label="Fechar">
            <Ico d={I.x} className="h-4 w-4" stroke={2.6} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pt-4 pb-6">
          {done ? (
            <div className="py-4 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#6FBF8E]/15">
                <Ico d={I.check} className="h-10 w-10 text-[#6FBF8E]" stroke={3} />
              </div>
              <p className="mt-4 text-[16px] text-white/70">Recebemos seu pedido. Continue a conversa no WhatsApp para fechar com o preço de Black.</p>
              <a href={waLink(items, form.name)} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#6FBF8E] text-[17px] font-bold text-[#0A0D0B]">
                <Ico d={I.chat} className="h-5 w-5" /> Abrir o WhatsApp
              </a>
            </div>
          ) : (
            <>
              {picks.length > 0 && (
                <ul className="mb-4 grid gap-2">
                  {picks.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-[16px] bg-[#050706]/70 py-2.5 pr-2 pl-4 ring-1 ring-white/[0.06]">
                      <Ico d={p.cat === "solar" ? I.sun : p.cat === "wallbox" ? I.plug : I.moto} className="h-5 w-5 shrink-0 text-[#8FD9A8]" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.label}</span>
                      <button onClick={() => setPicks((l) => l.filter((x) => x.id !== p.id))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10" aria-label={`Tirar ${p.label}`}>
                        <Ico d={I.x} className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-2 text-[13px] font-semibold text-white/55">{picks.length ? "Quer incluir mais alguma coisa?" : "Tenho interesse em:"}</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {QUICK.map((q) => {
                  const on = picks.some((x) => x.id === q.id);
                  return (
                    <button key={q.id} onClick={() => toggleQuick(q)} className={cx("inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold ring-1 transition", on ? "bg-[#6FBF8E] text-[#0A0D0B] ring-[#6FBF8E]" : "bg-white/[0.05] text-white ring-white/15")} aria-pressed={on}>
                      <Ico d={q.cat === "solar" ? I.sun : q.cat === "wallbox" ? I.plug : I.moto} className="h-4 w-4" />
                      {q.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-2.5">
                <label className="sr-only" htmlFor="bf-name">
                  Seu nome
                </label>
                <input id="bf-name" className={input} placeholder="Seu nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                <label className="sr-only" htmlFor="bf-phone">
                  WhatsApp com DDD
                </label>
                <input id="bf-phone" className={input} placeholder="WhatsApp com DDD" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
                <label className="sr-only" htmlFor="bf-city">
                  Cidade
                </label>
                <input id="bf-city" className={input} placeholder="Cidade (opcional)" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
                <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
              </div>
              {err && <p className="mt-3 text-[13px] text-[#F3E93B]">{err}</p>}
              <button onClick={submit} disabled={!valid || busy} className={cx("mt-5 inline-flex h-[60px] w-full items-center justify-center gap-2 rounded-full text-[18px] font-bold text-[#0A0D0B] transition active:scale-[0.98] disabled:opacity-40", GRAD)}>
                <Ico d={I.chat} className="h-5 w-5" />
                {busy ? "Enviando…" : "Garantir pelo WhatsApp"}
              </button>
              <p className="mt-3 text-center text-[12px] text-white/40">Sem compromisso. Um consultor responde com o preço de Black.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
