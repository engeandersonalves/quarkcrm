"use client";

import Link from "next/link";
import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { cloneElement, forwardRef, isValidElement, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { brl } from "@/lib/pricing";
import { fmtNum, parseNumero } from "@/lib/format";

const merge = extendTailwindMerge({ extend: { classGroups: { shadow: ["shadow-soft", "shadow-lift", "shadow-glow"] } } });
/** clsx + tailwind-merge: classes passadas por props sobrescrevem as padrão. */
export const cx = (...v: ClassValue[]) => merge(clsx(v));

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "brand" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 shadow-soft",
  brand: "bg-brand-gradient text-ink-950 shadow-glow hover:brightness-105",
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

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cx(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    variants[variant],
    sizes[size],
    className,
  );
}

/** Link com cara de botão. Desabilitado, não navega. */
export function ButtonLink({
  href,
  target,
  title,
  disabled,
  variant,
  size,
  className,
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  "aria-label"?: string;
  href: string;
  target?: "_blank";
  title?: string;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const cls = buttonClass({ variant, size, className });
  if (disabled)
    return (
      <span aria-disabled="true" aria-label={ariaLabel} title={title} className={cx(cls, "pointer-events-none opacity-40")}>
        {children}
      </span>
    );
  if (target || /^(https?:|tel:|mailto:)/.test(href))
    return (
      <a href={href} target={target ?? (href.startsWith("http") ? "_blank" : undefined)} rel="noreferrer" title={title} aria-label={ariaLabel} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  return (
    <Link href={href} title={title} aria-label={ariaLabel} className={cls} onClick={onClick}>
      {children}
    </Link>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass({ variant, size, className })}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Inputs */

const fieldBase =
  "w-full rounded-xl bg-white px-3.5 text-[15px] sm:text-sm text-ink-900 ring-1 ring-ink-200 placeholder:text-ink-400 transition focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, "h-11 sm:h-10", className)} {...rest} />;
});

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, "min-h-[88px] py-2.5 leading-relaxed", className)} {...rest} />;
}

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

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  // Liga o rótulo ao campo (leitor de tela anuncia o nome; tocar no rótulo foca o campo).
  const auto = useId();
  let id = htmlFor;
  let conteudo = children;
  if (!id && isValidElement(children) && typeof children.type !== "string") {
    const props = children.props as { id?: string };
    id = props.id ?? auto;
    if (!props.id) conteudo = cloneElement(children as ReactElement<{ id?: string }>, { id });
  } else if (!id && isValidElement(children) && ["input", "select", "textarea"].includes(children.type as string)) {
    const props = children.props as { id?: string };
    id = props.id ?? auto;
    if (!props.id) conteudo = cloneElement(children as ReactElement<{ id?: string }>, { id });
  }
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-600">
        {label}
      </label>
      {conteudo}
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * Campo numérico com formatação pt-BR. Mantém o texto digitado enquanto focado
 * e formata ao sair do campo.
 */
export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  digits = 2,
  className,
  placeholder,
  id,
  disabled,
  autoFocus,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  digits?: number;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
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
      {prefix && <span className="pointer-events-none absolute left-3.5 text-sm font-medium text-ink-400">{prefix}</span>}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder ?? (digits ? "0,00" : "0")}
        className={cx(fieldBase, "tnum h-11 sm:h-10", prefix && "pl-10", suffix && "pr-14")}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          setFocused(false);
          setText(format(parseNumero(text)));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseNumero(e.target.value));
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 text-xs font-semibold text-ink-400">{suffix}</span>}
    </div>
  );
}

export function MoneyInput(props: Omit<Parameters<typeof NumberInput>[0], "prefix">) {
  return <NumberInput prefix="R$" {...props} />;
}

/* --------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-xl bg-ink-100 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]",
            value === o.value ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Layout */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200/70">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ className, children, dot }: { className?: string; children: ReactNode; dot?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", className)}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const parts = (name ?? "?").trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  const hue = [...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 52%), hsl(${(hue + 40) % 360} 60% 42%))` }}
    >
      {ini || "?"}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">{icon}</div>
      <p className="font-display font-semibold text-ink-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-ink-200/60", className)} />;
}

/* ------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          "animate-sheet-up sm:animate-fade-up relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-lift sm:rounded-3xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink-200 sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 grid h-9 w-9 place-items-center rounded-xl text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- Misc */

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("tnum", className)}>{brl(value)}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-10 rounded-full transition", checked ? "bg-brand-500" : "bg-ink-300")}
      >
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

/* ----------------------------------------------------------------- Stepper */

/** Quantidade com botões − / + grandes (bom para o celular). */
export function Stepper({ value, onChange, min = 0, max, className, id }: { value: number; onChange: (v: number) => void; min?: number; max?: number; className?: string; id?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const set = (v: number) => onChange(Math.max(min, max != null ? Math.min(max, v) : v));
  return (
    <div className={cx("inline-flex h-10 items-center rounded-xl bg-white ring-1 ring-ink-200", className)}>
      <button type="button" onClick={() => set(value - 1)} className="grid h-10 w-9 place-items-center rounded-l-xl text-ink-500 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-40" disabled={value <= min} aria-label="Diminuir">
        <Minus className="h-4 w-4" />
      </button>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (Number.isFinite(n)) set(n);
        }}
        onBlur={() => setText(String(value))}
        className="tnum h-10 w-12 bg-transparent text-center text-[15px] font-semibold text-ink-900 focus:outline-none"
      />
      <button type="button" onClick={() => set(value + 1)} className="grid h-10 w-9 place-items-center rounded-r-xl text-ink-500 hover:bg-ink-50 hover:text-ink-900" aria-label="Aumentar">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- Stat */

export function Stat({ label, value, hint, icon, tone = "default", className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "default" | "good" | "warn" | "bad"; className?: string }) {
  const tones = {
    default: "bg-ink-100 text-ink-600",
    good: "bg-brand-100 text-brand-700",
    warn: "bg-amber-100 text-amber-700",
    bad: "bg-rose-100 text-rose-700",
  };
  return (
    <Card className={cx("p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        {icon && <span className={cx("grid h-8 w-8 place-items-center rounded-lg", tones[tone])}>{icon}</span>}
      </div>
      <p className="tnum mt-2 font-display text-2xl font-semibold tracking-tight text-ink-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </Card>
  );
}
