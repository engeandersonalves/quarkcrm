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

      <div className="relative border-t border-white/10 px-6 py-5">
        <p className="mb-3 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Conta de luz do cliente</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06]">
            <p className="text-[11px] text-ink-400">Hoje</p>
            <p className="tnum text-lg font-semibold">{brl(energy.monthlyBillBefore, 0)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-400/20">
            <p className="text-[11px] text-emerald-300/80">Com solar</p>
            <p className="tnum text-lg font-semibold text-emerald-300">{brl(energy.monthlyBillAfter, 0)}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-1 text-[12px]">
          <MiniRow label={`Fio B (${fmtNum(energy.fioBPct * 100)}%)`} value={energy.bill.fioBCharge} />
          <MiniRow label="Taxa mínima (complemento)" value={energy.bill.minimumTopUp} />
          <MiniRow label="Energia comprada da rede" value={energy.bill.energyCharge} />
          <MiniRow label="Iluminação pública" value={energy.bill.publicLighting} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-[13px]">
          <span className="text-ink-400">Economia/mês · {energy.savingsPct ? pct(energy.savingsPct, 0) : "—"}</span>
          <span className="tnum font-semibold text-emerald-400">{brl(energy.monthlySavings)}</span>
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

function MiniRow({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-ink-400">
      <span>{label}</span>
      <span className="tnum text-ink-200">{brl(value)}</span>
    </div>
  );
}

/** Prévia da conta antes × depois, para o formulário. */
export function BillPreview({ energy, inputs }: { energy: EnergyResult; inputs: ProposalInputs }) {
  if (!energy.monthlyBillBefore) return null;
  const lines = [
    { label: `Fio B (${fmtNum(energy.fioBPct * 100)}% em ${new Date().getFullYear()})`, value: energy.bill.fioBCharge, tip: `${fmtNum(energy.bill.compensatedKwh)} kWh compensados × ${brl(inputs.fioBTariff, 3)}` },
    { label: "Complemento da taxa mínima", value: energy.bill.minimumTopUp, tip: `Mínimo de ${energy.availabilityKwh} kWh` },
    { label: "Energia comprada da rede", value: energy.bill.energyCharge, tip: "Consumo que o sistema não cobre" },
    { label: "Iluminação pública", value: energy.bill.publicLighting, tip: "Cobrança municipal fixa" },
  ].filter((l) => l.value > 0.004);
  const w = Math.max(3, (energy.monthlyBillAfter / energy.monthlyBillBefore) * 100);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-600/15 sm:col-span-2">
      <div className="grid gap-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-ink-600">Conta hoje</span>
            <b className="tnum">{brl(energy.monthlyBillBefore)}</b>
          </div>
          <div className="h-2.5 rounded-full bg-ink-300" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-ink-600">Conta com energia solar</span>
            <b className="tnum text-emerald-700">{brl(energy.monthlyBillAfter)}</b>
          </div>
          <div className="h-2.5 rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${w}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 border-t border-emerald-600/10 pt-3">
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-ink-600">
              {l.label} <span className="text-[11px] text-ink-400">· {l.tip}</span>
            </span>
            <span className="tnum font-medium text-ink-800">{brl(l.value)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center justify-between rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
        <span>Economia estimada</span>
        <span className="tnum">
          {brl(energy.monthlySavings)}/mês · {pct(energy.savingsPct, 0)}
        </span>
      </p>
    </div>
  );
}

/** Navegação por etapas do orçamento (âncoras). */
export function StepNav({ steps }: { steps: { id: string; label: string; done: boolean }[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-ink-200/60 bg-ink-50/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
      <div className="flex items-center gap-3">
        <div className="scrollbar-none flex flex-1 gap-1.5 overflow-x-auto">
          {steps.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cx(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 transition",
                s.done ? "bg-white text-ink-800 ring-emerald-500/30" : "bg-white text-ink-500 ring-ink-200 hover:text-ink-800",
              )}
            >
              <span className={cx("grid h-4.5 w-4.5 place-items-center rounded-full text-[10px]", s.done ? "bg-emerald-500 text-white" : "bg-ink-100 text-ink-500")}>
                {s.done ? "✓" : i + 1}
              </span>
              {s.label}
            </a>
          ))}
        </div>
        <span className="hidden shrink-0 text-xs font-semibold text-ink-500 sm:block">
          {doneCount}/{steps.length}
        </span>
      </div>
    </div>
  );
}
