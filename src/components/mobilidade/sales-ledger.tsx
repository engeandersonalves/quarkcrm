"use client";

import { Banknote, Check, ChevronDown, CircleAlert, CreditCard, FileSignature, Loader2, PackageCheck, Plus, Receipt, Search, Trash2, Truck, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cx } from "@/components/ui";
import { dateBr } from "@/lib/br";
import { useLive } from "@/lib/live";
import { closedAt, saleStage, signaturePending } from "@/lib/moto-board";
import { clientHref, clientKey } from "@/lib/moto-clients";
import { saveSaleInfo } from "@/lib/moto-customers-db";
import { COST_FIELDS, PAY_METHODS, ledgerRow, paymentsFromContract, type CostBreakdown, type CostKey, type LedgerRow, type MotoPayment, type PayMethod } from "@/lib/moto-ledger";
import type { MotoProduct } from "@/lib/moto-products";
import { contractValue, motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";
import { relativeTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { ModelFix } from "./model-fix";
import { RegisterSale } from "./register-sale";
import { wa, type SaleDoc, type Sales } from "./sale-row";

/**
 * Vendas da Mobilidade: o controle direto ao ponto de cada scooter vendida —
 * cliente, moto, preço, custos, valor final, lucro, pagamento e entrega.
 */

const PANEL = "rounded-[22px] bg-white ring-1 ring-ink-200/80 dark:bg-[#0f1311] dark:ring-white/[0.07]";
const INPUT = "h-10 w-full rounded-xl bg-ink-50 px-3 text-[14px] ring-1 ring-ink-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.04] dark:ring-white/10";
const sale = (d: SaleDoc) => d.data as unknown as MotoData;
const model = (d: MotoData) => vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const parseMoney = (v: string) => Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
const money = (v: number | null | undefined) => (Number(v) ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());
const missing = (m: string) => /moto_payments|delivered_at|column .*cost/.test(m);

type Period = "mes" | "anterior" | "90" | "tudo";
type Filter = "todas" | "entregar" | "entregues" | "receber";

export function usePayments() {
  return useLive(
    async () => {
      const { data, error } = await supabase().from("moto_payments").select("*").order("position").order("created_at").limit(5000);
      if (error) return { list: [] as MotoPayment[], missing: missing(error.message) || /relation|does not exist/.test(error.message) };
      return { list: (data ?? []) as MotoPayment[], missing: false };
    },
    [],
    ["moto_payments"],
  );
}

/** Linhas do controle de vendas (uma por scooter vendida), usadas na aba Vendas e no Painel. */
export function useLedgerRows(sales: Sales, products: MotoProduct[], payments: ReturnType<typeof usePayments>) {
  return useMemo<Row[]>(() => {
    const byDoc = new Map<string, MotoPayment[]>();
    for (const p of payments.data?.list ?? []) (byDoc.get(p.document_id) ?? byDoc.set(p.document_id, []).get(p.document_id)!).push(p);
    return ((sales.data ?? []) as SaleDoc[])
      .filter((x) => saleStage(x) === "vendida")
      .map((doc) => {
        const d = sale(doc);
        const list = byDoc.get(doc.id) ?? [];
        const product = products.find((p) => p.slug === d.model) ?? null;
        return { doc, d, at: closedAt(doc).slice(0, 10), delivered: doc.info?.delivered_at ?? null, payments: list, r: ledgerRow(d, list, product, doc.info?.cost ?? null, (doc.info?.costs as CostBreakdown | null) ?? null) };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [sales.data, payments.data, products]);
}

export interface Row {
  doc: SaleDoc;
  d: MotoData;
  at: string;
  delivered: string | null;
  payments: MotoPayment[];
  r: LedgerRow;
}

export function SalesLedger({ sales, products }: { sales: Sales; products: MotoProduct[] }) {
  const payments = usePayments();
  const params = useSearchParams();
  const router = useRouter();
  const [registering, setRegistering] = useState(params.get("registrar") === "1");
  const [period, setPeriod] = useState<Period>("mes");
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useLedgerRows(sales, products, payments);

  const shown = useMemo(() => {
    const now = new Date();
    const ym = (dt: Date) => dt.toISOString().slice(0, 7);
    const cur = ym(now);
    const prev = ym(new Date(now.getFullYear(), now.getMonth() - 1, 15));
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const term = q.trim().toLowerCase();
    return rows.filter((x) => {
      if (period === "mes" && x.at.slice(0, 7) !== cur) return false;
      if (period === "anterior" && x.at.slice(0, 7) !== prev) return false;
      if (period === "90" && x.at < since) return false;
      if (filter === "entregar" && x.delivered) return false;
      if (filter === "entregues" && !x.delivered) return false;
      if (filter === "receber" && !(x.r.pay.open > 0 || x.r.estimated)) return false;
      if (term && !`${x.d.client.name} ${model(x.d)} ${x.d.color} ${x.d.chassis}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, period, filter, q]);

  const t = useMemo(() => {
    const withCost = shown.filter((x) => x.r.profit != null);
    return {
      count: shown.length,
      final: shown.reduce((s, x) => s + x.r.final, 0),
      cost: withCost.reduce((s, x) => s + x.r.cost.total, 0),
      profit: withCost.reduce((s, x) => s + (x.r.profit ?? 0), 0),
      finalWithCost: withCost.reduce((s, x) => s + x.r.final, 0),
      noCost: shown.length - withCost.length,
      open: shown.reduce((s, x) => s + (x.r.estimated ? x.r.final : x.r.pay.open), 0),
      toDeliver: shown.filter((x) => !x.delivered).length,
    };
  }, [shown]);

  if (payments.data?.missing)
    return <p className={cx(PANEL, "p-5 text-[14px] text-ink-600")}>Rode o arquivo supabase/schema.sql no Supabase (SQL Editor) para ativar o controle de vendas.</p>;

  const pending = ((sales.data ?? []) as SaleDoc[]).filter((x) => signaturePending(x));
  const closeRegister = () => {
    setRegistering(false);
    if (params.get("registrar")) router.replace("/mobilidade?aba=vendas", { scroll: false });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* ações */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRegistering(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-[14px] font-bold text-[#0A0D0B] shadow-[0_10px_30px_-14px_rgba(79,195,138,0.9)]">
          <Plus className="h-4 w-4" /> Registrar venda
        </button>
        <Link href="/documentos/novo?tipo=moto" className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 dark:ring-white/10">
          <FileSignature className="h-4 w-4" /> Gerar contrato para assinar
        </Link>
      </div>
      <RegisterSale
        open={registering}
        onClose={closeRegister}
        products={products}
        onSaved={(id) => {
          closeRegister();
          setPeriod("tudo");
          setFilter("todas");
          setOpen(id);
          void Promise.all([sales.reload(), payments.reload()]);
        }}
      />

      {/* contratos aguardando assinatura */}
      {pending.length > 0 && (
        <details className={cx(PANEL, "group px-4 py-3")}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] font-semibold [&::-webkit-details-marker]:hidden">
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-amber-100 px-1.5 text-[12px] font-bold text-amber-800">{pending.length}</span>
            {pending.length === 1 ? "venda com contrato aguardando assinatura" : "vendas com contrato aguardando assinatura"}
            <ChevronDown className="ml-auto h-4 w-4 text-ink-400 transition group-open:rotate-180" />
          </summary>
          <ul className="mt-3 grid gap-2">
            {pending.map((doc) => {
              const d = sale(doc);
              const token = (doc.signers?.find((s) => s.role === "comprador") as { token?: string } | undefined)?.token;
              const link = token && typeof window !== "undefined" ? `${window.location.origin}/assinar/${token}` : "";
              const chat = wa(d.client.phone, `Olá, ${(d.client.name || "").trim().split(/\s+/)[0]}! Seu contrato da scooter ${model(d)} está pronto para assinar pelo celular, leva 1 minuto${link ? `: ${link}` : "."}`);
              return (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5 dark:bg-white/[0.04]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{d.client.name || "Cliente"}</p>
                    <p className="text-[12px] text-ink-500">
                      {model(d)} · {brl0(contractValue(d))} · enviado {relativeTime(doc.updated_at)}
                    </p>
                  </div>
                  {chat && (
                    <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-[12.5px] font-semibold text-white">
                      Cobrar assinatura
                    </a>
                  )}
                  <Link href={`/documentos/${doc.id}`} className="inline-flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
                    Abrir
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* totais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi k="Vendas" v={String(t.count)} sub={`${t.toDeliver} falta${t.toDeliver === 1 ? "" : "m"} entregar`} />
        <Kpi k="Valor final" v={brl0(t.final)} sub="o que entra para a empresa" />
        <Kpi k="Custos" v={brl0(t.cost)} sub={t.noCost ? `${t.noCost} sem custo cadastrado` : "das vendas listadas"} warn={t.noCost > 0} />
        <Kpi k="Lucro" v={brl0(t.profit)} sub={t.finalWithCost > 0 ? `margem de ${Math.round((t.profit / t.finalWithCost) * 100)}%` : "cadastre os custos"} strong />
        <Kpi k="A receber" v={brl0(t.open)} sub="pagamentos em aberto" className="col-span-2 lg:col-span-1" />
      </div>

      {/* filtros */}
      <div className={cx(PANEL, "flex flex-wrap items-center gap-2 p-2.5")}>
        <Chips value={period} onChange={setPeriod} items={[["mes", "Este mês"], ["anterior", "Mês passado"], ["90", "90 dias"], ["tudo", "Tudo"]]} />
        <span className="mx-1 hidden h-6 w-px bg-ink-200 sm:block dark:bg-white/10" />
        <Chips value={filter} onChange={setFilter} items={[["todas", "Todas"], ["entregar", "Falta entregar"], ["entregues", "Entregues"], ["receber", "A receber"]]} />
        <label className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, moto ou chassi" className={cx(INPUT, "pl-9")} />
        </label>
      </div>

      {sales.loading && !sales.data ? (
        <div className={cx(PANEL, "grid place-items-center py-14")}>
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      ) : !shown.length ? (
        <p className={cx(PANEL, "p-6 text-center text-[14px] text-ink-500")}>{rows.length ? "Nenhuma venda neste filtro." : "Nenhuma scooter vendida ainda. A venda entra aqui quando o cliente assina o contrato."}</p>
      ) : (
        <>
          {/* tabela (computador) */}
          <div className={cx(PANEL, "hidden overflow-hidden lg:block")}>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[11px] font-bold tracking-[0.08em] text-ink-500 uppercase dark:border-white/[0.06]">
                  <th className="py-3 pl-4 font-bold">Cliente</th>
                  <th className="py-3 font-bold">Moto</th>
                  <th className="py-3 pr-3 text-right font-bold">Preço</th>
                  <th className="py-3 pr-3 text-right font-bold">Custos</th>
                  <th className="py-3 pr-3 text-right font-bold">Valor final</th>
                  <th className="py-3 pr-3 text-right font-bold">Lucro</th>
                  <th className="py-3 font-bold">Pagamento</th>
                  <th className="py-3 font-bold">Entrega</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => {
                  const on = open === x.doc.id;
                  return (
                    <Fragment key={x.doc.id}>
                      <tr onClick={() => setOpen(on ? null : x.doc.id)} className={cx("cursor-pointer border-b border-ink-100 transition hover:bg-ink-50/70 dark:border-white/[0.05] dark:hover:bg-white/[0.03]", on && "bg-ink-50/70 dark:bg-white/[0.03]")}>
                        <td className="py-3 pl-4">
                          <p className="max-w-[200px] truncate font-semibold">{x.d.client.name || "Cliente"}</p>
                          <p className="text-[12px] text-ink-500">
                            {dateBr(x.at)}
                            {x.doc.status === "registrada" && <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-px text-[10.5px] font-semibold text-sky-800 dark:bg-sky-500/10">registrada</span>}
                            {signaturePending(x.doc) && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-px text-[10.5px] font-semibold text-amber-800 dark:bg-amber-500/10">falta assinar</span>}
                          </p>
                        </td>
                        <td className="py-3">
                          <p className="font-medium">{model(x.d)}</p>
                          <p className="text-[12px] text-ink-500">{x.d.color || "—"}</p>
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">{brl0(x.r.price)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums" title={x.r.cost.parts.map((p) => `${p.label}: ${brl(p.v)}`).join("\n")}>{x.r.cost.source ? brl0(x.r.cost.total) : <span className="text-amber-600">sem custo</span>}</td>
                        <td className="py-3 pr-3 text-right font-semibold tabular-nums">
                          {brl0(x.r.final)}
                          {x.r.estimated && <span className="block text-[11px] font-normal text-ink-400">estimado</span>}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          <ProfitCell r={x.r} />
                        </td>
                        <td className="py-3">
                          <PayChip r={x.r} />
                        </td>
                        <td className="py-3">
                          <DeliveryChip delivered={x.delivered} planned={x.d.delivery?.date} />
                        </td>
                        <td className="pr-3">
                          <ChevronDown className={cx("h-4 w-4 text-ink-400 transition", on && "rotate-180")} />
                        </td>
                      </tr>
                      {on && (
                        <tr className="border-b border-ink-100 dark:border-white/[0.05]">
                          <td colSpan={9} className="bg-ink-50/50 p-4 dark:bg-white/[0.02]">
                            <SaleDetail x={x} products={products} reload={() => void Promise.all([payments.reload(), sales.reload()])} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-[13px] font-bold">
                  <td className="py-3 pl-4" colSpan={2}>
                    Total · {t.count} {t.count === 1 ? "venda" : "vendas"}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{brl0(shown.reduce((s, x) => s + x.r.price, 0))}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{brl0(t.cost)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{brl0(t.final)}</td>
                  <td className="py-3 pr-3 text-right text-emerald-700 tabular-nums dark:text-emerald-400">{brl0(t.profit)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* cartões (celular) */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:hidden">
            {shown.map((x) => {
              const on = open === x.doc.id;
              return (
                <article key={x.doc.id} className={PANEL}>
                  <button type="button" onClick={() => setOpen(on ? null : x.doc.id)} className="block w-full p-4 text-left">
                    <div className="flex items-start gap-3">
                      <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-[#050706]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={motoPhoto(x.d)} alt="" className="max-h-10 w-auto object-contain" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{x.d.client.name || "Cliente"}</p>
                        <p className="text-[12.5px] text-ink-500">
                          {model(x.d)}
                          {x.d.color ? ` · ${x.d.color}` : ""} · {dateBr(x.at)}
                        </p>
                      </div>
                      <DeliveryChip delivered={x.delivered} planned={x.d.delivery?.date} />
                    </div>
                    <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                      {[
                        ["Preço", brl0(x.r.price)],
                        ["Custos", x.r.cost.source ? brl0(x.r.cost.total) : "—"],
                        ["Final", brl0(x.r.final)],
                        ["Lucro", x.r.profit != null ? brl0(x.r.profit) : "—"],
                      ].map(([k, v], i) => (
                        <div key={k} className={cx("rounded-xl px-1 py-2", i === 3 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-ink-50 dark:bg-white/[0.04]")}>
                          <dt className="text-[10.5px] font-semibold text-ink-500 uppercase">{k}</dt>
                          <dd className={cx("mt-0.5 text-[13px] font-bold tabular-nums", i === 3 && "text-emerald-700 dark:text-emerald-300")}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <PayChip r={x.r} />
                      <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-500">
                        {on ? "Fechar" : "Detalhes"} <ChevronDown className={cx("h-4 w-4 transition", on && "rotate-180")} />
                      </span>
                    </div>
                  </button>
                  {on && (
                    <div className="border-t border-ink-100 p-4 dark:border-white/[0.06]">
                      <SaleDetail x={x} products={products} reload={() => void Promise.all([payments.reload(), sales.reload()])} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ k, v, sub, strong, warn, className }: { k: string; v: string; sub: string; strong?: boolean; warn?: boolean; className?: string }) {
  return (
    <div className={cx(PANEL, "p-4", strong && "ring-emerald-300 dark:ring-emerald-500/40", className)}>
      <p className="text-[11.5px] font-bold tracking-[0.08em] text-ink-500 uppercase">{k}</p>
      <p className={cx("mt-1 text-[22px] leading-tight font-bold tabular-nums", strong && "text-emerald-700 dark:text-emerald-300")}>{v}</p>
      <p className={cx("mt-0.5 text-[12px]", warn ? "text-amber-600" : "text-ink-500")}>{sub}</p>
    </div>
  );
}

function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap">
      {items.map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)} className={cx("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition", value === id ? "bg-[#0B1A12] text-white dark:bg-white dark:text-[#0B1A12]" : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/[0.06]")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ProfitCell({ r }: { r: LedgerRow }) {
  if (r.profit == null) return <span className="text-ink-400">—</span>;
  return (
    <span className={cx("font-bold", r.profit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600")}>
      {brl0(r.profit)}
      {r.margin != null && <span className="block text-[11px] font-medium text-ink-500">{r.margin}%</span>}
    </span>
  );
}

function PayChip({ r }: { r: LedgerRow }) {
  const p = r.pay;
  const cls =
    p.status === "pago"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : p.overdue
        ? "bg-rose-50 text-rose-800 ring-rose-200"
        : p.status === "sem"
          ? "bg-ink-100 text-ink-600 ring-ink-200"
          : "bg-amber-50 text-amber-800 ring-amber-200";
  const label = p.status === "pago" ? "Pago" : p.overdue ? (p.status === "parcial" ? `Atrasado · falta ${brl0(p.open)}` : "Atrasado") : p.status === "parcial" ? `Falta ${brl0(p.open)}` : p.status === "pendente" ? "A receber" : "Lançar";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ring-1", cls)}>
      {p.status === "pago" ? <Check className="h-3.5 w-3.5" /> : p.overdue ? <CircleAlert className="h-3.5 w-3.5" /> : null}
      {p.method !== "—" ? `${p.method} · ` : ""}
      {label}
    </span>
  );
}

function DeliveryChip({ delivered, planned }: { delivered: string | null; planned?: string }) {
  return delivered ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-emerald-800 ring-1 ring-emerald-200">
      <PackageCheck className="h-3.5 w-3.5" /> Entregue {dateBr(delivered).slice(0, 5)}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-amber-800 ring-1 ring-amber-200">
      <Truck className="h-3.5 w-3.5" /> Falta entregar{planned ? ` · ${dateBr(planned).slice(0, 5)}` : ""}
    </span>
  );
}

/* ------------------------------------------------------------ detalhe */

function SaleDetail({ x, products, reload }: { x: Row; products: MotoProduct[]; reload: () => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Payments x={x} reload={reload} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Costs x={x} reload={reload} />
        <div className="grid content-start gap-4">
          <Delivery x={x} reload={reload} />
          <ModelFix doc={x.doc} products={products} onSaved={reload} />
        </div>
      </div>
    </div>
  );
}

function Box({ title, icon, children, right }: { title: string; icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="@container rounded-2xl bg-white p-4 ring-1 ring-ink-200/80 dark:bg-[#121614] dark:ring-white/[0.07]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] uppercase">
          <span className="text-emerald-600">{icon}</span> {title}
        </p>
        {right}
      </div>
      {children}
    </section>
  );
}

function Payments({ x, reload }: { x: Row; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const p = x.r.pay;

  const add = async (method: PayMethod) => {
    setBusy("add");
    try {
      const rest = Math.max(0, (x.r.estimated ? x.r.price : x.r.price - p.total) || 0);
      const { error } = await supabase()
        .from("moto_payments")
        .insert({ document_id: x.doc.id, method, amount: Math.round(rest * 100) / 100, installments: method === "cartao" ? x.d.payment.installments || 1 : null, date: today(), paid: false, position: x.payments.length });
      if (error) throw new Error(error.message);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setBusy(null);
    }
  };
  const fromContract = async () => {
    setBusy("contrato");
    try {
      const { error } = await supabase().from("moto_payments").insert(paymentsFromContract(x.d).map((l) => ({ ...l, document_id: x.doc.id })));
      if (error) throw new Error(error.message);
      toast.success("Pagamentos lançados pelo contrato. Confira datas e marque o que já foi pago.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível lançar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box
      title="Pagamento"
      icon={<Banknote className="h-4 w-4" />}
      right={
        p.status !== "sem" && (
          <span className="text-[12.5px] text-ink-500">
            Recebido <b className="text-ink-900 tabular-nums dark:text-white">{brl(p.received)}</b> de {brl(p.net)}
          </span>
        )
      }
    >
      {x.payments.length ? (
        <div className="grid gap-2">
          <div className="hidden grid-cols-[130px_minmax(110px,1fr)_70px_150px_90px_100px_32px] gap-2 px-1 text-[11px] font-bold tracking-[0.06em] text-ink-500 uppercase @3xl:grid">
            <span>Forma</span>
            <span>Valor</span>
            <span>Parc.</span>
            <span>Data</span>
            <span>Taxa</span>
            <span>Situação</span>
            <span />
          </div>
          {x.payments.map((pay) => (
            <PaymentLine key={`${pay.id}-${pay.amount}-${pay.paid}-${pay.date}`} p={pay} reload={reload} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-ink-50 p-3.5 text-[13.5px] text-ink-600 dark:bg-white/[0.04] dark:text-ink-300">
          Nenhum pagamento lançado. No contrato ficou: <b className="text-ink-900 dark:text-white">{contractPayText(x.d)}</b>.
          <button type="button" disabled={!!busy} onClick={fromContract} className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1A12] text-[13.5px] font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-4 dark:bg-white dark:text-[#0B1A12]">
            {busy === "contrato" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Lançar como no contrato
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(
          [
            ["pix", "PIX / à vista"],
            ["cartao", "Cartão"],
            ["boleto", "Boleto"],
            ["dinheiro", "Dinheiro"],
          ] as [PayMethod, string][]
        ).map(([m, label]) => (
          <button key={m} type="button" disabled={!!busy} onClick={() => add(m)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 disabled:opacity-60 dark:ring-white/10">
            <Plus className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {p.status !== "sem" && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
          {[
            ["Total lançado", brl(p.total)],
            ["Taxas", p.fees ? `− ${brl(p.fees)}` : "—"],
            ["Valor final", brl(p.net)],
            ["Falta receber", brl(p.open)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink-50 px-3 py-2 dark:bg-white/[0.04]">
              <dt className="text-ink-500">{k}</dt>
              <dd className="font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.status !== "sem" && Math.abs(p.total - x.r.price) > 1 && x.d.payment.method !== "cartao" && (
        <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-300">
          O total lançado ({brl(p.total)}) é diferente do preço do contrato ({brl(x.r.price)}).
        </p>
      )}
    </Box>
  );
}

function contractPayText(d: MotoData) {
  const p = d.payment;
  if (p.method === "cartao") return `${p.installments}x de ${brl(p.installmentValue)} no cartão`;
  if (p.method === "entrada") return `entrada de ${brl(p.entry)} + saldo ${p.balanceWhen || ""}`.trim();
  if (p.method === "pix") return "à vista no PIX";
  return p.custom || "condição combinada";
}

function PaymentLine({ p, reload }: { p: MotoPayment; reload: () => void }) {
  const [f, setF] = useState({ method: p.method, amount: money(p.amount), installments: p.installments ? String(p.installments) : "", date: p.date ?? "", fee: money(p.fee), paid: p.paid });
  const [busy, setBusy] = useState(false);
  const save = async (patch: Partial<MotoPayment>, ok?: string) => {
    setBusy(true);
    try {
      const { error } = await supabase().from("moto_payments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw new Error(error.message);
      if (ok) toast.success(ok);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm("Remover este pagamento?")) return;
    const { error } = await supabase().from("moto_payments").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else reload();
  };
  const overdue = !f.paid && f.date && f.date < today();

  return (
    <div className="relative grid grid-cols-2 items-center gap-2 rounded-xl bg-ink-50/70 p-2 pt-11 @3xl:grid-cols-[130px_minmax(110px,1fr)_70px_150px_90px_100px_32px] @3xl:bg-transparent @3xl:p-0 @3xl:pt-0 dark:bg-white/[0.03] @3xl:dark:bg-transparent">
      <select
        value={f.method}
        disabled={busy}
        onChange={(e) => {
          const method = e.target.value as PayMethod;
          setF({ ...f, method });
          void save({ method, installments: method === "cartao" ? Number(f.installments) || 1 : null });
        }}
        className={cx(INPUT, "absolute top-1.5 left-2 w-[calc(100%-3.5rem)] @3xl:static @3xl:w-full")}
        aria-label="Forma de pagamento"
      >
        {PAY_METHODS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} onBlur={() => parseMoney(f.amount) !== Number(p.amount) && save({ amount: parseMoney(f.amount) })} placeholder="Valor" className={cx(INPUT, "tabular-nums")} aria-label="Valor" />
      <input inputMode="numeric" value={f.installments} disabled={f.method !== "cartao"} onChange={(e) => setF({ ...f, installments: e.target.value.replace(/\D/g, "").slice(0, 2) })} onBlur={() => f.method === "cartao" && Number(f.installments) !== Number(p.installments) && save({ installments: Number(f.installments) || 1 })} placeholder={f.method === "cartao" ? "1x" : "—"} className={cx(INPUT, "disabled:opacity-40")} aria-label="Parcelas" />
      <input type="date" value={f.date} onChange={(e) => { setF({ ...f, date: e.target.value }); void save({ date: e.target.value || null }); }} className={cx(INPUT, overdue && "ring-rose-300 dark:ring-rose-500/40")} aria-label="Data" />
      <input inputMode="decimal" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} onBlur={() => parseMoney(f.fee) !== Number(p.fee) && save({ fee: parseMoney(f.fee) })} placeholder="Taxa" className={cx(INPUT, "tabular-nums")} aria-label="Taxa" />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const paid = !f.paid;
          setF({ ...f, paid, date: paid && !f.date ? today() : f.date });
          void save({ paid, ...(paid && !f.date ? { date: today() } : {}) }, paid ? "Marcado como pago" : undefined);
        }}
        className={cx("col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold ring-1 @3xl:col-span-1", f.paid ? "bg-emerald-600 text-white ring-emerald-600" : overdue ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-white text-ink-700 ring-ink-200 dark:bg-white/[0.04] dark:text-ink-200 dark:ring-white/10")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : f.paid ? <Check className="h-4 w-4" /> : null}
        {f.paid ? "Pago" : overdue ? "Atrasado" : "Pendente"}
      </button>
      <button type="button" onClick={remove} aria-label="Remover pagamento" className="absolute top-1 right-1 grid h-9 w-9 place-items-center rounded-xl text-ink-400 hover:text-rose-600 @3xl:static @3xl:h-10 @3xl:w-8">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Costs({ x, reload }: { x: Row; reload: () => void }) {
  const c = x.r.cost;
  const saved = (x.doc.info?.costs ?? {}) as CostBreakdown;
  const byKey = new Map(c.parts.map((p) => [p.k, p]));
  // Valor exibido: o informado na venda ou o que veio do modelo (cinza, editável).
  const [f, setF] = useState<Record<CostKey, string>>(() => Object.fromEntries(COST_FIELDS.map((k) => [k.k, saved[k.k] != null ? money(saved[k.k] as number) : ""])) as Record<CostKey, string>);
  const [busy, setBusy] = useState(false);
  const dirty = COST_FIELDS.some((k) => (f[k.k] === "" ? null : parseMoney(f[k.k])) !== (saved[k.k] ?? null));
  const legacy = c.parts.length === 1 && c.parts[0].label === "Custo informado";

  const save = async (next: CostBreakdown | null) => {
    setBusy(true);
    try {
      await saveSaleInfo(x.doc.id, { costs: next, ...(next ? { cost: null } : {}) });
      toast.success(next ? "Custos da venda salvos" : "Custos voltaram ao cadastro do modelo");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? (/costs/.test(e.message) ? "Rode o schema.sql no Supabase para salvar os custos detalhados." : e.message) : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const next: CostBreakdown = {};
    for (const k of COST_FIELDS) if (f[k.k].trim() !== "") next[k.k] = parseMoney(f[k.k]);
    void save(Object.keys(next).length ? next : null);
  };

  return (
    <Box title="Custos" icon={<Receipt className="h-4 w-4" />} right={<b className="text-[14px] tabular-nums">{c.source ? brl(c.total) : "—"}</b>}>
      {legacy && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Esta venda tem um custo único de {brl(c.total)}. Discrimine abaixo para substituir.</p>}
      <div className="grid gap-1.5">
        {COST_FIELDS.map((k) => {
          const part = byKey.get(k.k);
          const fromModel = !legacy && part?.from === "modelo";
          return (
            <label key={k.k} className="grid grid-cols-[minmax(0,1fr)_118px] items-center gap-2">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{k.label}</span>
                <span className="block truncate text-[11px] text-ink-400">{fromModel ? "do cadastro do modelo" : k.hint}</span>
              </span>
              <input
                inputMode="decimal"
                value={f[k.k]}
                onChange={(e) => setF({ ...f, [k.k]: e.target.value })}
                onBlur={() => f[k.k].trim() && setF({ ...f, [k.k]: money(parseMoney(f[k.k])) || "0,00" })}
                placeholder={fromModel && part ? money(part.v) : "0,00"}
                className={cx(INPUT, "h-9 text-right tabular-nums placeholder:text-ink-400")}
                aria-label={k.label}
              />
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !dirty} onClick={submit} className="h-9 rounded-xl bg-[#0B1A12] px-4 text-[13px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-[#0B1A12]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar custos"}
        </button>
        {(Object.values(saved).some((v) => v != null) || legacy) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setF(Object.fromEntries(COST_FIELDS.map((k) => [k.k, ""])) as Record<CostKey, string>);
              void (async () => {
                setBusy(true);
                try {
                  await saveSaleInfo(x.doc.id, { costs: null, cost: null });
                  toast.success("Custos voltaram ao cadastro do modelo");
                  reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 hover:text-ink-800"
          >
            <X className="h-3.5 w-3.5" /> Usar o cadastro do modelo
          </button>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-400">Campo vazio usa o custo do modelo (em cinza). Lucro = valor final − custos. Taxas de cartão e boleto ficam nos pagamentos.</p>
    </Box>
  );
}

function Delivery({ x, reload }: { x: Row; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const set = async (delivered_at: string | null) => {
    setBusy(true);
    try {
      await saveSaleInfo(x.doc.id, { delivered_at, ...(delivered_at ? { delivery_date: delivered_at } : {}) });
      toast.success(delivered_at ? "Scooter marcada como entregue" : "Entrega desfeita");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box title="Entrega" icon={<Truck className="h-4 w-4" />} right={<DeliveryChip delivered={x.delivered} planned={x.d.delivery?.date} />}>
      <p className="text-[13px] text-ink-500">
        {x.d.delivery?.mode === "entrega" ? "Entrega em casa" : "Retirada na loja"}
        {x.d.delivery?.date ? ` · combinada para ${dateBr(x.d.delivery.date)}` : ""}
      </p>
      {x.delivered ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="date" defaultValue={x.delivered} onChange={(e) => e.target.value && set(e.target.value)} className={cx(INPUT, "w-auto")} aria-label="Data da entrega" />
          <button type="button" disabled={busy} onClick={() => set(null)} className="h-10 rounded-xl px-3 text-[13px] font-semibold text-ink-500 ring-1 ring-ink-200 dark:ring-white/10">
            Desfazer
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => set(today())} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[13.5px] font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Marcar como entregue hoje
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
        <Link href={clientHref(clientKey(x.d))} className="text-emerald-700 hover:underline dark:text-emerald-400">
          Ficha do cliente
        </Link>
        <Link href={`/documentos/${x.doc.id}`} className="inline-flex items-center gap-1 text-ink-600 hover:underline dark:text-ink-300">
          <FileSignature className="h-3.5 w-3.5" /> {x.doc.status === "registrada" && !(x.doc.signers ?? []).length ? "Gerar contrato para assinar" : "Contrato"}
        </Link>
        <span className="inline-flex items-center gap-1 text-ink-400">
          <CreditCard className="h-3.5 w-3.5" /> {contractPayText(x.d)}
        </span>
      </div>
    </Box>
  );
}
