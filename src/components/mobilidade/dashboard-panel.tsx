"use client";

import { useMemo, useState } from "react";
import { cx } from "@/components/ui";
import { closedAt, saleStage } from "@/lib/moto-board";
import type { MotoProduct } from "@/lib/moto-products";
import { contractValue, vehicleName, type MotoData } from "@/lib/moto-sale";
import { OverviewPanel, SectionTitle, saleProfit } from "./board-panels";
import { brl0, type SaleDoc, type Sales } from "./sale-row";

/**
 * Painel de vendas da Mobilidade: indicadores, vendas por mês, funil dos últimos
 * 90 dias e modelos mais vendidos. Uma série por gráfico, cor única da marca
 * (#1F9D55 claro / #33A366 escuro, validadas), rótulos seletivos e dica ao tocar.
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const sale = (d: SaleDoc) => d.data as unknown as MotoData;
const PANEL = "rounded-[24px] bg-white p-5 ring-1 ring-ink-200/80 dark:bg-[#0f1311] dark:ring-white/[0.07]";
const MARK = "bg-[#1F9D55] dark:bg-[#33A366]";

export function DashboardPanel({ sales, products }: { sales: Sales; products: MotoProduct[] }) {
  const all = useMemo(() => (sales.data ?? []) as SaleDoc[], [sales.data]);
  const s = useMemo(() => {
    const now = new Date();
    const ym = (d: Date) => d.toISOString().slice(0, 7);
    const sold = all.filter((d) => saleStage(d) === "vendida");
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 15);
      const key = ym(d);
      const list = sold.filter((x) => closedAt(x).slice(0, 7) === key);
      return { key, label: MONTHS[d.getMonth()], value: list.reduce((t, x) => t + contractValue(sale(x)), 0), count: list.length };
    });
    const cur = months[5];
    const prev = months[4];
    const profits = sold.filter((x) => closedAt(x).slice(0, 7) === cur.key).map((x) => saleProfit(sale(x), products)).filter((v): v is number => v !== null);
    const since = Date.now() - 90 * 86_400_000;
    const recent = all.filter((d) => new Date(d.created_at).getTime() >= since);
    const funnel = {
      orcamentos: recent.length,
      contratos: recent.filter((d) => saleStage(d) !== "orcamento").length,
      vendidas: recent.filter((d) => saleStage(d) === "vendida").length,
    };
    const byModel = new Map<string, number>();
    for (const x of sold) {
      const m = vehicleName(sale(x)).replace(/^Scooter elétrica\s*/, "") || "Outro";
      byModel.set(m, (byModel.get(m) ?? 0) + 1);
    }
    const models = [...byModel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      months,
      cur,
      prev,
      ticket: cur.count ? cur.value / cur.count : sold.length ? sold.reduce((t, x) => t + contractValue(sale(x)), 0) / sold.length : 0,
      profit: profits.length ? profits.reduce((t, v) => t + v, 0) : null,
      conversion: funnel.orcamentos ? Math.round((funnel.vendidas / funnel.orcamentos) * 100) : null,
      funnel,
      models,
      soldTotal: sold.length,
    };
  }, [all, products]);

  const delta = s.prev.value ? Math.round(((s.cur.value - s.prev.value) / s.prev.value) * 100) : null;
  const kpis = [
    { k: "Vendido no mês", v: brl0(s.cur.value), sub: delta === null ? `${s.cur.count} ${s.cur.count === 1 ? "scooter" : "scooters"}` : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs. ${s.prev.label}`, tone: delta === null ? "" : delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400" },
    { k: "Lucro do mês", v: s.profit === null ? "—" : brl0(s.profit), sub: s.profit === null ? "cadastre os custos dos modelos" : "estimado pelos custos" },
    { k: "Ticket médio", v: s.ticket ? brl0(s.ticket) : "—", sub: "por scooter vendida" },
    { k: "Conversão · 90 dias", v: s.conversion === null ? "—" : `${s.conversion}%`, sub: `${s.funnel.vendidas} de ${s.funnel.orcamentos} orçamentos` },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((x) => (
          <div key={x.k} className={PANEL}>
            <p className="text-[12px] font-bold tracking-[0.08em] text-ink-500 uppercase">{x.k}</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{x.v}</p>
            <p className={cx("mt-0.5 text-[12.5px] text-ink-500", x.tone)}>{x.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <MonthlyChart months={s.months} />
        <div className="grid gap-4">
          <Funnel f={s.funnel} />
          <TopModels models={s.models} total={s.soldTotal} />
        </div>
      </div>

      <OverviewPanel sales={sales} products={products} />
    </div>
  );
}

function MonthlyChart({ months }: { months: { key: string; label: string; value: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.value));
  const peak = months.reduce((b, m, i) => (m.value > months[b].value ? i : b), 0);
  return (
    <section className={PANEL}>
      <SectionTitle title="Vendas por mês" />
      <p className="-mt-1 text-[13px] text-ink-500">Valor dos contratos assinados nos últimos 6 meses</p>
      <div className="relative mt-5 flex h-[190px] items-end gap-3 border-b border-ink-200 dark:border-white/10" role="img" aria-label={months.map((m) => `${m.label}: ${brl0(m.value)}`).join("; ")}>
        {[0.5, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-200/70 dark:border-white/[0.06]" style={{ bottom: `${g * 100}%` }} />
        ))}
        {months.map((m, i) => {
          const h = (m.value / max) * 100;
          const show = hover === i || (hover === null && (i === months.length - 1 || i === peak) && m.value > 0);
          return (
            <button
              key={m.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
              aria-label={`${m.label}: ${brl0(m.value)}, ${m.count} ${m.count === 1 ? "scooter" : "scooters"}`}
              className="relative flex h-full flex-1 items-end justify-center"
            >
              {show && (
                <span className="absolute z-10 rounded-lg bg-[#0B1A12] px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-white shadow-lg dark:bg-white dark:text-[#0B1A12]" style={{ bottom: `calc(${Math.max(h, 2)}% + 6px)` }}>
                  {brl0(m.value)} · {m.count}
                </span>
              )}
              <span className={cx("w-full max-w-[44px] rounded-t-[4px] transition-opacity", MARK, hover !== null && hover !== i && "opacity-40")} style={{ height: `${Math.max(h, m.value ? 2 : 0)}%` }} />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3">
        {months.map((m, i) => (
          <span key={m.key} className={cx("flex-1 text-center text-[12px] text-ink-500", i === months.length - 1 && "font-semibold text-ink-800 dark:text-white")}>
            {m.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Vendas por mês</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th>{m.label}</th>
              <td>{brl0(m.value)}</td>
              <td>{m.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Funnel({ f }: { f: { orcamentos: number; contratos: number; vendidas: number } }) {
  const rows = [
    ["Orçamentos feitos", f.orcamentos],
    ["Contratos enviados", f.contratos],
    ["Vendas fechadas", f.vendidas],
  ] as const;
  const max = Math.max(1, f.orcamentos);
  return (
    <section className={PANEL}>
      <SectionTitle title="Funil · 90 dias" />
      <div className="grid gap-3">
        {rows.map(([k, v], i) => (
          <div key={k}>
            <div className="flex items-baseline justify-between text-[13.5px]">
              <span className="font-medium">{k}</span>
              <span className="tabular-nums">
                <b>{v}</b>
                {i > 0 && f.orcamentos > 0 && <span className="ml-1.5 text-[12px] text-ink-500">{Math.round((v / f.orcamentos) * 100)}%</span>}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]">
              <div className={cx("h-full rounded-full", MARK)} style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopModels({ models, total }: { models: [string, number][]; total: number }) {
  const max = Math.max(1, ...models.map((m) => m[1]));
  return (
    <section className={PANEL}>
      <SectionTitle title="Modelos mais vendidos" />
      {models.length ? (
        <div className="grid gap-2.5">
          {models.map(([m, n]) => (
            <div key={m} className="grid grid-cols-[96px_1fr_44px] items-center gap-3 text-[13.5px]">
              <span className="truncate font-medium">{m}</span>
              <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]">
                <div className={cx("h-full rounded-full", MARK)} style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="text-right tabular-nums">
                <b>{n}</b>
                <span className="ml-1 text-[11.5px] text-ink-500">{Math.round((n / total) * 100)}%</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13.5px] text-ink-500">Ainda não há vendas fechadas.</p>
      )}
    </section>
  );
}
