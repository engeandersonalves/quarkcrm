"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented, Select, cx } from "@/components/ui";
import type { AlarmRules } from "@/lib/monitoring/alarms";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

type Reading = {
  device_sn: string;
  at: string;
  grid_v: number | null;
  v_r: number | null;
  v_s: number | null;
  v_t: number | null;
  v_line: number | null;
  i_r: number | null;
  i_s: number | null;
  i_t: number | null;
  power_kw: number | null;
  temp_c: number | null;
  freq_hz: number | null;
  dc_v: number | null;
  phases: number | null;
};

type Metric = "tensao" | "fases" | "corrente" | "potencia" | "temperatura" | "frequencia" | "cc";
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: "tensao", label: "Tensão da rede", unit: "V" },
  { value: "fases", label: "Tensão por fase", unit: "V" },
  { value: "corrente", label: "Corrente", unit: "A" },
  { value: "potencia", label: "Potência", unit: "kW" },
  { value: "temperatura", label: "Temperatura", unit: "°C" },
  { value: "frequencia", label: "Frequência", unit: "Hz" },
  { value: "cc", label: "Tensão CC", unit: "V" },
];
const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;
const COLORS = ["#8E6CF7", "#3FBF6A", "#F0642E"];
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Histórico elétrico dos inversores (gravado a cada download), com o limite de alarme tracejado. */
export function HistoryChart({ plantId, rules }: { plantId: string; rules: AlarmRules | null }) {
  const [metric, setMetric] = useState<Metric>("tensao");
  const [range, setRange] = useState<keyof typeof RANGES>("7d");
  const [sn, setSn] = useState<string>("");

  const since = useMemo(() => new Date(Date.now() - RANGES[range] * 86400_000).toISOString(), [range]);
  const { data, loading } = useLive<Reading[] | null>(
    async () => {
      const { data, error } = await supabase().from("monitoring_readings").select("*").eq("plant_id", plantId).gte("at", since).order("at").limit(5000);
      return error ? null : ((data ?? []) as Reading[]);
    },
    [plantId, since],
    [],
  );

  const rows = data ?? [];
  const devices = [...new Set(rows.map((r) => r.device_sn))];
  const device = sn && devices.includes(sn) ? sn : devices[0];
  const list = rows.filter((r) => r.device_sn === device);
  const tri = list.some((r) => (n(r.phases) ?? 1) >= 3);

  const series: { name: string; key: keyof Reading }[] =
    metric === "tensao"
      ? [{ name: tri ? "Entre fases" : "Rede", key: tri ? "v_line" : "grid_v" }]
      : metric === "fases"
        ? [
            { name: "Fase R", key: "v_r" },
            { name: "Fase S", key: "v_s" },
            { name: "Fase T", key: "v_t" },
          ]
        : metric === "corrente"
          ? [
              { name: "Fase R", key: "i_r" },
              { name: "Fase S", key: "i_s" },
              { name: "Fase T", key: "i_t" },
            ]
          : [{ name: METRICS.find((m) => m.value === metric)!.label, key: ({ potencia: "power_kw", temperatura: "temp_c", frequencia: "freq_hz", cc: "dc_v" } as const)[metric as "potencia"] }];
  const active = series.filter((s) => list.some((r) => n(r[s.key]) !== null));
  const unit = METRICS.find((m) => m.value === metric)!.unit;

  const limits: { label: string; value: number }[] = [];
  if (rules) {
    if (metric === "tensao") {
      const sample = list.map((r) => n(tri ? r.v_line : r.grid_v)).find((v) => v !== null) ?? 220;
      if (tri) limits.push({ label: `Limite ${rules.overTri} V`, value: rules.overTri });
      else if (sample < 170) limits.push({ label: `Limite ${rules.over127} V`, value: rules.over127 });
      else limits.push({ label: `Limite ${rules.overMono} V`, value: rules.overMono });
    }
    if (metric === "fases" && tri) limits.push({ label: `Limite ${rules.overMono} V`, value: rules.overMono });
    if (metric === "temperatura") limits.push({ label: `Alerta ${rules.tempWarn} °C`, value: rules.tempWarn });
    if (metric === "frequencia") limits.push({ label: `${rules.freqMin} Hz`, value: rules.freqMin }, { label: `${rules.freqMax} Hz`, value: rules.freqMax });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="w-auto">
          {METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "24h", label: "24 h" },
            { value: "7d", label: "7 dias" },
            { value: "30d", label: "30 dias" },
          ]}
        />
        {devices.length > 1 && (
          <Select value={device} onChange={(e) => setSn(e.target.value)} className="w-auto">
            {devices.map((d) => (
              <option key={d} value={d}>
                Inversor {d}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="mt-4">
        {data === null ? (
          <p className="grid h-56 place-items-center rounded-2xl bg-ink-50 px-6 text-center text-sm text-ink-500 dark:bg-white/[0.03]">Rode o supabase/schema.sql para começar a gravar o histórico elétrico.</p>
        ) : loading && !rows.length ? (
          <div className="h-56 animate-pulse rounded-2xl bg-ink-50 dark:bg-white/[0.03]" />
        ) : active.length && list.length >= 2 ? (
          <LineChart points={list} series={active} unit={unit} limits={limits} days={RANGES[range]} />
        ) : (
          <p className="grid h-56 place-items-center rounded-2xl bg-ink-50 px-6 text-center text-sm text-ink-500 dark:bg-white/[0.03]">
            {list.length < 2 ? "O histórico se forma a cada leitura dos inversores (a cada 1h30, aproximadamente)." : "O fabricante não envia esta medida para este inversor."}
          </p>
        )}
      </div>
    </div>
  );
}

function LineChart({ points, series, unit, limits, days }: { points: Reading[]; series: { name: string; key: keyof Reading }[]; unit: string; limits: { label: string; value: number }[]; days: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Largura real do gráfico: textos sempre no mesmo tamanho, no celular e no computador
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(300, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = width;
  const H = 260;
  const pad = { l: 52, r: 12, t: 16, b: 30 };
  const t0 = new Date(points[0].at).getTime();
  const t1 = new Date(points[points.length - 1].at).getTime();
  const vals = points.flatMap((p) => series.map((s) => n(p[s.key]))).filter((v): v is number => v !== null);
  const all = [...vals, ...limits.map((l) => l.value)];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const span = Math.max(1, hi - lo);
  lo -= span * 0.12;
  hi += span * 0.12;
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.85];
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: unit === "Hz" ? 2 : 1 });
  const timeLabel = (t: number) => new Date(t).toLocaleString("pt-BR", days <= 1 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" });
  const xTicks = (W < 500 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => t0 + (t1 - t0) * f);

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(new Date(points[i].at).getTime()) - px) < Math.abs(x(new Date(points[best].at).getTime()) - px)) best = i;
    setHover(best);
  };
  const hp = hover !== null ? points[hover] : null;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-ink-600">
          {series.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: COLORS[i] }} /> {s.name}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-ink-100" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-400" fontSize={11}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="fill-ink-400" fontSize={11}>
              {timeLabel(t)}
            </text>
          ))}
          {limits.map((l) => (
            <g key={l.label}>
              <line x1={pad.l} x2={W - pad.r} y1={y(l.value)} y2={y(l.value)} stroke="#E5484D" strokeWidth={1.2} strokeDasharray="5 4" />
              <text x={W - pad.r} y={y(l.value) - 4} textAnchor="end" fill="#E5484D" fontSize={11} fontWeight={600}>
                {l.label}
              </text>
            </g>
          ))}
          {series.map((s, i) => {
            const pts = points.map((p) => [x(new Date(p.at).getTime()), n(p[s.key])] as const).filter((p) => p[1] !== null);
            const d = pts.map((p, j) => `${j ? "L" : "M"}${p[0].toFixed(1)} ${y(p[1]!).toFixed(1)}`).join(" ");
            return <path key={s.name} d={d} fill="none" stroke={COLORS[i]} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />;
          })}
          {hp && (
            <g>
              <line x1={x(new Date(hp.at).getTime())} x2={x(new Date(hp.at).getTime())} y1={pad.t} y2={H - pad.b} className="stroke-ink-300" strokeWidth={1} />
              {series.map((s, i) => {
                const v = n(hp[s.key]);
                return v === null ? null : <circle key={s.name} cx={x(new Date(hp.at).getTime())} cy={y(v)} r={4} fill={COLORS[i]} stroke="white" strokeWidth={2} />;
              })}
            </g>
          )}
        </svg>
        {hp && (
          <div
            className={cx("pointer-events-none absolute top-2 z-10 rounded-xl bg-ink-950 px-3 py-2 text-xs text-white shadow-lift", x(new Date(hp.at).getTime()) > W / 2 ? "-translate-x-full" : "")}
            style={{ left: `${(x(new Date(hp.at).getTime()) / W) * 100}%`, marginLeft: x(new Date(hp.at).getTime()) > W / 2 ? -10 : 10 }}
          >
            <p className="font-semibold">{new Date(hp.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
            {series.map((s, i) => {
              const v = n(hp[s.key]);
              return v === null ? null : (
                <p key={s.name} className="tnum flex items-center gap-1.5 text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLORS[i] }} />
                  {s.name}: {fmt(v)} {unit}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
