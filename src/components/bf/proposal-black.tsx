"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GlyphTile, type GlyphId } from "@/components/app/ios-glyphs";
import { AcceptModal, type PublicProposal } from "@/components/proposal/document";
import { useProposalTracking } from "@/components/proposal/tracking";
import { BF_END_SHORT, BF_LABEL } from "@/lib/black-friday";
import { mergeInputs, mergeSettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import { brl, calcEnergy, calcFinancing, fmtNum, pct, pmt } from "@/lib/pricing";
import { DEFAULT_FAQ, DEFAULT_TIMELINE } from "@/lib/proposal-content";
import { inverterImageOf, moduleImageOf, productImg } from "@/lib/product-images";
import { BfStickyBar, useBf } from "./badges";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GT = `${GRAD} bg-clip-text text-transparent`;

/* ---------------------------------------------------------------- peças */

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function Chat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function Tick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Tape({ items, dark, tilt = 0 }: { items: string[]; dark?: boolean; tilt?: number }) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="overflow-hidden" style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }} aria-hidden>
      <div className={cx("-mx-[4%] py-2.5 whitespace-nowrap", dark ? "bg-[#1A1F1C] text-white" : "bg-[#6FBF8E] text-[#0A0D0B]")}>
        <div className="bf-marquee inline-flex">
          {[0, 1].map((k) => (
            <span key={k} className="inline-flex">
              {row.map((t, i) => (
                <span key={i} className="px-5 text-[12px] font-bold tracking-[0.16em] uppercase sm:text-[14px]">
                  {t} <span className="pl-5 opacity-60">•</span>
                </span>
              ))}
            </span>
          ))}
        </div>
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

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 text-[34px] leading-[0.98] font-bold tracking-[-0.045em] sm:text-[54px]">{children}</h2>;
}

function Countdown({ size = "lg" }: { size?: "lg" | "sm" }) {
  const bf = useBf();
  const l = bf?.left;
  const parts: [string, string][] = [
    [l ? String(l.d).padStart(2, "0") : "--", "dias"],
    [l ? String(l.h).padStart(2, "0") : "--", "horas"],
    [l ? String(l.m).padStart(2, "0") : "--", "min"],
    [l ? String(l.s).padStart(2, "0") : "--", "seg"],
  ];
  const box = size === "lg" ? "h-[64px] w-[58px] text-[30px] sm:h-[78px] sm:w-[70px] sm:text-[40px]" : "h-11 w-10 text-[20px]";
  return (
    <div className="flex items-start gap-1.5 sm:gap-2" role="timer" aria-label="Tempo restante da condição de Black Friday">
      {parts.map(([v, u], i) => (
        <div key={u} className="flex items-start gap-1.5 sm:gap-2">
          <div className="flex flex-col items-center">
            <span className={cx("grid place-items-center rounded-[12px] bg-[#fff] font-bold text-[#0A0D0B] tabular-nums shadow-[0_10px_30px_-10px_rgba(255,255,255,0.45)]", box)}>{v}</span>
            <span className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">{u}</span>
          </div>
          {i < 3 && <span className={cx("font-bold text-white/35", size === "lg" ? "mt-3 text-[26px] sm:mt-5" : "mt-2 text-[18px]")}>:</span>}
        </div>
      ))}
    </div>
  );
}

function Cta({ children, onClick, href, variant = "grad", big, className, onHref }: { children: ReactNode; onClick?: () => void; href?: string; variant?: "grad" | "ghost" | "dark"; big?: boolean; className?: string; onHref?: () => void }) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2.5 rounded-full font-bold whitespace-nowrap transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3E93B]",
    big ? "h-[60px] px-8 text-[17px]" : "h-12 px-6 text-[15px]",
    variant === "grad" && `${GRAD} text-[#0A0D0B] shadow-[0_18px_50px_-14px_rgba(159,219,124,0.7)] hover:brightness-105`,
    variant === "ghost" && "bg-white/[0.07] text-white ring-1 ring-white/15 hover:bg-white/[0.12]",
    variant === "dark" && "bg-[#0A0D0B] text-white hover:bg-black",
    className,
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={onHref}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Foto do equipamento; se não carregar, usa a foto real da campanha. */
function SafeImg({ src, fallback, alt, className }: { src: string; fallback: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return setUrl(fallback);
    const im = new Image();
    im.onload = () => setUrl(src);
    im.onerror = () => setUrl(fallback);
    im.src = src;
  }, [src, fallback]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}

/** Lista agrupada estilo Ajustes do iPhone, com ícones premium. */
function GroupList({ items }: { items: { glyph: GlyphId; title: string; text: string; tag?: string }[] }) {
  return (
    <ul className="overflow-hidden rounded-[26px] bg-[#111513] ring-1 ring-white/[0.06]">
      {items.map((it, i) => (
        <li key={it.title} className="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
          <GlyphTile id={it.glyph} size="md" className="!h-11 !w-11 !rounded-[12px]" />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold sm:text-[17px]">{it.title}</p>
            <p className="text-[13px] leading-snug text-white/55 sm:text-[14px]">{it.text}</p>
          </div>
          {it.tag ? (
            <span className="shrink-0 rounded-full bg-[#6FBF8E]/15 px-2.5 py-1 text-[12px] font-bold text-[#8FD9A8]">{it.tag}</span>
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#6FBF8E] text-[#0A0D0B]">
              <Tick className="h-3.5 w-3.5" />
            </span>
          )}
          {i < items.length - 1 && <span className="absolute right-0 bottom-0 left-[76px] h-[0.5px] bg-white/[0.12] sm:left-[80px]" />}
        </li>
      ))}
    </ul>
  );
}

/* ================================================================ página */

export function BlackProposal({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const inputs = mergeInputs(data.proposal.inputs);
  const price = Number(data.proposal.final_price);
  const startYear = new Date(data.proposal.created_at).getFullYear();
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const { click } = useProposalTracking(token);
  const [pdf, setPdf] = useState<string | null>(null);
  const downloadPdf = async () => {
    if (pdf) return;
    click("pdf");
    setPdf("Gerando…");
    try {
      const { downloadProposalPdf } = await import("./download-pdf");
      await downloadProposalPdf(data, (done, total) => setPdf(done < total ? `Página ${done + 1}/${total}` : "Baixando…"));
    } catch (e) {
      console.error("PDF", e);
      window.print();
    } finally {
      setPdf(null);
    }
  };

  const kwp = (inputs.modulePowerW * inputs.moduleQty) / 1000;
  const energy = useMemo(() => calcEnergy(inputs, price, startYear), [inputs, price, startYear]);
  const financing = useMemo(() => calcFinancing(price, inputs.financingRate, inputs.financingTerms), [price, inputs.financingRate, inputs.financingTerms]);
  const cardInstallment = inputs.cardInstallments > 0 ? pmt(price, inputs.cardRate, inputs.cardInstallments) : 0;
  const longest = financing.length ? financing[financing.length - 1] : null;

  const firstName = data.lead.name.split(" ")[0];
  const hasBill = energy.monthlyBillBefore > 0;
  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const city = [data.lead.city, data.lead.state].filter(Boolean).join(" – ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const sellerName = data.seller?.name || "nossa equipe";
  const waText = `Olá! Estou vendo a minha proposta nº ${data.proposal.number} da Black Friday e quero garantir a condição.`;
  const wa = contactPhone ? whatsappUrl(contactPhone, waText) : null;
  const canAccept = !accepted && !expired && !!token;
  const accept = () => {
    click("aceitar");
    if (canAccept) setAcceptOpen(true);
    else if (wa) window.open(wa, "_blank");
  };

  const moduleImg = productImg(moduleImageOf(inputs.moduleImage, s.proposal.moduleImage)) || "/bf/placa-bifacial.png";
  const inverterImg = productImg(inverterImageOf(inputs.inverterImage, s.proposal.inverterImage)) || "/bf/inversor-a.png";
  const totalDays = Math.max(10, Math.round(inputs.installationDays || 40));
  const steps = s.proposal.timeline.length ? [...s.proposal.timeline].sort((a, b) => a.day - b.day) : DEFAULT_TIMELINE.map((st) => ({ ...st, day: Math.round((st.day / 40) * totalDays) }));
  const lastDay = steps.length ? steps[steps.length - 1].day : totalDays;
  const faq = s.proposal.faq.length ? s.proposal.faq : DEFAULT_FAQ;
  const cum = energy.cashflow.filter((c) => c.year <= 25);
  const maxCum = Math.max(1, ...cum.map((c) => Math.abs(c.cumulative)));
  const savedMonth = Math.max(0, energy.monthlyBillBefore - energy.monthlyBillAfter);
  const swap = longest && hasBill ? energy.monthlyBillBefore - longest.installment : null;

  useEffect(() => {
    if (!token) return;
    try {
      if (sessionStorage.getItem(`viewed-${token}`)) return;
      sessionStorage.setItem(`viewed-${token}`, "1");
    } catch {
      /* navegação privada */
    }
    fetch(`/api/public/proposal/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {});
  }, [token]);

  return (
    <div className="bf-black min-h-dvh overflow-x-clip bg-[#050706] pb-28 font-[family-name:var(--font-outfit)] text-white antialiased selection:bg-[#6FBF8E]/40">
      <Tape items={["Black Friday Quark", `Condição ${BF_LABEL}`, "Instalação em até 30 dias", "72x sem entrada", "1ª parcela em 120 dias"]} />

      {/* cabeçalho */}
      <header className="no-print sticky top-0 z-40 border-b border-white/[0.06] bg-[#050706]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.logo_url || "/bf/logo.png"} alt={s.company_name} className="h-8 w-auto sm:h-9" />
          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] font-bold tracking-[0.12em] text-white/50 uppercase md:block">Proposta nº {data.proposal.number}</span>
            <button onClick={downloadPdf} disabled={!!pdf} aria-label="Baixar PDF" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-3.5 text-[14px] font-semibold ring-1 ring-white/10 disabled:opacity-70 sm:px-4">
              <svg viewBox="0 0 24 24" className={cx("h-4 w-4", pdf && "animate-bounce")} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m-5-5 5 5 5-5M5 20h14" />
              </svg>
              <span className={cx(!pdf && "hidden sm:inline")}>{pdf ?? "Baixar PDF"}</span>
            </button>
            {canAccept && (
              <button onClick={accept} className={cx("h-10 rounded-full px-5 text-[14px] font-bold text-[#0A0D0B]", GRAD)}>
                Garantir condição
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ============================ HERÓI: conexão + desejo ============================ */}
      <section data-track="capa" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-60 -right-60 h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.24)_0%,rgba(111,191,142,0)_62%)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(243,233,59,0.10)_0%,rgba(243,233,59,0)_62%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="bf-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[13px] font-semibold text-white/80 ring-1 ring-white/10">
              <span className={cx("rounded-[6px] px-1.5 py-0.5 text-[10px] font-black tracking-[0.12em] text-[#0A0D0B]", GRAD)}>BLACK FRIDAY</span>
              Projeto exclusivo para {firstName}
            </p>
            <h1 className="mt-5 text-[44px] leading-[0.92] font-bold tracking-[-0.055em] sm:text-[78px]">
              {firstName}, sua conta de luz {hasBill ? "vai de" : "vai cair"}
              {hasBill && (
                <>
                  {" "}
                  <span className="text-white/40 line-through decoration-[#FF453A] decoration-[5px]">{brl(energy.monthlyBillBefore, 0)}</span> para <span className={GT}>{brl(energy.monthlyBillAfter, 0)}</span>.
                </>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-snug text-white/65 sm:text-[20px]">
              Um sistema de <b className="text-white">{fmtNum(kwp, 2)} kWp</b> feito sob medida{city ? ` para o seu imóvel em ${city}` : ""}, gerando{" "}
              <b className="text-white">{fmtNum(energy.monthlyGeneration)} kWh por mês</b>. Com a condição da Black Friday.
            </p>

            {!accepted && (
              <div className="mt-7">
                <p className="mb-2 text-[12px] font-bold tracking-[0.16em] text-white/50 uppercase">Sua condição de Black termina em</p>
                <Countdown />
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {accepted ? (
                <span className="inline-flex h-[60px] items-center gap-2 rounded-full bg-[#6FBF8E]/15 px-7 text-[17px] font-bold text-[#8FD9A8]">
                  <Tick className="h-5 w-5" /> Proposta aceita por {accepted.by}
                </span>
              ) : (
                <Cta big onClick={accept}>
                  Garantir minha condição <Arrow />
                </Cta>
              )}
              {wa && (
                <Cta big variant="ghost" href={wa} onHref={() => click("whatsapp")}>
                  <Chat /> Falar com {sellerName.split(" ")[0]}
                </Cta>
              )}
            </div>
            {expired && <p className="mt-4 rounded-2xl bg-[#F3E93B]/10 px-4 py-3 text-[14px] text-[#F3E93B]">A validade desta proposta terminou. Fale com {sellerName} para atualizar os valores.</p>}
          </div>

          {/* colagem do sistema */}
          <div className="relative h-[380px] sm:h-[520px]" aria-hidden>
            <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(159,219,124,0.30)_0%,rgba(159,219,124,0)_65%)]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bf/placa.png" alt="" className="bf-float absolute top-[0%] right-[8%] h-[82%] w-auto rotate-[14deg] brightness-[0.9] drop-shadow-[0_40px_60px_rgba(0,0,0,0.85)]" style={{ animationDelay: "-2s" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bf/placa-bifacial.png" alt="" className="bf-float absolute top-[10%] right-[38%] h-[64%] w-auto rotate-[8deg] opacity-80 drop-shadow-[0_40px_60px_rgba(0,0,0,0.85)]" style={{ animationDelay: "-4s" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bf/inversor-a.png" alt="" className="bf-float absolute bottom-[2%] left-[6%] h-[48%] w-auto drop-shadow-[0_30px_50px_rgba(0,0,0,0.85)]" />
            {hasBill && (
              <div className="absolute top-[6%] left-[2%] rotate-[-7deg] rounded-[20px] bg-[#fff] px-5 py-3 text-[#0A0D0B] shadow-2xl">
                <p className="text-[12px] font-bold tracking-[0.12em] uppercase opacity-60">Na sua conta</p>
                <p className="text-[40px] leading-none font-bold tracking-[-0.05em]">-{pct(energy.savingsPct, 0)}</p>
              </div>
            )}
            <span className={cx("absolute right-[2%] bottom-[18%] rotate-[6deg] rounded-[14px] px-4 py-2 text-[16px] font-bold text-[#0A0D0B] shadow-xl sm:text-[19px]", GRAD)}>72x sem entrada</span>
          </div>
        </div>

        {/* indicadores com ícones premium */}
        <div className="relative mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              { g: "sol" as GlyphId, l: "Potência", v: `${fmtNum(kwp, 2)} kWp` },
              { g: "raio" as GlyphId, l: "Geração média", v: `${fmtNum(energy.monthlyGeneration)} kWh/mês` },
              { g: "cifrao" as GlyphId, l: "Economia", v: hasBill ? `${brl(savedMonth, 0)}/mês` : "—" },
              { g: "relatorios" as GlyphId, l: "Retorno", v: energy.paybackYears ? `${fmtNum(energy.paybackYears, 1)} anos` : "—" },
            ].map((k) => (
              <div key={k.l} className="flex items-center gap-3.5 rounded-[22px] bg-[#111513] p-4 ring-1 ring-white/[0.06]">
                <GlyphTile id={k.g} size="lg" className="!h-12 !w-12 !rounded-[13px]" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold tracking-[0.06em] text-white/50 uppercase">{k.l}</p>
                  <p className="truncate text-[19px] font-bold tracking-[-0.02em] sm:text-[22px]">{k.v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Tape tilt={-2} items={["Black Friday Quark", "Preço de Black", "Sol o ano inteiro"]} />
        <div className="-mt-3">
          <Tape dark tilt={1.5} items={["Projeto e homologação inclusos", "Instalação em até 30 dias", `Válida ${BF_LABEL}`]} />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* ============================ ECONOMIA ============================ */}
        {hasBill && (
          <section data-track="economia" className="pt-16">
            <Eyebrow>O que muda na sua vida</Eyebrow>
            <H2>
              Todo mês, <span className={GT}>{brl(savedMonth, 0)} a mais</span> no seu bolso.
            </H2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-[28px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:p-8">
                <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.12em] text-white/50 uppercase">
                  <GlyphTile id="alerta" size="xs" /> Hoje, sem solar
                </p>
                <p className="mt-4 text-[56px] leading-none font-bold tracking-[-0.05em] text-white/45 line-through decoration-[#FF453A] decoration-[4px] sm:text-[72px]">{brl(energy.monthlyBillBefore, 0)}</p>
                <p className="mt-2 text-[15px] text-white/50">por mês, e subindo todo ano com os reajustes</p>
              </div>
              <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] p-6 text-[#0A0D0B] sm:p-8">
                <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.12em] uppercase opacity-70">
                  <GlyphTile id="sol" size="xs" /> Com o seu sistema Quark
                </p>
                <p className="mt-4 text-[56px] leading-none font-bold tracking-[-0.05em] sm:text-[72px]">{brl(energy.monthlyBillAfter, 0)}</p>
                <p className="mt-2 text-[15px] font-semibold opacity-75">por mês: só taxas mínimas da distribuidora</p>
                <span className="absolute top-5 right-5 rounded-full bg-[#0A0D0B] px-3 py-1.5 text-[14px] font-bold text-[#F3E93B]">-{pct(energy.savingsPct, 0)}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { g: "cifrao" as GlyphId, v: brl(energy.annualSavings, 0), l: "de economia já no 1º ano" },
                { g: "relatorios" as GlyphId, v: brl(energy.savings25y, 0), l: "economizados em 25 anos" },
                { g: "folha" as GlyphId, v: `${fmtNum(energy.treesEquivalent)} árvores`, l: "é o que seu sistema equivale por ano" },
              ].map((k) => (
                <div key={k.l} className="flex items-center gap-4 rounded-[24px] bg-[#111513] p-5 ring-1 ring-white/[0.06]">
                  <GlyphTile id={k.g} size="lg" className="!h-12 !w-12 !rounded-[13px]" />
                  <div>
                    <p className="text-[26px] leading-none font-bold tracking-[-0.03em]">{k.v}</p>
                    <p className="mt-1 text-[13px] text-white/55">{k.l}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* saldo acumulado */}
            <div className="mt-3 rounded-[28px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[19px] font-bold tracking-tight">O sistema se paga em {energy.paybackYears ? `${fmtNum(energy.paybackYears, 1)} anos` : "poucos anos"}. Depois, é lucro.</p>
                  <p className="text-[14px] text-white/50">Saldo acumulado: economia menos o investimento, ano a ano</p>
                </div>
                <p className={cx("text-[28px] font-bold tracking-[-0.03em]", GT)}>+{brl(cum[cum.length - 1]?.cumulative ?? 0, 0)}</p>
              </div>
              <div className="mt-6 flex h-44 items-end gap-[3px] sm:gap-1.5">
                {cum.map((c) => {
                  const h = (Math.abs(c.cumulative) / maxCum) * 100;
                  const pos = c.cumulative >= 0;
                  return (
                    <div key={c.year} className="group relative flex h-full flex-1 flex-col justify-end">
                      <div className={cx("w-full rounded-t-[4px] transition-all", pos ? "bg-[linear-gradient(0deg,#4FC38A_0%,#9FDB7C_60%,#F3E93B_100%)]" : "bg-[#FF453A]/70")} style={{ height: `${Math.max(2, h)}%` }} title={`Ano ${c.year}: ${brl(c.cumulative, 0)}`} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-white/40">
                <span>Ano 1</span>
                <span>Ano 10</span>
                <span>Ano 25</span>
              </div>
            </div>
          </section>
        )}

        {/* ============================ O SISTEMA ============================ */}
        <section data-track="sistema" className="pt-20">
          <Eyebrow>Seu sistema</Eyebrow>
          <H2>
            Equipamentos de primeira, <span className={GT}>escolhidos para o seu telhado.</span>
          </H2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              {
                img: moduleImg,
                fallback: "/bf/placa-bifacial.png",
                g: "sol" as GlyphId,
                kicker: "Placas solares",
                title: [inputs.moduleBrand, inputs.moduleModel].filter(Boolean).join(" ") || "Módulos fotovoltaicos",
                specs: [
                  ["Quantidade", `${inputs.moduleQty} placas`],
                  ["Potência", `${fmtNum(inputs.modulePowerW)} W cada · ${fmtNum(kwp, 2)} kWp`],
                  ["Garantia", `${s.warranty_modules_years ?? 12} anos + ${s.warranty_modules_performance_years ?? 25} de performance`],
                ],
              },
              {
                img: inverterImg,
                fallback: "/bf/inversor-a.png",
                g: "raio" as GlyphId,
                kicker: "Inversor",
                title: [inputs.inverterBrand, inputs.inverterModel].filter(Boolean).join(" ") || "Inversor solar",
                specs: [
                  ["Quantidade", `${inputs.inverterQty} ${inputs.inverterQty === 1 ? "unidade" : "unidades"}`],
                  ["Potência", `${fmtNum(inputs.inverterPowerKw, 1)} kW`],
                  ["Monitoramento", "Pelo app, no seu celular"],
                ],
              },
            ].map((e) => (
              <article key={e.kicker} className="overflow-hidden rounded-[30px] bg-[#111513] ring-1 ring-white/[0.06]">
                <div className="relative flex h-[260px] items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#F4F7F4,#D9E3DC)] sm:h-[300px]">
                  <SafeImg src={e.img} fallback={e.fallback} alt={e.title} className="h-[210px] w-auto max-w-[80%] object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.35)] sm:h-[240px]" />
                  <GlyphTile id={e.g} size="lg" className="!absolute top-4 left-4 !h-12 !w-12 !rounded-[13px]" />
                </div>
                <div className="p-6">
                  <p className="text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">{e.kicker}</p>
                  <p className="mt-1 text-[24px] leading-tight font-bold tracking-[-0.03em]">{e.title}</p>
                  <dl className="mt-4 grid gap-2">
                    {e.specs.map(([l, v]) => (
                      <div key={l} className="flex justify-between gap-4 rounded-[14px] bg-[#050706]/70 px-4 py-2.5 text-[14px]">
                        <dt className="text-white/50">{l}</dt>
                        <dd className="text-right font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ============================ INCLUSO ============================ */}
        <section data-track="incluso" className="grid gap-8 pt-20 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>Tudo incluso</Eyebrow>
            <H2>
              Você não compra placa. <span className={GT}>Compra o sistema pronto.</span>
            </H2>
            <p className="mt-4 max-w-md text-[17px] text-white/60">Do projeto ao app no seu celular, cuidamos de cada etapa. Você só acompanha a conta cair.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bf/inversor-b.png" alt="" className="mt-8 hidden h-60 w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,0.8)] lg:block" />
          </div>
          <GroupList
            items={[
              { glyph: "sol", title: "Placas solares", text: `${inputs.moduleQty} módulos de ${fmtNum(inputs.modulePowerW)} W` },
              { glyph: "raio", title: "Inversor", text: "Transforma o sol na energia da sua casa" },
              { glyph: "pacote", title: "Estrutura de fixação", text: inputs.structureType || "Feita para o seu tipo de telhado" },
              { glyph: "escudo", title: "Proteções elétricas", text: "String box, DPS, disjuntores e aterramento" },
              { glyph: "documentos", title: "Projeto e ART", text: "Engenheiro responsável pelo seu sistema" },
              { glyph: "contratos", title: "Homologação", text: "Toda a papelada com a distribuidora" },
              { glyph: "chave", title: "Instalação", text: "Equipe própria, em até 30 dias", tag: "30 dias" },
              { glyph: "celular", title: "Monitoramento", text: "Acompanhe a geração pelo app" },
            ]}
          />
        </section>

        {/* ============================ GARANTIAS ============================ */}
        <section data-track="garantias" className="pt-20">
          <Eyebrow>Garantias</Eyebrow>
          <H2>
            Tranquilidade <span className={GT}>por décadas.</span>
          </H2>
          <div className="mt-8 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              { g: "sol" as GlyphId, y: s.warranty_modules_performance_years ?? 25, t: "Performance das placas", d: "Mínimo de 80% de geração" },
              { g: "escudo" as GlyphId, y: s.warranty_modules_years ?? 12, t: "Placas", d: "Contra defeitos de fabricação" },
              { g: "raio" as GlyphId, y: s.warranty_inverter_years ?? 10, t: "Inversor", d: "Reparo ou troca pelo fabricante" },
              { g: "chave" as GlyphId, y: s.warranty_installation_years ?? 1, t: "Instalação", d: "Serviço da nossa equipe" },
            ].map((w) => (
              <div key={w.t} className="rounded-[24px] bg-[#111513] p-5 ring-1 ring-white/[0.06]">
                <GlyphTile id={w.g} size="md" className="!h-10 !w-10 !rounded-[11px]" />
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className={cx("text-[50px] leading-none font-bold tracking-[-0.05em]", GT)}>{w.y}</span>
                  <span className="text-[14px] font-semibold text-white/50">{Number(w.y) === 1 ? "ano" : "anos"}</span>
                </p>
                <p className="mt-2 text-[16px] font-semibold">{w.t}</p>
                <p className="text-[13px] text-white/50">{w.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================ CRONOGRAMA ============================ */}
        <section data-track="cronograma" className="pt-20">
          <Eyebrow>Do sim ao sol</Eyebrow>
          <H2>
            Em cerca de {lastDay} dias, <span className={GT}>seu sistema gerando.</span>
          </H2>
          <ol className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((st, i) => {
              const last = i === steps.length - 1;
              const g: GlyphId[] = ["contratos", "casa", "documentos", "propostas", "pacote", "chave", "busca", "sol"];
              return (
                <li key={`${i}-${st.title}`} className={cx("relative rounded-[22px] p-5", last ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]" : "bg-[#111513] ring-1 ring-white/[0.06]")}>
                  <div className="flex items-center justify-between">
                    <GlyphTile id={last ? "sol" : g[i % g.length]} size="md" className="!h-10 !w-10 !rounded-[11px]" />
                    <span className={cx("rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums", last ? "bg-[#0A0D0B] text-[#F3E93B]" : "bg-white/[0.07] text-white/70")}>Dia {st.day}</span>
                  </div>
                  <p className="mt-4 text-[16px] font-bold">{st.title}</p>
                  <p className={cx("mt-1 text-[13px] leading-snug", last ? "text-[#0A0D0B]/70" : "text-white/55")}>{st.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ============================ INVESTIMENTO ============================ */}
        <section data-track="investimento" className="pt-20">
          <div className="relative overflow-hidden rounded-[36px] bg-[#111513] ring-1 ring-[#6FBF8E]/30">
            <div className={cx("h-2 w-full", GRAD)} />
            <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.22)_0%,rgba(111,191,142,0)_62%)]" />
            <div className="relative p-6 sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">
                    <span className={cx("rounded-[6px] px-1.5 py-0.5 text-[10px] font-black text-[#0A0D0B]", GRAD)}>BLACK FRIDAY</span>
                    Seu investimento
                  </p>
                  <p className="mt-3 text-[30px] leading-tight font-bold tracking-[-0.04em] sm:text-[44px]">
                    {firstName}, este é o <span className={GT}>preço de Black</span> do seu sistema.
                  </p>
                </div>
                {!accepted && (
                  <div>
                    <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-white/50 uppercase">Válido até {BF_END_SHORT}. Termina em</p>
                    <Countdown size="sm" />
                  </div>
                )}
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
                <div className="rounded-[28px] bg-[#050706]/70 p-6 ring-1 ring-white/[0.08]">
                  <p className="text-[14px] text-white/55">À vista</p>
                  <p className={cx("mt-1 text-[48px] leading-none font-bold tracking-[-0.05em] sm:text-[64px]", GT)}>{brl(price, 0)}</p>
                  <p className="mt-2 text-[13px] text-white/45">
                    {fmtNum(kwp, 2)} kWp · {brl(price / Math.max(1, kwp * 1000))} por Wp instalado
                  </p>
                  <div className="mt-6 grid gap-2">
                    {cardInstallment > 0 && (
                      <div className="flex items-center gap-3 rounded-[18px] bg-[#111513] p-3.5 ring-1 ring-white/[0.06]">
                        <GlyphTile id="recibos" size="md" className="!h-10 !w-10 !rounded-[11px]" />
                        <div className="flex-1">
                          <p className="text-[12px] text-white/50">Cartão de crédito</p>
                          <p className="text-[18px] font-bold">
                            {inputs.cardInstallments}x de {brl(cardInstallment)}
                          </p>
                        </div>
                      </div>
                    )}
                    {longest && (
                      <div className="flex items-center gap-3 rounded-[18px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] p-3.5 text-[#0A0D0B]">
                        <GlyphTile id="cifrao" size="md" className="!h-10 !w-10 !rounded-[11px]" />
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold opacity-70">Financiamento sem entrada</p>
                          <p className="text-[18px] font-bold">
                            {longest.months}x de {brl(longest.installment)}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#0A0D0B] px-2.5 py-1 text-[11px] font-bold text-[#F3E93B]">1ª em 120 dias</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {swap !== null && longest && (
                    <div className="rounded-[28px] bg-[#050706]/70 p-6 ring-1 ring-white/[0.08]">
                      <p className="text-[13px] font-bold tracking-[0.12em] text-white/50 uppercase">A troca inteligente</p>
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div>
                          <p className="text-[12px] text-white/50">Sua conta hoje</p>
                          <p className="text-[26px] font-bold text-white/45 line-through decoration-[#FF453A] decoration-[3px]">{brl(energy.monthlyBillBefore, 0)}</p>
                        </div>
                        <Arrow className="h-6 w-6 text-[#8FD9A8]" />
                        <div>
                          <p className="text-[12px] text-white/50">Parcela + conta nova</p>
                          <p className="text-[26px] font-bold">{brl(longest.installment + energy.monthlyBillAfter, 0)}</p>
                        </div>
                      </div>
                      <p className="mt-4 rounded-[16px] bg-[#6FBF8E]/12 px-4 py-3 text-[15px] leading-snug text-[#C9EBA8]">
                        {longest.installment + energy.monthlyBillAfter <= energy.monthlyBillBefore ? (
                          <>
                            Você troca a conta de luz por um sistema que é seu, <b className="text-white">pagando menos do que paga hoje</b>. E quando as parcelas acabam, fica só a conta mínima.
                          </>
                        ) : (
                          <>
                            A economia de <b className="text-white">{brl(savedMonth, 0)}/mês</b> paga a maior parte da parcela. E quando as parcelas acabam, fica só a conta mínima.
                          </>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["72x", "sem entrada"],
                      ["120 dias", "para a 1ª parcela"],
                      ["21x", "no cartão"],
                      ["30 dias", "para instalar"],
                    ].map(([b, t], i) => (
                      <div key={b} className={cx("relative overflow-hidden rounded-[18px] px-4 py-3.5", i === 0 ? `${GRAD} text-[#0A0D0B]` : "bg-[#050706]/70 ring-1 ring-white/[0.08]")}>
                        <p className="text-[24px] leading-none font-bold tracking-[-0.04em]">{b}</p>
                        <p className={cx("mt-1 text-[12px] font-semibold", i === 0 ? "text-[#0A0D0B]/70" : "text-white/55")}>{t}</p>
                        <span className="absolute top-1/2 -right-2.5 h-5 w-5 -translate-y-1/2 rounded-full bg-[#111513]" />
                      </div>
                    ))}
                  </div>
                  {inputs.paymentNotes && <p className="rounded-[16px] bg-white/[0.05] px-4 py-3 text-[14px] whitespace-pre-line text-white/70">{inputs.paymentNotes}</p>}
                </div>
              </div>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                {accepted ? (
                  <span className="inline-flex h-[60px] items-center gap-2 rounded-full bg-[#6FBF8E]/15 px-7 text-[17px] font-bold text-[#8FD9A8]">
                    <Tick className="h-5 w-5" /> Aceita em {formatDate(accepted.at, { day: "2-digit", month: "long" })}
                  </span>
                ) : (
                  <Cta big onClick={accept} className="w-full sm:w-auto">
                    Garantir meu preço de Black <Arrow />
                  </Cta>
                )}
                <p className="text-[12px] leading-snug text-white/40">O aceite online não gera cobrança: ele reserva esta condição enquanto o contrato é preparado. Financiamento sujeito a análise de crédito.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================ CONSULTOR ============================ */}
        <section data-track="consultor" className="pt-20">
          <div className="grid gap-4 rounded-[32px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="flex items-start gap-4">
              <span className={cx("grid h-16 w-16 shrink-0 place-items-center rounded-[20px] text-[24px] font-bold text-[#0A0D0B]", GRAD)}>
                {sellerName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <p className="text-[13px] font-bold tracking-[0.14em] text-[#8FD9A8] uppercase">Seu consultor</p>
                <p className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.03em]">{data.seller?.name || s.company_name}</p>
                <p className="mt-2 max-w-md text-[15px] text-white/60">
                  {firstName}, preparei este projeto pensando no seu consumo e no seu telhado. Qualquer dúvida, é só me chamar: respondo rápido.
                </p>
                {contactPhone && <p className="mt-2 text-[14px] text-white/50">{formatPhone(contactPhone)}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2 lg:items-end">
              {wa && (
                <Cta big variant="ghost" href={wa} onHref={() => click("whatsapp")} className="w-full lg:w-auto">
                  <Chat /> Tirar uma dúvida agora
                </Cta>
              )}
              {s.about && <p className="text-[13px] leading-relaxed text-white/45 lg:max-w-sm lg:text-right">{s.about}</p>}
            </div>
          </div>
        </section>

        {/* ============================ DÚVIDAS ============================ */}
        {s.proposal.sections.faq && (
          <section data-track="duvidas" className="pt-20">
            <Eyebrow>Dúvidas</Eyebrow>
            <H2>Respostas diretas.</H2>
            <div className="mt-8 overflow-hidden rounded-[28px] bg-[#111513] ring-1 ring-white/[0.06]">
              {faq.map((f) => (
                <details key={f.q} className="group border-white/[0.07] [&:not(:last-child)]:border-b">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[20px] leading-none transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-6 pb-6 text-[15px] leading-relaxed text-white/65">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ============================ FECHAMENTO ============================ */}
        <section className="pt-20">
          <div className="relative overflow-hidden rounded-[36px] bg-[#111513] px-6 py-14 text-center ring-1 ring-white/[0.06] sm:py-20">
            <div className="pointer-events-none absolute -bottom-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.3)_0%,rgba(111,191,142,0)_62%)]" />
            <p className="relative text-[42px] leading-[0.92] font-bold tracking-[-0.055em] sm:text-[84px]">
              {firstName}, o sol já está
              <br />
              <span className={GT}>no seu telhado.</span>
            </p>
            <p className="relative mx-auto mt-5 max-w-lg text-[17px] text-white/60">Falta só você dizer sim. O preço de Black acaba dia {BF_END_SHORT}; a economia, não.</p>
            {!accepted && (
              <div className="relative mt-8 flex justify-center">
                <Countdown />
              </div>
            )}
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              {accepted ? (
                <span className="inline-flex h-[60px] items-center gap-2 rounded-full bg-[#6FBF8E]/15 px-7 text-[17px] font-bold text-[#8FD9A8]">
                  <Tick className="h-5 w-5" /> Obrigado pela confiança!
                </span>
              ) : (
                <Cta big onClick={accept}>
                  Sim, quero garantir <Arrow />
                </Cta>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-14 max-w-6xl px-4 text-[11px] leading-relaxed text-white/35 sm:px-6">
        <p className="mb-1 font-semibold text-white/50">Premissas de cálculo</p>
        Irradiação média de {fmtNum(inputs.sunHours, 2)} kWh/m²/dia e rendimento de {fmtNum(inputs.performanceRatio * 100)}%; tarifa de {brl(inputs.tariff, 3)}/kWh com reajuste de {fmtNum(inputs.tariffIncrease, 1)}% a.a.; fio B
        conforme a Lei 14.300/2022; iluminação pública de {brl(inputs.publicLighting)}; degradação de {fmtNum(inputs.degradation, 1)}% a.a. Valores estimados: a geração real depende de clima, sombra e orientação do telhado.
        Condições de Black Friday válidas {BF_LABEL}, sujeitas a análise de crédito. Proposta nº {data.proposal.number}
        {data.proposal.valid_until ? `, válida até ${formatDate(data.proposal.valid_until)}` : ""}. {s.company_name}
        {s.cnpj ? ` · CNPJ ${s.cnpj}` : ""}.
      </footer>

      {canAccept && <BfStickyBar onAccept={accept} waHref={wa} onWa={() => click("whatsapp")} />}
      {token && (
        <AcceptModal
          open={acceptOpen}
          onClose={() => setAcceptOpen(false)}
          token={token}
          defaultName={data.lead.name}
          days={lastDay}
          note={`Ao aceitar, você reserva a condição de Black Friday (válida ${BF_LABEL}) enquanto o contrato é preparado. O aceite online não gera cobrança. Após a assinatura, o prazo estimado até o sistema em operação é de ${lastDay} dias.`}
          onAccepted={(by) => {
            click("aceite");
            setAccepted({ at: new Date().toISOString(), by });
            setAcceptOpen(false);
          }}
        />
      )}
    </div>
  );
}
