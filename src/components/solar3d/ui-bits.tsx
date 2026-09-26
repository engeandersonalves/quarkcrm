"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "../ui";

/** Número sem separador de milhar (vírgula ou ponto como decimal), aceita negativos. */
export function Num({
  value,
  onChange,
  suffix,
  digits = 2,
  min,
  max,
  step,
  className,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  digits?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}) {
  const fmt = (v: number) => (Number.isFinite(v) ? String(Number(v.toFixed(digits))).replace(".", ",") : "");
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = (t: string) => {
    const v = Number(t.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(v) && t.trim() !== "" && t.trim() !== "-") onChange(clamp(v));
  };
  return (
    <div className={cx("relative flex items-center", className)}>
      <input
        inputMode="decimal"
        disabled={disabled}
        className={cx(
          "tnum h-9 w-full rounded-lg bg-white px-2.5 text-sm text-ink-900 ring-1 ring-ink-200 transition focus:ring-2 focus:ring-sun-500 focus:outline-none disabled:bg-ink-50",
          suffix && "pr-11",
        )}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          setFocused(false);
          setText(fmt(value));
        }}
        onKeyDown={(e) => {
          if (step && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            const v = clamp(Number((value + (e.key === "ArrowUp" ? step : -step)).toFixed(6)));
            onChange(v);
            setText(fmt(v));
          }
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 text-[11px] font-semibold text-ink-400">{suffix}</span>}
    </div>
  );
}

export function F({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11.5px] font-semibold text-ink-500">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-ink-400">{hint}</span>}
    </label>
  );
}

export function Sel<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      className={cx("h-9 w-full rounded-lg bg-white px-2 text-sm text-ink-900 ring-1 ring-ink-200 focus:ring-2 focus:ring-sun-500 focus:outline-none", className)}
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Txt({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="h-9 w-full rounded-lg bg-white px-2.5 text-sm text-ink-900 ring-1 ring-ink-200 focus:ring-2 focus:ring-sun-500 focus:outline-none"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Chips<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 rounded-lg px-2.5 text-[12.5px] font-semibold ring-1 transition",
            value === o.value ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-left text-[13px] text-ink-700">
      <span className={cx("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-sun-500" : "bg-ink-300")}>
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export function Section({ title, icon, children, defaultOpen = true, badge }: { title: ReactNode; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-ink-100 last:border-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {icon && <span className="grid h-7 w-7 place-items-center rounded-lg bg-sun-50 text-sun-700 ring-1 ring-sun-200/60">{icon}</span>}
        <span className="font-display text-[13.5px] font-semibold text-ink-900">{title}</span>
        {badge}
        <ChevronDown className={cx("ml-auto h-4 w-4 text-ink-400 transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "sun" | "warn" | "bad" }) {
  return (
    <div
      className={cx(
        "rounded-xl px-3 py-2.5 ring-1",
        tone === "sun" ? "bg-sun-50 ring-sun-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : tone === "bad" ? "bg-rose-50 ring-rose-200" : "bg-ink-50 ring-ink-100",
      )}
    >
      <div className="text-[11px] font-semibold text-ink-500">{label}</div>
      <div className="tnum font-display text-[17px] font-semibold text-ink-950">{value}</div>
      {sub && <div className="text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

export function ToolButton({ active, onClick, title, children, disabled }: { active?: boolean; onClick: () => void; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "grid h-10 w-10 place-items-center rounded-xl transition disabled:opacity-40",
        active ? "bg-ink-900 text-sun-300 shadow-lift" : "bg-white/95 text-ink-700 shadow-soft ring-1 ring-ink-200 hover:bg-white hover:text-ink-950",
      )}
    >
      {children}
    </button>
  );
}

export const n1 = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
