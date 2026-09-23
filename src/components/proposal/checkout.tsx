"use client";

import { AlertTriangle, Leaf, TrendingUp, Zap } from "lucide-react";
import { brl, fmtNum, pct, type EnergyResult, type PricingResult, type ProposalInputs } from "@/lib/pricing";
import { cx } from "../ui";

function Row({ label, detail, value, strong, muted, negative }: { label: string; detail?: string; value: number; strong?: boolean; muted?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className={cx("text-[13px]", strong ? "font-semibold text-white" : muted ? "text-ink-400" : "text-ink-300")}>{label}</p>
        {detail && <p className="truncate text-[11px] text-ink-500">{detail}</p>}
      </div>
      <p className={cx("tnum shrink-0 text-[13px]", strong ? "font-semibold text-white" : negative ? "text-emerald-400" : "text-ink-200")}>
        {negative && value > 0 ? "− " : ""}
        {brl(value)}
      </p>
    </div>
  );
}

function compLabel(name: string, c: ProposalInputs["commission"]) {
  return c.mode === "percent" ? `${name} (${fmtNum(c.value, c.value % 1 ? 1 : 0)}%)` : name;
}

export function Checkout({ inputs, pricing, energy }: { inputs: ProposalInputs; pricing: PricingResult; energy: EnergyResult }) {
  const dcac = pricing.dcAcRatio;
  const warnDcAc = pricing.inverterTotalKw > 0 && pricing.powerKwp > 0 && (dcac > 1.4 || dcac < 0.75);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 text-white shadow-lift">
      <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sun-500/20 blur-3xl" />

      <div className="relative px-6 pt-6">
        <p className="text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Resumo do orçamento</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={<Zap className="h-3.5 w-3.5" />} label="Potência" value={`${fmtNum(pricing.powerKwp, 2)} kWp`} />
          <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Geração" value={`${fmtNum(energy.monthlyGeneration)} kWh`} sub="média/mês" />
          <Metric icon={<Leaf className="h-3.5 w-3.5" />} label="Payback" value={energy.paybackYears ? `${fmtNum(energy.paybackYears, 1)} anos` : "—"} />
        </div>
        {warnDcAc && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Relação CC/CA de {fmtNum(dcac, 2)} — confira o dimensionamento do inversor.
          </div>
        )}
      </div>

      <div className="relative mt-5 border-t border-dashed border-white/10 px-6 pt-4">
        <p className="mb-1 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Custos diretos</p>
        {pricing.lines.map((l) => (
          <Row key={l.key} label={l.label} detail={l.detail} value={l.value} />
        ))}
        <div className="mt-1 border-t border-white/10 pt-1">
          <Row label="Custo total" value={pricing.directCost} strong />
        </div>
      </div>

      <div className="relative mt-3 border-t border-dashed border-white/10 px-6 pt-4">
        <p className="mb-1 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Formação de preço</p>
        <Row label={compLabel("Comissão", inputs.commission)} value={pricing.commissionValue} />
        <Row label={compLabel("Impostos", inputs.tax)} value={pricing.taxValue} />
        <Row label={compLabel("Lucro", inputs.profit)} detail={`Margem líquida ${pct(pricing.netMargin)}`} value={pricing.profitValue} />
        {pricing.discountValue > 0 && <Row label="Desconto concedido" value={pricing.discountValue} negative muted />}
        {pricing.roundingAdjust > 0 && <Row label="Arredondamento" value={pricing.roundingAdjust} muted />}
      </div>

      <div className="relative mt-4 bg-white/[0.03] px-6 py-5">
        {pricing.error ? (
          <p className="flex items-center gap-2 text-sm text-rose-300">
            <AlertTriangle className="h-4 w-4" /> {pricing.error}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <p className="pb-1 text-sm font-medium text-ink-400">Preço final</p>
              <p className="tnum font-display text-[34px] leading-none font-semibold tracking-tight text-sun-gradient">{brl(pricing.finalPrice)}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini label="R$/Wp" value={brl(pricing.pricePerWp)} />
              <Mini label="Markup" value={`${fmtNum(pricing.markup, 2)}×`} />
              <Mini label="Lucro" value={brl(pricing.profitValue, 0)} highlight={pricing.profitValue < 0} />
            </div>
          </>
        )}
      </div>

      <div className="relative grid grid-cols-2 gap-px border-t border-white/10 bg-white/5 text-center">
        <div className="bg-ink-950 px-4 py-3.5">
          <p className="text-[11px] text-ink-500">Economia/mês p/ cliente</p>
          <p className="tnum mt-0.5 text-sm font-semibold text-emerald-400">{brl(energy.monthlySavings)}</p>
        </div>
        <div className="bg-ink-950 px-4 py-3.5">
          <p className="text-[11px] text-ink-500">Cobertura do consumo</p>
          <p className="tnum mt-0.5 text-sm font-semibold text-white">{energy.coverage ? pct(energy.coverage, 0) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/[0.06]">
      <p className="flex items-center gap-1 text-[11px] text-ink-400">
        <span className="text-sun-400">{icon}</span>
        {label}
      </p>
      <p className="tnum mt-1 text-[13px] font-semibold whitespace-nowrap">{value}</p>
      {sub && <p className="text-[10px] text-ink-500">{sub}</p>}
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2">
      <p className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className={cx("tnum mt-0.5 text-[13px] font-semibold", highlight ? "text-rose-400" : "text-ink-100")}>{value}</p>
    </div>
  );
}
