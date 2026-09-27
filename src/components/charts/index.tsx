"use client";

/**
 * Gráficos do app (SVG leve, sem biblioteca): barras, área, rosca, funil, minigráfico e variação.
 * Paleta categórica validada (contraste e daltonismo): use as cores nesta ordem, nunca em ciclo.
 */
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { cx } from "../ui";

export const SERIES = ["#5B34D6", "#1FA36A", "#F0642E", "#2F7BF6", "#E0457B", "#B38600"];
export const OTHER = "#A1A1AA";
const INK = "#1C1234";

function Tooltip({ x, y, children, align = "center" }: { x: number; y: number; children: ReactNode; align?: "center" | "left" | "right" }) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-xl bg-ink-950/95 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lift"
      style={{ left: `${x}%`, top: y, transform: `translate(${align === "center" ? "-50%" : align === "left" ? "0" : "-100%"}, calc(-100% - 8px))` }}
    >
      {children}
    </div>
  );
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

/* ------------------------------------------------------------------ barras */

export function BarChart({
  data,
  format,
  color = SERIES[0],
  height = 220,
  sub,
}: {
  data: { label: string; value: number; full?: string }[];
  format: (v: number) => string;
  color?: string;
  height?: number;
  sub?: (i: number) => string | undefined;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.5, 1].map((k) => k * max);
  const n = data.length;
  const best = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  const plotH = height - 28;
  return (
    <div className="relative select-none" style={{ height }}>
      {ticks.map((t) => (
        <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ top: plotH - (t / max) * plotH }}>
          <span className="tnum w-12 shrink-0 text-right text-[10px] text-ink-400">{format(t)}</span>
          <span className={cx("h-px flex-1", t === 0 ? "bg-ink-300" : "bg-ink-100")} />
        </div>
      ))}
      <div className="absolute top-0 right-0 bottom-7 left-14 flex items-end gap-[2px]">
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          return (
            <div
              key={i}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
            >
              <div
                className="w-full max-w-[34px] rounded-t-[4px] transition-all duration-500"
                style={{ height: Math.max(d.value > 0 ? 3 : 0, h), background: color, opacity: hover == null || hover === i ? 1 : 0.45 }}
              />
              {i === best && d.value > 0 && hover == null && (
                <span className="tnum absolute text-[10px] font-semibold whitespace-nowrap text-ink-700" style={{ bottom: h + 4 }}>
                  {format(d.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="absolute right-0 bottom-0 left-14 flex gap-[2px]">
        {data.map((d, i) => (
          <span key={i} className={cx("flex-1 truncate text-center text-[10px]", hover === i ? "font-semibold text-ink-900" : "text-ink-400")}>
            {n > 8 && i % 2 === 1 && hover !== i ? "" : d.label}
          </span>
        ))}
      </div>
      {hover != null && (
        <Tooltip x={((hover + 0.5) / n) * 100} y={plotH - (data[hover].value / max) * plotH}>
          <p className="font-semibold capitalize">{data[hover].full ?? data[hover].label}</p>
          <p className="tnum text-white/80">{format(data[hover].value)}</p>
          {sub?.(hover) && <p className="text-white/60">{sub(hover)}</p>}
        </Tooltip>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- área */

export function AreaChart({ data, format, color = SERIES[1], height = 200 }: { data: { label: string; value: number }[]; format: (v: number) => string; color?: string; height?: number }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height - 24;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * W : W / 2);
  const y = (v: number) => H - (v / max) * (H - 8);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div className="relative select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[calc(100%-24px)] w-full overflow-visible"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((k) => (
          <line key={k} x1="0" x2={W} y1={y(max * k)} y2={y(max * k)} stroke="#EEEDF4" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1="0" x2={W} y1={H} y2={H} stroke="#CFCCDC" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#a${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke={INK} strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover != null && (
        <>
          <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${(x(hover) / W) * 100}%`, top: (y(data[hover].value) / H) * (height - 24), background: color }} />
          <Tooltip x={(x(hover) / W) * 100} y={(y(data[hover].value) / H) * (height - 24)} align={hover < 2 ? "left" : hover > data.length - 3 ? "right" : "center"}>
            <p className="font-semibold">Semana de {data[hover].label}</p>
            <p className="tnum text-white/80">{format(data[hover].value)}</p>
          </Tooltip>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-ink-400">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- rosca */

export function Donut({ data, center, centerSub, format = (v) => String(v) }: { data: { label: string; value: number; color: string }[]; center: string; centerSub: string; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  const gap = data.length > 1 ? 2 : 0;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={R} fill="none" stroke="#F0EFF5" strokeWidth="22" />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * C;
              const el = (
                <circle
                  key={d.label}
                  cx="90"
                  cy="90"
                  r={R}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={hover === i ? 26 : 22}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                  strokeDashoffset={-acc}
                  className="cursor-default transition-all duration-300"
                  style={{ opacity: hover == null || hover === i ? 1 : 0.4 }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
              acc += len;
              return el;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tnum font-display text-2xl font-semibold">{hover != null ? format(data[hover].value) : center}</p>
            <p className="max-w-[96px] text-[11px] leading-tight text-ink-500">{hover != null ? data[hover].label : centerSub}</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full gap-1.5">
        {data.map((d, i) => (
          <li
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition", hover === i && "bg-ink-50")}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-700">{d.label}</span>
            <span className="tnum font-semibold text-ink-900">{format(d.value)}</span>
            <span className="tnum w-10 text-right text-xs text-ink-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
        {!data.length && <li className="text-sm text-ink-400">Sem dados no período</li>}
      </ul>
    </div>
  );
}

/** Limita a lista às N maiores categorias e agrupa o resto em "Outros" (nunca gera uma 7ª cor). */
export function topWithOther<T extends { label: string; value: number }>(items: T[], n = 5) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, n).map((d, i) => ({ ...d, color: SERIES[i] }));
  const rest = sorted.slice(n).reduce((s, d) => s + d.value, 0);
  return rest > 0 ? [...top, { label: "Outros", value: rest, color: OTHER } as T & { color: string }] : top;
}

/* ------------------------------------------------------------------- funil */

export function Funnel({ steps, color = SERIES[0] }: { steps: { label: string; count: number; hint?: string }[]; color?: string }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div className="grid gap-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const conv = prev ? s.count / prev : null;
        return (
          <div key={s.label}>
            {conv != null && (
              <p className="tnum -mt-0.5 mb-1 pl-[130px] text-[11px] text-ink-400">
                ↓ {Math.round(conv * 100)}% avançam
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className="w-[118px] shrink-0 truncate text-right text-[13px] text-ink-600">{s.label}</span>
              <div className="relative h-8 flex-1">
                <div
                  className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-[6px] transition-all duration-700"
                  style={{ width: `${Math.max(4, (s.count / max) * 100)}%`, background: color, opacity: 1 - i * (0.6 / Math.max(1, steps.length - 1)) }}
                />
                <span className="tnum absolute inset-0 grid place-items-center text-[13px] font-semibold text-white mix-blend-normal" style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
                  {s.count}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ minigráfico */

export function Sparkline({ values, color = SERIES[0], className }: { values: number[]; color?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const d = useMemo(() => {
    const max = Math.max(1, ...values);
    const n = values.length;
    return values.map((v, i) => `${i ? "L" : "M"}${n > 1 ? (i / (n - 1)) * 100 : 50},${30 - (v / max) * 26}`).join(" ");
  }, [values]);
  if (values.length < 2) return null;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cx("h-8 w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,32 L0,32 Z`} fill={`url(#s${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- variação */

export function DeltaBadge({ value, invert, dark }: { value: number | null; invert?: boolean; dark?: boolean }) {
  if (value == null)
    return (
      <span className={cx("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold", dark ? "bg-white/10 text-white/70" : "bg-sun-50 text-sun-700")} title="Sem dados no período anterior para comparar">
        novo
      </span>
    );
  const flat = Math.abs(value) < 0.005;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cx(
        "tnum inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        flat ? (dark ? "bg-white/10 text-white/60" : "bg-ink-100 text-ink-500") : good ? (dark ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-50 text-emerald-700") : dark ? "bg-rose-400/15 text-rose-300" : "bg-rose-50 text-rose-700",
      )}
      title="Comparado ao período anterior"
    >
      <Icon className="h-3 w-3" />
      {flat ? "0%" : `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`}
    </span>
  );
}
