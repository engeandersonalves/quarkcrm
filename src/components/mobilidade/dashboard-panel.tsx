"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, PackageCheck, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cx } from "@/components/ui";
import { dateBr } from "@/lib/br";
import { PAY_LABEL, type PayMethod } from "@/lib/moto-ledger";
import type { MotoProduct } from "@/lib/moto-products";
import { motoPhoto, vehicleName } from "@/lib/moto-sale";
import { clientHref, clientKey } from "@/lib/moto-clients";
import { useLedgerRows, usePayments, type Row } from "./sales-ledger";
import type { Sales } from "./sale-row";

/**
 * Painel da Mobilidade: indicadores das vendas fechadas (valor final, lucro, scooters,
 * a receber), evolução de 6 meses, recebimento por forma de pagamento, modelos,
 * entregas pendentes e últimas vendas. Cores: verde da marca para lucro/destaque e
 * cinza neutro para custos (validadas para claro e escuro).
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CARD = "rounded-[26px] bg-white ring-1 ring-ink-200/70 dark:bg-[#0f1311] dark:ring-white/[0.07]";
const GREEN = "bg-[#1F9D55] dark:bg-[#33A366]";
const GRAY = "bg-[#CBD2CC] dark:bg-white/20";
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl0(v));
const model = (r: Row) => vehicleName(r.d).replace(/^Scooter elétrica\s*/, "") || "Scooter";

export function DashboardPanel({ sales, products }: { sales: Sales; products: MotoProduct[] }) {
  const payments = usePayments();
  const rows = useLedgerRows(sales, products, payments);

  const s = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const dt = new Date(now.getFullYear(), now.getMonth() - 5 + i, 15);
      const key = dt.toISOString().slice(0, 7);
      const list = rows.filter((r) => r.at.slice(0, 7) === key);
      const withCost = list.filter((r) => r.r.profit != null);
      return {
        key,
        label: MONTHS[dt.getMonth()],
        full: MONTHS_FULL[dt.getMonth()],
        count: list.length,
        final: list.reduce((t, r) => t + r.r.final, 0),
        cost: withCost.reduce((t, r) => t + r.r.cost.total, 0),
        profit: withCost.reduce((t, r) => t + (r.r.profit ?? 0), 0),
        finalWithCost: withCost.reduce((t, r) => t + r.r.final, 0),
      };
    });
    const cur = months[5];
    const prev = months[4];
    const monthRows = rows.filter((r) => r.at.slice(0, 7) === cur.key);
    const open = rows.reduce((t, r) => t + (r.r.estimated ? 0 : r.r.pay.open), 0);
    const overdue = rows.filter((r) => r.r.pay.overdue > 0).length;
    const unlaunched = rows.filter((r) => r.r.estimated).length;
    // Recebimento do mês por forma de pagamento (líquido já pago).
    const byMethod = new Map<PayMethod, number>();
    let received = 0;
    let expected = 0;
    for (const r of monthRows) {
      expected += r.r.final;
      for (const p of r.payments) {
        if (!p.paid) continue;
        const v = (Number(p.amount) || 0) - (Number(p.fee) || 0);
        received += v;
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + v);
      }
    }
    const models = new Map<string, { n: number; value: number; photo: string }>();
    for (const r of rows.filter((x) => x.at >= months[0].key)) {
      const m = model(r);
      const cur2 = models.get(m) ?? { n: 0, value: 0, photo: motoPhoto(r.d) };
      models.set(m, { n: cur2.n + 1, value: cur2.value + r.r.final, photo: cur2.photo });
    }
    return {
      months,
      cur,
      prev,
      delta: prev.final > 0 ? Math.round(((cur.final - prev.final) / prev.final) * 100) : null,
      margin: cur.finalWithCost > 0 ? Math.round((cur.profit / cur.finalWithCost) * 100) : null,
      open,
      overdue,
      unlaunched,
      received,
      expected,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
      models: [...models.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5),
      toDeliver: rows.filter((r) => !r.delivered).sort((a, b) => (a.d.delivery?.date || "9").localeCompare(b.d.delivery?.date || "9")),
      recent: rows.slice(0, 5),
    };
  }, [rows]);

  if (payments.data?.missing)
    return <p className={cx(CARD, "p-5 text-[14px] text-ink-600")}>Rode o arquivo supabase/schema.sql no Supabase (SQL Editor) para ativar os indicadores de vendas.</p>;

  const up = (s.delta ?? 0) >= 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* destaque do mês */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-[28px] p-6 text-white sm:p-7" style={{ background: "linear-gradient(150deg,#123A26 0%,#0B1A12 72%)" }}>
          <div aria-hidden className="absolute -top-24 -right-16 h-72 w-72 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(216,232,60,0.22), transparent)" }} />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold tracking-[0.18em] text-[#D8E83C] uppercase">Faturamento de {s.cur.full}</p>
              <p className="mt-2 text-[40px] leading-none font-extrabold tracking-[-0.03em] tabular-nums sm:text-[48px]">{brl0(s.cur.final)}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-white/70">
                {s.delta != null ? (
                  <span className={cx("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12.5px] font-bold", up ? "bg-[#9FDB7C]/20 text-[#C6F0A8]" : "bg-[#FF8A80]/20 text-[#FFC1BB]")}>
                    {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />} {Math.abs(s.delta)}%
                  </span>
                ) : null}
                {s.delta != null ? `vs. ${s.prev.full} (${brl0(s.prev.final)})` : `${s.cur.count} ${s.cur.count === 1 ? "scooter vendida" : "scooters vendidas"}`}
              </p>
            </div>
            <Link href="/mobilidade?aba=vendas&registrar=1" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-4 text-[13px] font-bold text-[#0A0D0B]">
              <Plus className="h-4 w-4" /> Venda
            </Link>
          </div>
          <Spark months={s.months} />
        </section>

        <div className="grid grid-cols-2 gap-4">
          <section className={cx(CARD, "col-span-2 flex items-center gap-5 p-5")}>
            <Ring value={s.margin} />
            <div className="min-w-0">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-500 uppercase">Lucro do mês</p>
              <p className="mt-1 text-[28px] leading-none font-extrabold text-[#1A7F45] tabular-nums dark:text-[#5CC88A]">{brl0(s.cur.profit)}</p>
              <p className="mt-1.5 text-[12.5px] text-ink-500">{s.margin != null ? `margem de ${s.margin}% sobre o valor final` : "cadastre os custos dos modelos"}</p>
            </div>
          </section>
          <Tile k="Scooters vendidas" v={String(s.cur.count)} sub={`${s.prev.count} em ${s.prev.full}`} />
          <Tile k="A receber" v={compact(s.open)} sub={s.overdue ? `${s.overdue} ${s.overdue === 1 ? "venda atrasada" : "vendas atrasadas"}` : s.unlaunched ? `${s.unlaunched} sem pagamento lançado` : "tudo em dia"} warn={s.overdue > 0} href="/mobilidade?aba=vendas" />
        </div>
      </div>

      {/* evolução e recebimento */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <MonthsChart months={s.months} />
        <section className={cx(CARD, "p-5 sm:p-6")}>
          <p className="text-[13px] font-bold tracking-[0.08em] uppercase">Recebimento de {s.cur.full}</p>
          <div className="mt-4 flex items-end justify-between gap-2">
            <p className="text-[26px] leading-none font-extrabold tabular-nums">{brl0(s.received)}</p>
            <p className="text-[12.5px] text-ink-500">de {brl0(s.expected)}</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]" role="img" aria-label={`Recebido ${brl0(s.received)} de ${brl0(s.expected)}`}>
            <div className={cx("h-full rounded-full transition-all", GREEN)} style={{ width: `${s.expected > 0 ? Math.min(100, (s.received / s.expected) * 100) : 0}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-500">{s.expected > 0 ? `${Math.min(100, Math.round((s.received / s.expected) * 100))}% já recebido` : "sem vendas no mês"}</p>
          <div className="mt-5 grid gap-2.5">
            {s.byMethod.length ? (
              s.byMethod.map(([m, v]) => (
                <div key={m} className="grid grid-cols-[92px_minmax(0,1fr)_88px] items-center gap-3 text-[13px]">
                  <span className="font-medium">{PAY_LABEL[m]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]">
                    <div className={cx("h-full rounded-full", GREEN)} style={{ width: `${(v / Math.max(1, s.byMethod[0][1])) * 100}%` }} />
                  </div>
                  <span className="text-right font-semibold tabular-nums">{compact(v)}</span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-ink-500">Marque os pagamentos como pagos na aba Vendas para ver a divisão por forma.</p>
            )}
          </div>
        </section>
      </div>

      {/* modelos, entregas, últimas */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <section className={cx(CARD, "p-5")}>
          <p className="text-[13px] font-bold tracking-[0.08em] uppercase">Modelos · 6 meses</p>
          {s.models.length ? (
            <ul className="mt-4 grid gap-3">
              {s.models.map(([m, x], i) => (
                <li key={m} className="flex items-center gap-3">
                  <span className="grid h-10 w-12 shrink-0 place-items-center rounded-xl bg-[#050706]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.photo} alt="" className="max-h-8 w-auto object-contain" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                      <span className="truncate font-semibold">{m}</span>
                      <span className="tabular-nums">
                        <b>{x.n}</b> <span className="text-ink-500">un.</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]">
                      <div className={cx("h-full rounded-full", i === 0 ? GREEN : "bg-[#1F9D55]/55 dark:bg-[#33A366]/55")} style={{ width: `${(x.n / s.models[0][1].n) * 100}%` }} />
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-500 tabular-nums">{compact(x.value)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13.5px] text-ink-500">Sem vendas nos últimos 6 meses.</p>
          )}
        </section>

        <section className={cx(CARD, "p-5")}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold tracking-[0.08em] uppercase">Falta entregar</p>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-bold text-amber-800 ring-1 ring-amber-200">{s.toDeliver.length}</span>
          </div>
          {s.toDeliver.length ? (
            <ul className="mt-3 grid gap-1">
              {s.toDeliver.slice(0, 5).map((r) => (
                <li key={r.doc.id}>
                  <Link href={clientHref(clientKey(r.d))} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-50 dark:hover:bg-white/[0.04]">
                    <Truck className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{r.d.client.name || "Cliente"}</span>
                      <span className="block text-[12px] text-ink-500">{model(r)}</span>
                    </span>
                    <span className="text-[12px] text-ink-500 tabular-nums">{r.d.delivery?.date ? dateBr(r.d.delivery.date).slice(0, 5) : "sem data"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-[13.5px] text-emerald-700 dark:text-emerald-400">
              <PackageCheck className="h-4 w-4" /> Todas as scooters entregues.
            </p>
          )}
        </section>

        <section className={cx(CARD, "p-5")}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold tracking-[0.08em] uppercase">Últimas vendas</p>
            <Link href="/mobilidade?aba=vendas" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {s.recent.length ? (
            <ul className="mt-3 grid gap-1">
              {s.recent.map((r) => (
                <li key={r.doc.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{r.d.client.name || "Cliente"}</span>
                    <span className="block text-[12px] text-ink-500">
                      {model(r)} · {dateBr(r.at).slice(0, 5)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[13.5px] font-bold tabular-nums">{brl0(r.r.final)}</span>
                    {r.r.profit != null && <span className="block text-[11.5px] font-semibold text-[#1A7F45] tabular-nums dark:text-[#5CC88A]">+{brl0(r.r.profit)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13.5px] text-ink-500">Nenhuma venda ainda. Toque em “Venda” para registrar a primeira.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ k, v, sub, warn, href }: { k: string; v: string; sub: string; warn?: boolean; href?: string }) {
  const body = (
    <>
      <p className="text-[12px] font-bold tracking-[0.1em] text-ink-500 uppercase">{k}</p>
      <p className="mt-1.5 text-[26px] leading-none font-extrabold tabular-nums">{v}</p>
      <p className={cx("mt-1.5 text-[12.5px]", warn ? "font-semibold text-rose-600" : "text-ink-500")}>{sub}</p>
    </>
  );
  return href ? (
    <Link href={href} className={cx(CARD, "block p-5 transition hover:ring-ink-300 dark:hover:ring-white/20")}>
      {body}
    </Link>
  ) : (
    <section className={cx(CARD, "p-5")}>{body}</section>
  );
}

/** Anel da margem do mês. */
function Ring({ value }: { value: number | null }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative grid h-[88px] w-[88px] shrink-0 place-items-center">
      <svg viewBox="0 0 88 88" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="9" className="stroke-ink-100 dark:stroke-white/[0.07]" />
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="stroke-[#1F9D55] transition-all dark:stroke-[#33A366]" />
      </svg>
      <span className="text-center leading-none">
        <span className="block text-[20px] font-extrabold tabular-nums">{value != null ? `${value}%` : "—"}</span>
        <span className="text-[10px] font-semibold text-ink-500 uppercase">margem</span>
      </span>
    </div>
  );
}

/** Linha do faturamento dos 6 meses, dentro do cartão de destaque. */
function Spark({ months }: { months: { key: string; label: string; final: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.final));
  const w = 300;
  const h = 64;
  const pts = months.map((m, i) => [(i / (months.length - 1)) * w, h - 6 - (m.final / max) * (h - 14)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <div className="relative mt-6">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible" role="img" aria-label={months.map((m) => `${m.label}: ${brl0(m.final)}`).join("; ")}>
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9FDB7C" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#9FDB7C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#spark-fill)" />
        <path d={line} fill="none" stroke="#C6F0A8" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#E4F04A" stroke="#0B1A12" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-white/50 uppercase">
        {months.map((m, i) => (
          <span key={m.key} className={cx(i === months.length - 1 && "text-white/90")}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras empilhadas: custos (cinza) + lucro (verde) = valor final de cada mês. */
function MonthsChart({ months }: { months: { key: string; label: string; full: string; final: number; cost: number; profit: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.final));
  const show = hover ?? months.length - 1;
  const m = months[show];
  return (
    <section className={cx(CARD, "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold tracking-[0.08em] uppercase">Valor final, custos e lucro</p>
          <p className="text-[12.5px] text-ink-500">Últimos 6 meses · toque numa barra</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-ink-600 dark:text-ink-300">
          <span className="inline-flex items-center gap-1.5">
            <span className={cx("h-2.5 w-2.5 rounded-sm", GREEN)} /> Lucro
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cx("h-2.5 w-2.5 rounded-sm", GRAY)} /> Custos
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-ink-50 p-3 text-center dark:bg-white/[0.04]">
        {[
          [`Valor final · ${m.full}`, brl0(m.final)],
          ["Custos", brl0(m.cost)],
          ["Lucro", brl0(m.profit)],
        ].map(([k, v], i) => (
          <div key={k}>
            <p className="truncate text-[11px] font-semibold text-ink-500 uppercase">{k}</p>
            <p className={cx("text-[15px] font-bold tabular-nums", i === 2 && "text-[#1A7F45] dark:text-[#5CC88A]")}>{v}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-5 flex h-[180px] items-end gap-3 border-b border-ink-200 sm:gap-5 dark:border-white/10" role="img" aria-label={months.map((x) => `${x.label}: valor final ${brl0(x.final)}, lucro ${brl0(x.profit)}`).join("; ")}>
        {[0.5, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-200/70 dark:border-white/[0.06]" style={{ bottom: `${g * 100}%` }} />
        ))}
        {months.map((x, i) => {
          const total = (x.final / max) * 100;
          const profitPart = x.final > 0 ? Math.max(0, Math.min(1, x.profit / x.final)) : 0;
          const rest = x.final - x.profit - x.cost;
          return (
            <button
              key={x.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
              aria-label={`${x.full}: valor final ${brl0(x.final)}, custos ${brl0(x.cost)}, lucro ${brl0(x.profit)}`}
              className="relative flex h-full flex-1 items-end justify-center"
            >
              <span className={cx("flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-t-[6px] transition-opacity", hover !== null && hover !== i && "opacity-40")} style={{ height: `${Math.max(total, x.final ? 2 : 0)}%` }}>
                {/* custos embaixo, lucro em cima; vendas sem custo cadastrado ficam em cinza claro */}
                <span className={GRAY} style={{ height: `${x.final > 0 ? (x.cost / x.final) * 100 : 0}%` }} />
                {rest > 0 && <span className="bg-[#E6EAE6] dark:bg-white/[0.08]" style={{ height: `${(rest / x.final) * 100}%` }} />}
                <span className={cx("border-b-2 border-white dark:border-[#0f1311]", GREEN)} style={{ height: `${profitPart * 100}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-5">
        {months.map((x, i) => (
          <span key={x.key} className={cx("flex-1 text-center text-[12px] text-ink-500", i === show && "font-bold text-ink-900 dark:text-white")}>
            {x.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Valor final, custos e lucro por mês</caption>
        <tbody>
          {months.map((x) => (
            <tr key={x.key}>
              <th>{x.full}</th>
              <td>{brl0(x.final)}</td>
              <td>{brl0(x.cost)}</td>
              <td>{brl0(x.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
