/* eslint-disable @next/next/no-img-element */
import { forwardRef } from "react";
import type { QuickQuote } from "@/lib/quick-quote";
import { brl, fmtNum } from "@/lib/pricing";

export interface QuoteCardData {
  client: string;
  city?: string | null;
  roof?: string | null;
  moduleBrand?: string;
  inverterBrand?: string;
  moduleW: number;
  financingMonths: number;
  cardInstallments: number;
  cashDiscountPct: number;
  validityDays: number;
  company: string;
  logoUrl?: string | null;
  seller?: string | null;
  sellerPhone?: string | null;
  number: string;
}

export const CARD_W = 540;
export const CARD_H = 675;

/**
 * Orçamento rápido em uma imagem 4:5 (1080×1350 exportado em 2x), feito para WhatsApp e Instagram.
 * Medidas fixas em px: o que aparece na tela é exatamente o que vai para o PNG/PDF.
 */
export const QuoteCard = forwardRef<HTMLDivElement, { q: QuickQuote; d: QuoteCardData }>(function QuoteCard({ q, d }, ref) {
  const today = new Date();
  const until = new Date(today.getTime() + d.validityDays * 86400000);
  const date = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const afterPct = q.billBefore > 0 ? Math.max(5, (q.billAfter / q.billBefore) * 100) : 5;
  const first = d.client.trim() || "Cliente";
  const hasPrice = q.price > 0;

  return (
    <div
      ref={ref}
      style={{ width: CARD_W, height: CARD_H, fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
      className="relative flex flex-col overflow-hidden bg-[#0E0A1C] text-white"
    >
      {/* fundo */}
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#5B34D6]/45 blur-[80px]" />
      <div className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-[#9BD373]/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-[#F3EA3B]/15 blur-[80px]" />

      <div className="relative flex flex-1 flex-col px-7 pt-6 pb-5">
        {/* topo */}
        <div className="flex items-center justify-between">
          <img src={d.logoUrl || "/brand/logo-h-white.png"} alt={d.company} style={{ height: 30, width: "auto", maxWidth: 170, objectFit: "contain" }} />
          <div className="text-right">
            <p className="text-[9px] font-bold tracking-[0.2em] text-[#9BD373] uppercase">Orçamento rápido</p>
            <p className="text-[10px] text-white/55">
              Nº {d.number} · {date(today)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-[12px] text-white/60">Preparado para</p>
        <p className="font-display text-[26px] leading-tight font-semibold tracking-tight" style={{ fontFamily: "var(--font-sora), var(--font-jakarta), sans-serif" }}>
          {first}
        </p>
        {(d.city || d.roof) && <p className="text-[11.5px] text-white/50">{[d.city, d.roof].filter(Boolean).join(" · ")}</p>}

        {/* economia */}
        <div className="mt-4 rounded-[22px] bg-gradient-to-br from-[#F3EA3B] via-[#C7E36B] to-[#9BD373] px-5 py-4 text-[#1C1234]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9.5px] font-bold tracking-[0.16em] uppercase opacity-70">Economia estimada</p>
              <p className="text-[38px] leading-none font-extrabold tabular-nums">{brl(q.monthlySavings, 0)}</p>
              <p className="text-[11.5px] font-semibold opacity-75">por mês · {brl(q.annualSavings, 0)} por ano</p>
            </div>
            <div className="text-right">
              <p className="text-[9.5px] font-bold tracking-[0.16em] uppercase opacity-70">Em 25 anos</p>
              <p className="text-[18px] font-extrabold tabular-nums">{brl(q.savings25y, 0)}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5">
            {[
              ["Conta hoje", brl(q.billBefore, 0), 100, "#1C1234"],
              ["Com energia solar", brl(q.billAfter, 0), afterPct, "#FFFFFF"],
            ].map(([l, v, pct, c]) => (
              <div key={l as string}>
                <div className="flex justify-between text-[10.5px] font-semibold">
                  <span className="opacity-75">{l}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-[#1C1234]/10">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c as string, opacity: c === "#1C1234" ? 0.8 : 1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* sistema */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            [`${fmtNum(q.kwp, 2)} kWp`, "potência"],
            [`${q.modules} placas`, `${d.moduleBrand ? `${d.moduleBrand} ` : ""}${d.moduleW} W`],
            [`${fmtNum(q.inverterKw, q.inverterKw % 1 ? 1 : 0)} kW`, d.inverterBrand ? `inversor ${d.inverterBrand}` : "inversor"],
            [`${fmtNum(q.generation)} kWh`, "gerados por mês"],
            [`${q.areaM2} m²`, "de área"],
            [q.paybackYears > 0 ? `${fmtNum(q.paybackYears, 1)} anos` : `${fmtNum(q.coverage * 100)}%`, q.paybackYears > 0 ? "de retorno" : "do consumo"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-[14px] bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
              <p className="text-[15px] leading-tight font-bold tabular-nums">{v}</p>
              <p className="truncate text-[9.5px] text-white/55">{l}</p>
            </div>
          ))}
        </div>

        {/* investimento */}
        {hasPrice && (
          <div className="mt-3 rounded-[18px] bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#9BD373] uppercase">Investimento à vista</p>
                <p className="text-[24px] leading-tight font-extrabold tabular-nums">{brl(q.cashPrice, 0)}</p>
                {d.cashDiscountPct > 0 && <p className="text-[10px] text-white/50">já com {fmtNum(d.cashDiscountPct)}% de desconto · de {brl(q.price, 0)}</p>}
              </div>
              <div className="text-right text-[11.5px] leading-snug">
                {q.financing > 0 && (
                  <p>
                    ou <b className="text-[15px] text-[#F3EA3B] tabular-nums">{d.financingMonths}x {brl(q.financing, 0)}</b>
                    <span className="block text-[9.5px] text-white/50">no financiamento*</span>
                  </p>
                )}
                {q.card > 0 && (
                  <p className="mt-1">
                    ou <b className="tabular-nums">{d.cardInstallments}x {brl(q.card, 0)}</b> <span className="text-[9.5px] text-white/50">no cartão</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* rodapé */}
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold">{d.seller ? `${d.seller} · ${d.company}` : d.company}</p>
            {d.sellerPhone && <p className="text-[11px] text-[#9BD373]">WhatsApp {d.sellerPhone}</p>}
          </div>
          <p className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold">Válido até {date(until)}</p>
        </div>
        <p className="mt-2 text-[8.5px] leading-snug text-white/40">
          Estimativa com base no consumo informado, tarifa e irradiação média da região, já considerando taxa mínima e Fio B (Lei 14.300).
          {hasPrice && q.financing > 0 ? " *Parcelas sujeitas à aprovação de crédito." : ""} Valores finais após visita técnica.
        </p>
      </div>
    </div>
  );
});
