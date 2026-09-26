"use client";

import clsx, { type ClassValue } from "clsx";
import { Loader2 } from "lucide-react";
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({ extend: { classGroups: { shadow: ["shadow-soft", "shadow-lift", "shadow-glow"] } } });
/** clsx + tailwind-merge: classes passadas por props sobrescrevem as padrão. */
export const cx = (...v: ClassValue[]) => merge(clsx(v));

export function fmtNum(v: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(v) ? v : 0);
}

/** Lê número digitado em pt-BR (ponto = milhar, vírgula = decimal). */
export function parseNumber(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "sun" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 shadow-soft",
  sun: "bg-sun-gradient text-ink-950 shadow-glow hover:brightness-105",
  secondary: "bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50 hover:ring-ink-300 shadow-soft",
  outline: "bg-transparent text-ink-700 ring-1 ring-ink-200 hover:bg-white",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Inputs */

const fieldBase =
  "w-full rounded-xl bg-white px-3.5 text-[15px] sm:text-sm text-ink-900 ring-1 ring-ink-200 placeholder:text-ink-400 transition focus:outline-none focus:ring-2 focus:ring-sun-500 disabled:bg-ink-50 disabled:text-ink-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, "h-11 sm:h-10", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        fieldBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2394a3b8%22><path d=%22M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z%22/></svg>')] bg-[length:18px] bg-[right_10px_center] bg-no-repeat pr-9 sm:h-10",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Campo numérico pt-BR: mantém o texto digitado enquanto focado e formata ao sair. */
export function NumberInput({
  value,
  onChange,
  suffix,
  digits = 2,
  className,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  suffix?: string;
  digits?: number;
  className?: string;
}) {
  const format = (v: number | null | undefined) => (v || v === 0 ? fmtNum(v, digits) : "");
  const [text, setText] = useState(format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, digits]);

  return (
    <div className={cx("relative flex items-center", className)}>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder={digits ? "0,00" : "0"}
        className={cx(fieldBase, "tnum h-11 sm:h-10", suffix && "pr-14")}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          setFocused(false);
          setText(format(parseNumber(text)));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseNumber(e.target.value));
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 text-xs font-semibold text-ink-400">{suffix}</span>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-10 rounded-full transition", checked ? "bg-sun-500" : "bg-ink-300")}
      >
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}
