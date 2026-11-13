"use client";

import type { ReactNode } from "react";
import { GlyphTile, type GlyphId } from "@/components/app/ios-glyphs";
import type { PublicProposal } from "@/components/proposal/document";
import { BF_END_SHORT, BF_LABEL } from "@/lib/black-friday";
import { mergeInputs, mergeSettings } from "@/lib/defaults";
import { formatDate, formatPhone } from "@/lib/format";
import {
  brl,
  calcEnergy,
  calcFinancing,
  fmtNum,
  pct,
  pmt,
} from "@/lib/pricing";
import { DEFAULT_FAQ, DEFAULT_TIMELINE } from "@/lib/proposal-content";
import {
  inverterImageOf,
  moduleImageOf,
  productImg,
} from "@/lib/product-images";

/**
 * Proposta Black Friday em páginas A4 (794 × 1123 px = 210 × 297 mm a 96 dpi).
 * Cada página é fotografada e vira uma página do PDF: nada corta no meio,
 * sem cabeçalhos do navegador, sem botões e sem contagem regressiva.
 */
export const PDF_PAGE_W = 794;
export const PDF_PAGE_H = 1123;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GT = `${GRAD} bg-clip-text text-transparent`;

/* ---------------------------------------------------------------- modelo */

function model(data: PublicProposal) {
  const s = mergeSettings(data.settings);
  const inputs = mergeInputs(data.proposal.inputs);
  const price = Number(data.proposal.final_price);
  const startYear = new Date(data.proposal.created_at).getFullYear();
  const kwp = (inputs.modulePowerW * inputs.moduleQty) / 1000;
  const energy = calcEnergy(inputs, price, startYear);
  const financing = calcFinancing(
    price,
    inputs.financingRate,
    inputs.financingTerms,
  );
  const cardInstallment =
    inputs.cardInstallments > 0
      ? pmt(price, inputs.cardRate, inputs.cardInstallments)
      : 0;
  const longest = financing.length ? financing[financing.length - 1] : null;
  const totalDays = Math.max(10, Math.round(inputs.installationDays || 40));
  const steps = s.proposal.timeline.length
    ? [...s.proposal.timeline].sort((a, b) => a.day - b.day)
    : DEFAULT_TIMELINE.map((st) => ({
        ...st,
        day: Math.round((st.day / 40) * totalDays),
      }));
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  return {
    s,
    inputs,
    price,
    kwp,
    energy,
    financing,
    cardInstallment,
    longest,
    steps,
    lastDay: steps.length ? steps[steps.length - 1].day : totalDays,
    faq: s.proposal.sections.faq
      ? s.proposal.faq.length
        ? s.proposal.faq
        : DEFAULT_FAQ
      : [],
    firstName: data.lead.name.split(" ")[0],
    hasBill: energy.monthlyBillBefore > 0,
    savedMonth: Math.max(0, energy.monthlyBillBefore - energy.monthlyBillAfter),
    city: [data.lead.city, data.lead.state].filter(Boolean).join(" – "),
    contactPhone,
    sellerName: data.seller?.name || s.company_name || "nossa equipe",
    moduleImg:
      productImg(moduleImageOf(inputs.moduleImage, s.proposal.moduleImage)) ||
      "/bf/placa-bifacial.png",
    inverterImg:
      productImg(
        inverterImageOf(inputs.inverterImage, s.proposal.inverterImage),
      ) || "/bf/inversor-a.png",
    cum: energy.cashflow.filter((c) => c.year <= 25),
  };
}
type Model = ReturnType<typeof model>;

/* ---------------------------------------------------------------- peças */

function Page({
  m,
  data,
  n,
  total,
  children,
  cover,
}: {
  m: Model;
  data: PublicProposal;
  n: number;
  total: number;
  children: ReactNode;
  cover?: boolean;
}) {
  return (
    <div
      data-pdf-page
      className="relative flex flex-col overflow-hidden bg-[#050706] font-[family-name:var(--font-outfit)] text-white antialiased"
      style={{ width: PDF_PAGE_W, height: PDF_PAGE_H }}
    >
      <div className="pointer-events-none absolute -top-56 -right-56 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.20)_0%,rgba(111,191,142,0)_62%)]" />
      {!cover && (
        <header className="relative flex items-center justify-between border-b border-white/[0.07] px-12 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.s.logo_url || "/bf/logo.png"}
            alt=""
            className="h-7 w-auto"
          />
          <div className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] text-white/45 uppercase">
            <span
              className={cx(
                "rounded-[5px] px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-[#0A0D0B]",
                GRAD,
              )}
            >
              BLACK FRIDAY
            </span>
            Proposta nº {data.proposal.number} · {data.lead.name}
          </div>
        </header>
      )}
      <div className={cx("relative flex-1", cover ? "" : "px-12 pt-8")}>
        {children}
      </div>
      <footer className="relative flex items-center justify-between px-12 pt-3 pb-6 text-[10px] text-white/35">
        <span>
          {m.s.company_name}
          {m.s.cnpj ? ` · CNPJ ${m.s.cnpj}` : ""}
          {m.contactPhone ? ` · ${formatPhone(m.contactPhone)}` : ""}
        </span>
        <span className="tabular-nums">
          {n} / {total}
        </span>
      </footer>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-[#8FD9A8] uppercase">
      <span className={cx("h-[3px] w-6 rounded-full", GRAD)} />
      {children}
    </p>
  );
}
function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-2.5 text-[34px] leading-[1] font-bold tracking-[-0.045em]">
      {children}
    </h2>
  );
}
function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[22px] bg-[#111513] ring-1 ring-white/[0.07]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- páginas */

function Cover({ m, data }: { m: Model; data: PublicProposal }) {
  const { energy } = m;
  return (
    <div className="flex h-full flex-col">
      <div className={cx("h-2 w-full", GRAD)} />
      <div className="flex items-center justify-between px-12 pt-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.s.logo_url || "/bf/logo.png"}
          alt=""
          className="h-10 w-auto"
        />
        <div className="text-right text-[11px] leading-snug text-white/50">
          <p className="font-bold tracking-[0.14em] text-white/70 uppercase">
            Proposta nº {data.proposal.number}
          </p>
          <p>
            {formatDate(data.proposal.created_at, {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
          {data.proposal.valid_until && (
            <p>Válida até {formatDate(data.proposal.valid_until)}</p>
          )}
        </div>
      </div>

      <div className="px-12 pt-12">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[12px] font-semibold text-white/80 ring-1 ring-white/10">
          <span
            className={cx(
              "rounded-[5px] px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-[#0A0D0B]",
              GRAD,
            )}
          >
            BLACK FRIDAY
          </span>
          Projeto exclusivo para {data.lead.name}
        </p>
        <h1 className="mt-5 text-[58px] leading-[0.94] font-bold tracking-[-0.055em]">
          {m.firstName}, sua conta de luz{" "}
          {m.hasBill ? <br /> : "vai cair."}
          {m.hasBill && (
            <>
              vai de{" "}
              <span className="text-white/40 line-through decoration-[#FF453A] decoration-[5px]">
                {brl(energy.monthlyBillBefore, 0)}
              </span>{" "}
              para <span className={GT}>{brl(energy.monthlyBillAfter, 0)}</span>
              .
            </>
          )}
        </h1>
        <p className="mt-5 max-w-[620px] text-[17px] leading-snug text-white/65">
          Um sistema de <b className="text-white">{fmtNum(m.kwp, 2)} kWp</b>{" "}
          feito sob medida{m.city ? ` para o seu imóvel em ${m.city}` : ""},
          gerando{" "}
          <b className="text-white">
            {fmtNum(energy.monthlyGeneration)} kWh por mês
          </b>
          , com a condição da Black Friday.
        </p>
      </div>

      {/* colagem */}
      <div className="relative mx-12 mt-6 h-[360px]">
        <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(159,219,124,0.26),rgba(159,219,124,0))]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bf/placa.png"
          alt=""
          className="absolute top-0 right-[10%] h-[88%] w-auto rotate-[14deg] brightness-[0.9]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bf/placa-bifacial.png"
          alt=""
          className="absolute top-[8%] right-[38%] h-[70%] w-auto rotate-[8deg] opacity-80"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bf/inversor-a.png"
          alt=""
          className="absolute bottom-0 left-[4%] h-[52%] w-auto"
        />
        {m.hasBill && (
          <div className="absolute top-[4%] left-0 rotate-[-7deg] rounded-[18px] bg-[#fff] px-5 py-3 text-[#0A0D0B] shadow-2xl">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-60">
              Na sua conta
            </p>
            <p className="text-[40px] leading-none font-bold tracking-[-0.05em]">
              -{pct(energy.savingsPct, 0)}
            </p>
          </div>
        )}
        <span
          className={cx(
            "absolute right-0 bottom-[14%] rotate-[6deg] rounded-[14px] px-4 py-2 text-[18px] font-bold text-[#0A0D0B]",
            GRAD,
          )}
        >
          72x sem entrada
        </span>
      </div>

      <div className="mt-auto grid grid-cols-4 gap-2.5 px-12 pb-4">
        {[
          { g: "sol" as GlyphId, l: "Potência", v: `${fmtNum(m.kwp, 2)} kWp` },
          {
            g: "raio" as GlyphId,
            l: "Geração",
            v: `${fmtNum(energy.monthlyGeneration)} kWh/mês`,
          },
          {
            g: "cifrao" as GlyphId,
            l: "Economia",
            v: m.hasBill ? `${brl(m.savedMonth, 0)}/mês` : "—",
          },
          {
            g: "relatorios" as GlyphId,
            l: "Retorno",
            v: energy.paybackYears
              ? `${fmtNum(energy.paybackYears, 1)} anos`
              : "—",
          },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-3 p-3.5">
            <GlyphTile
              id={k.g}
              size="md"
              className="!h-10 !w-10 !rounded-[11px]"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.08em] text-white/50 uppercase">
                {k.l}
              </p>
              <p className="text-[15px] leading-tight font-bold tracking-[-0.02em]">
                {k.v}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <div
        className={cx(
          "mx-12 mb-2 rounded-[14px] px-5 py-3 text-center text-[13px] font-bold text-[#0A0D0B]",
          GRAD,
        )}
      >
        Condição de Black Friday válida {BF_LABEL} · Projeto, homologação e
        instalação inclusos
      </div>
    </div>
  );
}

function Savings({ m }: { m: Model }) {
  const { energy, cum } = m;
  const maxCum = Math.max(1, ...cum.map((c) => Math.abs(c.cumulative)));
  return (
    <>
      <Eyebrow>O que muda na sua vida</Eyebrow>
      <H2>
        Todo mês, <span className={GT}>{brl(m.savedMonth, 0)} a mais</span> no
        seu bolso.
      </H2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card className="p-6">
          <p className="text-[11px] font-bold tracking-[0.12em] text-white/50 uppercase">
            Hoje, sem solar
          </p>
          <p className="mt-3 text-[54px] leading-none font-bold tracking-[-0.05em] text-white/45 line-through decoration-[#FF453A] decoration-[4px]">
            {brl(energy.monthlyBillBefore, 0)}
          </p>
          <p className="mt-2 text-[13px] text-white/50">
            por mês, e subindo todo ano com os reajustes
          </p>
        </Card>
        <div className="relative rounded-[22px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] p-6 text-[#0A0D0B]">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-70">
            Com o seu sistema Quark
          </p>
          <p className="mt-3 text-[54px] leading-none font-bold tracking-[-0.05em]">
            {brl(energy.monthlyBillAfter, 0)}
          </p>
          <p className="mt-2 text-[13px] font-semibold opacity-75">
            por mês: só taxas mínimas da distribuidora
          </p>
          <span className="absolute top-5 right-5 rounded-full bg-[#0A0D0B] px-3 py-1 text-[13px] font-bold text-[#F3E93B]">
            -{pct(energy.savingsPct, 0)}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          {
            g: "cifrao" as GlyphId,
            v: brl(energy.annualSavings, 0),
            l: "de economia já no 1º ano",
          },
          {
            g: "relatorios" as GlyphId,
            v: brl(energy.savings25y, 0),
            l: "economizados em 25 anos",
          },
          {
            g: "folha" as GlyphId,
            v: `${fmtNum(energy.treesEquivalent)} árvores`,
            l: "é o que o sistema equivale por ano",
          },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-3 p-4">
            <GlyphTile
              id={k.g}
              size="md"
              className="!h-10 !w-10 !rounded-[11px]"
            />
            <div>
              <p className="text-[20px] leading-none font-bold tracking-[-0.03em]">
                {k.v}
              </p>
              <p className="mt-1 text-[11px] leading-tight text-white/55">
                {k.l}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-3 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[17px] font-bold">
              O sistema se paga em{" "}
              {energy.paybackYears
                ? `${fmtNum(energy.paybackYears, 1)} anos`
                : "poucos anos"}
              . Depois, é lucro.
            </p>
            <p className="text-[12px] text-white/50">
              Saldo acumulado: economia menos o investimento, ano a ano
            </p>
          </div>
          <p className={cx("text-[26px] font-bold tracking-[-0.03em]", GT)}>
            +{brl(cum[cum.length - 1]?.cumulative ?? 0, 0)}
          </p>
        </div>
        <div className="mt-5 flex h-[230px] items-end gap-[5px]">
          {cum.map((c) => (
            <div
              key={c.year}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <div
                className={cx(
                  "w-full rounded-t-[3px]",
                  c.cumulative >= 0
                    ? "bg-[linear-gradient(0deg,#4FC38A_0%,#9FDB7C_60%,#F3E93B_100%)]"
                    : "bg-[#FF453A]/70",
                )}
                style={{
                  height: `${Math.max(2, (Math.abs(c.cumulative) / maxCum) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-white/40">
          <span>Ano 1</span>
          <span>Ano 10</span>
          <span>Ano 25</span>
        </div>
      </Card>
    </>
  );
}

function System({ m, compact }: { m: Model; compact?: boolean }) {
  const { inputs, s } = m;
  const items: { glyph: GlyphId; title: string; text: string }[] = [
    {
      glyph: "sol",
      title: "Placas solares",
      text: `${inputs.moduleQty} módulos de ${fmtNum(inputs.modulePowerW)} W`,
    },
    {
      glyph: "raio",
      title: "Inversor",
      text: "Transforma o sol na energia da casa",
    },
    {
      glyph: "pacote",
      title: "Estrutura de fixação",
      text: inputs.structureType || "Feita para o seu telhado",
    },
    {
      glyph: "escudo",
      title: "Proteções elétricas",
      text: "String box, DPS, disjuntores e aterramento",
    },
    {
      glyph: "documentos",
      title: "Projeto e ART",
      text: "Engenheiro responsável pelo sistema",
    },
    {
      glyph: "contratos",
      title: "Homologação",
      text: "Toda a papelada com a distribuidora",
    },
    {
      glyph: "chave",
      title: "Instalação",
      text: "Equipe própria, em até 30 dias",
    },
    {
      glyph: "celular",
      title: "Monitoramento",
      text: "Acompanhe a geração pelo app",
    },
  ];
  return (
    <div className={compact ? "mt-8" : ""}>
      <Eyebrow>Seu sistema</Eyebrow>
      <H2>
        Equipamentos de primeira,{" "}
        <span className={GT}>escolhidos para o seu telhado.</span>
      </H2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          {
            img: m.moduleImg,
            fallback: "/bf/placa-bifacial.png",
            g: "sol" as GlyphId,
            kicker: "Placas solares",
            title:
              [inputs.moduleBrand, inputs.moduleModel]
                .filter(Boolean)
                .join(" ") || "Módulos fotovoltaicos",
            specs: [
              ["Quantidade", `${inputs.moduleQty} placas`],
              [
                "Potência",
                `${fmtNum(inputs.modulePowerW)} W · ${fmtNum(m.kwp, 2)} kWp`,
              ],
              [
                "Garantia",
                `${s.warranty_modules_years ?? 12} anos + ${s.warranty_modules_performance_years ?? 25} de performance`,
              ],
            ],
          },
          {
            img: m.inverterImg,
            fallback: "/bf/inversor-a.png",
            g: "raio" as GlyphId,
            kicker: "Inversor",
            title:
              [inputs.inverterBrand, inputs.inverterModel]
                .filter(Boolean)
                .join(" ") || "Inversor solar",
            specs: [
              [
                "Quantidade",
                `${inputs.inverterQty} ${inputs.inverterQty === 1 ? "unidade" : "unidades"}`,
              ],
              ["Potência", `${fmtNum(inputs.inverterPowerKw, 1)} kW`],
              ["Monitoramento", "Pelo app, no celular"],
            ],
          },
        ].map((e) => (
          <Card key={e.kicker} className="overflow-hidden">
            <div className="relative flex h-[190px] items-center justify-center bg-[linear-gradient(160deg,#F4F7F4,#D9E3DC)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.img}
                data-fallback={e.fallback}
                alt=""
                className="h-[150px] w-auto max-w-[80%] object-contain"
              />
              <GlyphTile
                id={e.g}
                size="md"
                className="!absolute top-3 left-3 !h-10 !w-10 !rounded-[11px]"
              />
            </div>
            <div className="p-5">
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">
                {e.kicker}
              </p>
              <p className="mt-1 text-[19px] leading-tight font-bold tracking-[-0.02em]">
                {e.title}
              </p>
              <dl className="mt-3 grid gap-1.5">
                {e.specs.map(([l, v]) => (
                  <div
                    key={l}
                    className="flex justify-between gap-3 rounded-[11px] bg-[#050706]/70 px-3 py-2 text-[12px]"
                  >
                    <dt className="text-white/50">{l}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-7 text-[18px] font-bold tracking-[-0.02em]">
        Tudo incluso: <span className={GT}>você compra o sistema pronto.</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-center gap-3 rounded-[16px] bg-[#111513] p-3 ring-1 ring-white/[0.07]"
          >
            <GlyphTile
              id={it.glyph}
              size="sm"
              className="!h-9 !w-9 !rounded-[10px]"
            />
            <div className="min-w-0">
              <p className="text-[13px] leading-tight font-bold">{it.title}</p>
              <p className="text-[11px] leading-tight text-white/50">
                {it.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Warranty({ m }: { m: Model }) {
  const { s } = m;
  const glyphs: GlyphId[] = [
    "contratos",
    "casa",
    "documentos",
    "propostas",
    "pacote",
    "chave",
    "busca",
    "sol",
  ];
  return (
    <>
      <Eyebrow>Garantias</Eyebrow>
      <H2>
        Tranquilidade <span className={GT}>por décadas.</span>
      </H2>
      <div className="mt-6 grid grid-cols-4 gap-2.5">
        {[
          {
            g: "sol" as GlyphId,
            y: s.warranty_modules_performance_years ?? 25,
            t: "Performance das placas",
            d: "Mínimo de 80% de geração",
          },
          {
            g: "escudo" as GlyphId,
            y: s.warranty_modules_years ?? 12,
            t: "Placas",
            d: "Contra defeitos de fabricação",
          },
          {
            g: "raio" as GlyphId,
            y: s.warranty_inverter_years ?? 10,
            t: "Inversor",
            d: "Reparo ou troca pelo fabricante",
          },
          {
            g: "chave" as GlyphId,
            y: s.warranty_installation_years ?? 1,
            t: "Instalação",
            d: "Serviço da nossa equipe",
          },
        ].map((w) => (
          <Card key={w.t} className="p-4">
            <GlyphTile
              id={w.g}
              size="sm"
              className="!h-9 !w-9 !rounded-[10px]"
            />
            <p className="mt-4 flex items-baseline gap-1">
              <span
                className={cx(
                  "text-[44px] leading-none font-bold tracking-[-0.05em]",
                  GT,
                )}
              >
                {w.y}
              </span>
              <span className="text-[12px] font-semibold text-white/50">
                {Number(w.y) === 1 ? "ano" : "anos"}
              </span>
            </p>
            <p className="mt-1.5 text-[14px] font-semibold">{w.t}</p>
            <p className="text-[11px] text-white/50">{w.d}</p>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <Eyebrow>Do sim ao sol</Eyebrow>
        <H2>
          Em cerca de {m.lastDay} dias,{" "}
          <span className={GT}>seu sistema gerando.</span>
        </H2>
        <ol className="mt-6 grid grid-cols-2 gap-2.5">
          {m.steps.slice(0, 8).map((st, i, arr) => {
            const last = i === arr.length - 1;
            return (
              <li
                key={`${i}-${st.title}`}
                className={cx(
                  "rounded-[18px] p-4",
                  last
                    ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]"
                    : "bg-[#111513] ring-1 ring-white/[0.07]",
                )}
              >
                <div className="flex items-center justify-between">
                  <GlyphTile
                    id={last ? "sol" : glyphs[i % glyphs.length]}
                    size="sm"
                    className="!h-9 !w-9 !rounded-[10px]"
                  />
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums",
                      last
                        ? "bg-[#0A0D0B] text-[#F3E93B]"
                        : "bg-white/[0.07] text-white/70",
                    )}
                  >
                    Dia {st.day}
                  </span>
                </div>
                <p className="mt-3 text-[14px] font-bold">
                  {i + 1}. {st.title}
                </p>
                <p
                  className={cx(
                    "mt-0.5 text-[11px] leading-snug",
                    last ? "text-[#0A0D0B]/70" : "text-white/55",
                  )}
                >
                  {st.text}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

function Investment({ m, data }: { m: Model; data: PublicProposal }) {
  const { energy, longest, inputs } = m;
  const accepted = data.proposal.accepted_at;
  const options = m.financing.slice(-4);
  return (
    <>
      <div className="relative overflow-hidden rounded-[28px] bg-[#111513] ring-1 ring-[#6FBF8E]/30">
        <div className={cx("h-2 w-full", GRAD)} />
        <div className="p-7">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">
            <span
              className={cx(
                "rounded-[5px] px-1.5 py-0.5 text-[9px] font-black text-[#0A0D0B]",
                GRAD,
              )}
            >
              BLACK FRIDAY
            </span>
            Seu investimento
          </p>
          <p className="mt-2 text-[30px] leading-tight font-bold tracking-[-0.04em]">
            {m.firstName}, este é o <span className={GT}>preço de Black</span>{" "}
            do seu sistema.
          </p>
          <div className="mt-6 grid grid-cols-[1fr_1.1fr] gap-3">
            <div className="rounded-[22px] bg-[#050706]/70 p-5 ring-1 ring-white/[0.08]">
              <p className="text-[12px] text-white/55">À vista</p>
              <p
                className={cx(
                  "mt-1 text-[48px] leading-none font-bold tracking-[-0.05em]",
                  GT,
                )}
              >
                {brl(m.price, 0)}
              </p>
              <p className="mt-2 text-[11px] text-white/45">
                {fmtNum(m.kwp, 2)} kWp ·{" "}
                {brl(m.price / Math.max(1, m.kwp * 1000))} por Wp instalado
              </p>
              {m.cardInstallment > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[#111513] p-3 ring-1 ring-white/[0.06]">
                  <GlyphTile
                    id="recibos"
                    size="sm"
                    className="!h-9 !w-9 !rounded-[10px]"
                  />
                  <div>
                    <p className="text-[11px] text-white/50">
                      Cartão de crédito
                    </p>
                    <p className="text-[16px] font-bold">
                      {inputs.cardInstallments}x de {brl(m.cardInstallment)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-[22px] bg-[#050706]/70 p-5 ring-1 ring-white/[0.08]">
              <p className="text-[12px] text-white/55">
                Financiamento sem entrada · 1ª parcela em 120 dias
              </p>
              <div className="mt-3 grid gap-1.5">
                {options.length ? (
                  options.map((o, i) => (
                    <div
                      key={o.months}
                      className={cx(
                        "flex items-center justify-between rounded-[12px] px-3.5 py-2.5",
                        i === options.length - 1
                          ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]"
                          : "bg-[#111513] ring-1 ring-white/[0.06]",
                      )}
                    >
                      <span className="text-[13px] font-semibold">
                        {o.months}x
                      </span>
                      <span className="text-[17px] font-bold tabular-nums">
                        {brl(o.installment)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-white/50">
                    Consulte as opções com o seu consultor.
                  </p>
                )}
              </div>
            </div>
          </div>

          {m.hasBill && longest && (
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr_1.6fr] items-center gap-4 rounded-[22px] bg-[#050706]/70 p-5 ring-1 ring-white/[0.08]">
              <div>
                <p className="text-[11px] text-white/50">Sua conta hoje</p>
                <p className="text-[24px] font-bold text-white/45 line-through decoration-[#FF453A] decoration-[3px]">
                  {brl(energy.monthlyBillBefore, 0)}
                </p>
              </div>
              <span className="text-[22px] text-[#8FD9A8]">→</span>
              <div>
                <p className="text-[11px] text-white/50">
                  Parcela + conta nova
                </p>
                <p className="text-[24px] font-bold">
                  {brl(longest.installment + energy.monthlyBillAfter, 0)}
                </p>
              </div>
              <p className="rounded-[14px] bg-[#6FBF8E]/12 px-4 py-2.5 text-[12px] leading-snug text-[#C9EBA8]">
                {longest.installment + energy.monthlyBillAfter <=
                energy.monthlyBillBefore
                  ? "Você troca a conta de luz por um sistema que é seu, pagando menos do que paga hoje."
                  : `A economia de ${brl(m.savedMonth, 0)}/mês paga a maior parte da parcela.`}
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              ["72x", "sem entrada"],
              ["120 dias", "para a 1ª parcela"],
              ["21x", "no cartão"],
              ["30 dias", "para instalar"],
            ].map(([b, t], i) => (
              <div
                key={b}
                className={cx(
                  "rounded-[14px] px-3.5 py-3",
                  i === 0
                    ? `${GRAD} text-[#0A0D0B]`
                    : "bg-[#050706]/70 ring-1 ring-white/[0.08]",
                )}
              >
                <p className="text-[20px] leading-none font-bold tracking-[-0.04em]">
                  {b}
                </p>
                <p
                  className={cx(
                    "mt-1 text-[11px] font-semibold",
                    i === 0 ? "text-[#0A0D0B]/70" : "text-white/55",
                  )}
                >
                  {t}
                </p>
              </div>
            ))}
          </div>
          {inputs.paymentNotes && (
            <p className="mt-3 rounded-[14px] bg-white/[0.05] px-4 py-3 text-[12px] whitespace-pre-line text-white/70">
              {inputs.paymentNotes}
            </p>
          )}
          <p className="mt-4 text-[11px] leading-snug text-white/40">
            {accepted
              ? `Proposta aceita em ${formatDate(accepted, { day: "2-digit", month: "long", year: "numeric" })}. `
              : `Preço de Black válido até ${BF_END_SHORT}. `}
            O aceite online não gera cobrança. Financiamento sujeito a análise
            de crédito.
          </p>
        </div>
      </div>

      {/* consultor */}
      <Card className="mt-4 flex items-center gap-4 p-6">
        <span
          className={cx(
            "grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[20px] font-bold text-[#0A0D0B]",
            GRAD,
          )}
        >
          {m.sellerName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#8FD9A8] uppercase">
            Seu consultor
          </p>
          <p className="text-[22px] leading-tight font-bold tracking-[-0.03em]">
            {m.sellerName}
          </p>
          <p className="mt-1 text-[12px] text-white/55">
            {m.firstName}, preparei este projeto pensando no seu consumo e no
            seu telhado. Qualquer dúvida, é só me chamar.
          </p>
        </div>
        {m.contactPhone && (
          <div className="text-right">
            <p className="text-[11px] text-white/45">WhatsApp</p>
            <p className="text-[16px] font-bold">
              {formatPhone(m.contactPhone)}
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

function Faq({
  items,
  first,
}: {
  items: { q: string; a: string }[];
  first: boolean;
}) {
  return (
    <>
      {first && (
        <>
          <Eyebrow>Dúvidas</Eyebrow>
          <H2>Respostas diretas.</H2>
        </>
      )}
      <div className={cx("grid gap-2.5", first ? "mt-6" : "")}>
        {items.map((f) => (
          <Card key={f.q} className="p-5">
            <p className="text-[15px] font-bold">{f.q}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/65">
              {f.a}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}

function Assumptions({ m, data }: { m: Model; data: PublicProposal }) {
  const { inputs } = m;
  return (
    <div className="mt-6 rounded-[18px] bg-white/[0.03] p-5 text-[10px] leading-relaxed text-white/45 ring-1 ring-white/[0.06]">
      <p className="mb-1 text-[11px] font-semibold text-white/60">
        Premissas de cálculo
      </p>
      Irradiação média de {fmtNum(inputs.sunHours, 2)} kWh/m²/dia e rendimento
      de {fmtNum(inputs.performanceRatio * 100)}%; tarifa de{" "}
      {brl(inputs.tariff, 3)}/kWh com reajuste de{" "}
      {fmtNum(inputs.tariffIncrease, 1)}% a.a.; fio B conforme a Lei
      14.300/2022; iluminação pública de {brl(inputs.publicLighting)};
      degradação de {fmtNum(inputs.degradation, 1)}% a.a. Valores estimados: a
      geração real depende de clima, sombra e orientação do telhado. Condições
      de Black Friday válidas {BF_LABEL}, sujeitas a análise de crédito.
      Proposta nº {data.proposal.number}
      {data.proposal.valid_until
        ? `, válida até ${formatDate(data.proposal.valid_until)}`
        : ""}
      .
    </div>
  );
}

/* ---------------------------------------------------------------- documento */

/** Divide as dúvidas em blocos que cabem numa página. */
function chunkFaq(faq: { q: string; a: string }[]) {
  const pages: { q: string; a: string }[][] = [];
  let cur: { q: string; a: string }[] = [];
  let used = 120; // título da seção na primeira página
  for (const f of faq) {
    const h = 70 + Math.ceil((f.a.length + f.q.length) / 95) * 18;
    if (cur.length && used + h > 860) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(f);
    used += h;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export function ProposalPdfPages({ data }: { data: PublicProposal }) {
  const m = model(data);
  const faqPages = chunkFaq(m.faq);
  const pages: ReactNode[] = [];
  pages.push(<Cover key="capa" m={m} data={data} />);
  if (m.hasBill) pages.push(<Savings key="economia" m={m} />);
  pages.push(<System key="sistema" m={m} />);
  pages.push(<Warranty key="garantias" m={m} />);
  pages.push(<Investment key="investimento" m={m} data={data} />);
  faqPages.forEach((items, i) =>
    pages.push(
      <div key={`faq-${i}`}>
        <Faq items={items} first={i === 0} />
        {i === faqPages.length - 1 && <Assumptions m={m} data={data} />}
      </div>,
    ),
  );
  if (!faqPages.length)
    pages[pages.length - 1] = (
      <div key="investimento">
        <Investment m={m} data={data} />
        <Assumptions m={m} data={data} />
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      {pages.map((p, i) => (
        <Page
          key={i}
          m={m}
          data={data}
          n={i + 1}
          total={pages.length}
          cover={i === 0}
        >
          {p}
        </Page>
      ))}
    </div>
  );
}
