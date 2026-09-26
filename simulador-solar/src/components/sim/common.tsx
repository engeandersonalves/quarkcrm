"use client";

import type { ReactNode } from "react";
import { cx, NumberInput, Select, Switch } from "@/components/ui";

/** Cores dos fluxos de energia (paleta categórica validada para daltonismo). */
export const C = {
  pv: "#eda100",
  storage: "#1baf7a",
  import: "#2a78d6",
  gen: "#eb6834",
  export: "#4a3aa7",
  flex: "#e87ba4",
  curtailed: "#9a97ae",
  load: "#1c1234",
  grid2: "#e5e3ee",
};

export const n0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("pt-BR") : "—");
export const n1 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—");
export const n2 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
export const pct = (v: number, d = 0) => (Number.isFinite(v) ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d })}%` : "—");
export const brl0 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—");
export const hhmm = (h: number) => {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** Energia com unidade adequada (kWh / MWh). */
export const kwh = (v: number) => (Math.abs(v) >= 10000 ? `${n1(v / 1000)} MWh` : Math.abs(v) >= 100 ? `${n0(v)} kWh` : `${n1(v)} kWh`);

/** Campo numérico compacto com rótulo e unidade. */
export function Num({
  label,
  value,
  onChange,
  unit,
  digits = 1,
  hint,
  className,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  digits?: number;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="truncate text-[11.5px] font-semibold text-ink-500" title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      <NumberInput value={value} onChange={(v) => onChange(Number.isFinite(v) ? v : 0)} suffix={unit} digits={digits} className="[&_input]:h-9 [&_input]:text-[13px]" />
      {hint && <span className="text-[11px] leading-snug text-ink-400">{hint}</span>}
    </label>
  );
}

export function Pick<T extends string | number>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: ReactNode;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="truncate text-[11.5px] font-semibold text-ink-500">{label}</span>
      <Select
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
        className="h-9 text-[13px] sm:h-9"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Switch checked={checked} onChange={onChange} label={<span className="text-[13px] font-medium text-ink-700">{label}</span>} />
      {hint && <span className="text-[11px] leading-snug text-ink-400">{hint}</span>}
    </div>
  );
}

/** Legenda com amostra de cor + rótulo em texto (identidade nunca só pela cor). */
export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean; hatch?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-medium text-ink-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? (
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{
                background: i.hatch ? `repeating-linear-gradient(45deg, ${i.color} 0 2px, transparent 2px 4px)` : i.color,
                boxShadow: i.hatch ? `inset 0 0 0 1px ${i.color}` : undefined,
              }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Section({ title, icon, children, right, open = true }: { title: string; icon?: ReactNode; children: ReactNode; right?: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 select-none">
        {icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sun-50 text-sun-700 ring-1 ring-sun-200/60">{icon}</span>}
        <span className="flex-1 text-[14px] font-bold text-ink-900">{title}</span>
        {right}
        <span className="text-ink-400 transition group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-ink-100 px-4 pt-3 pb-4">{children}</div>
    </details>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-ink-200/70">
      <div className="text-[11.5px] font-semibold text-ink-500">{label}</div>
      <div
        className={cx(
          "tnum mt-1 font-display text-[22px] leading-none font-bold tracking-tight",
          tone === "good" ? "text-sun-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-rose-700" : "text-ink-900",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-500">{sub}</div>}
    </div>
  );
}

/** Reduz uma série longa a no máximo `max` pontos (média por janela), preservando a energia. */
export function bucketIndex(n: number, max: number) {
  const size = Math.max(1, Math.ceil(n / max));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i += size) out.push([i, Math.min(n, i + size)]);
  return out;
}

export function avg(a: ArrayLike<number>, from: number, to: number) {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i];
  return s / Math.max(1, to - from);
}
