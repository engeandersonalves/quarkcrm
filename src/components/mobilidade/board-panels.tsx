"use client";

import { Camera, ChevronDown, ChevronRight, Clock3, FileSignature, Hash, MessageCircle, PencilLine, Search, ShieldAlert, ShieldCheck, Trash2, Truck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Empty, Skeleton, cx } from "@/components/ui";
import { GlyphTile } from "@/components/app/ios-glyphs";
import { brlPlain, dateBr, digits } from "@/lib/br";
import { saleStage, todos, warrantyOf, type SaleStage, type TodoKind } from "@/lib/moto-board";
import { clientHref, clientKey } from "@/lib/moto-clients";
import { installmentValue, profitOf, unitCost, type MotoProduct } from "@/lib/moto-products";
import { motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";
import type { DocumentRow } from "@/lib/types";
import { SaleRow, brl0, wa, type SaleActions, type Sales } from "./sale-row";

const sale = (d: DocumentRow) => d.data as unknown as MotoData;
const first = (n: string) => n.trim().split(/\s+/)[0] || "cliente";
const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));

/** Lucro estimado de uma venda, usando os custos do modelo cadastrado. */
export function saleProfit(s: MotoData, products: MotoProduct[]) {
  const p = products.find((x) => x.slug === s.model);
  if (!p || !(unitCost(p.costs) > 0)) return null;
  const qty = Math.max(1, Number(s.qty) || 1);
  const unitPrice = (Number(s.price) || 0) - (Number(s.discount) || 0) / qty;
  return profitOf({ price: unitPrice, costs: p.costs }).profit * qty;
}

export function SectionTitle({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <p className="text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">
        {title}
        {count != null && <span className="ml-1.5 text-ink-400">{count}</span>}
      </p>
      {children}
    </div>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div className="rounded-[28px] ring-1 ring-ink-200 dark:ring-white/[0.08]">{children}</div>;
}

function SearchBox({ q, setQ, placeholder }: { q: string; setQ: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" />
      <span className="sr-only">Buscar</span>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-12 w-full rounded-full bg-white pr-10 pl-11 text-[15px] ring-1 ring-ink-200 outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] dark:ring-white/[0.1]" />
      {q && (
        <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="absolute top-1/2 right-3 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}

export function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string, number?][] }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {items.map(([v, l, n]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cx(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold ring-1 transition",
            value === v ? "bg-[#0A0D0B] text-[#fff] ring-[#0A0D0B] dark:bg-[#fff] dark:text-[#0A0D0B] dark:ring-[#fff]" : "text-ink-600 ring-ink-200 hover:ring-ink-300 dark:ring-white/[0.12]",
          )}
        >
          {l}
          {n != null && <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", value === v ? "bg-white/15 dark:bg-black/10" : "bg-ink-100 dark:bg-white/10")}>{n}</span>}
        </button>
      ))}
    </div>
  );
}

function matchSale(doc: DocumentRow, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const d = sale(doc);
  const hay = `${d.client.name} ${d.client.city} ${d.modelName} ${d.color} ${d.chassis}`.toLowerCase();
  if (hay.includes(t)) return true;
  const n = digits(t);
  return n.length >= 3 && (digits(d.client.doc).includes(n) || digits(d.client.phone).includes(n));
}

/* =================================================================== Início */

const TODO: Record<TodoKind, { icon: ReactNode; tone: string; text: (d: MotoData, doc: DocumentRow) => string; action: string }> = {
  assinatura: { icon: <FileSignature className="h-[18px] w-[18px]" />, tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", text: (d, doc) => `${first(d.client.name)} ainda não assinou o contrato (${daysSince(doc.updated_at)} ${daysSince(doc.updated_at) === 1 ? "dia" : "dias"})`, action: "Cobrar" },
  entrega: { icon: <Truck className="h-[18px] w-[18px]" />, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", text: (d) => `Definir a data de entrega da scooter de ${first(d.client.name)}`, action: "Definir" },
  chassi: { icon: <Hash className="h-[18px] w-[18px]" />, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", text: (d) => `Informar o chassi da scooter de ${first(d.client.name)}`, action: "Informar" },
  selfie: { icon: <Camera className="h-[18px] w-[18px]" />, tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", text: (d) => `${first(d.client.name)} assinou, mas ainda não enviou a selfie`, action: "Abrir" },
  vencendo: { icon: <ShieldAlert className="h-[18px] w-[18px]" />, tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", text: (d) => `A garantia de ${first(d.client.name)} termina em ${warrantyOf(d).left} dias`, action: "Avisar" },
  parado: { icon: <Clock3 className="h-[18px] w-[18px]" />, tone: "bg-ink-100 text-ink-600 dark:bg-white/[0.08] dark:text-white/70", text: (d, doc) => `Orçamento de ${first(d.client.name)} parado há ${daysSince(doc.updated_at)} dias`, action: "Retomar" },
};

function todoLink(kind: TodoKind, doc: DocumentRow) {
  const d = sale(doc);
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "scooter";
  const token = (doc.signers ?? []).find((s) => s.role === "comprador")?.token;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (kind === "assinatura") return wa(d.client.phone, `Olá, ${first(d.client.name)}! Seu contrato da scooter ${model} está pronto para assinar pelo celular${token ? `: ${origin}/assinar/${token}` : "."}`);
  if (kind === "vencendo") return wa(d.client.phone, `Olá, ${first(d.client.name)}! Passando para lembrar que a garantia da sua ${model} termina em ${warrantyOf(d).left} dias. Está tudo certo com ela?`);
  if (kind === "parado") return wa(d.client.phone, `Olá, ${first(d.client.name)}! Tudo bem? Ainda pensando na scooter ${model}? Posso te ajudar com alguma dúvida?`);
  return null;
}

export function OverviewPanel({ sales, products }: { sales: Sales; products: MotoProduct[] }) {
  const all = sales.data ?? [];
  const list = useMemo(() => todos(all), [all]);
  const [more, setMore] = useState(false);
  const active = products.filter((p) => p.active && p.price > 0);
  const shown = more ? list : list.slice(0, 6);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {/* começar uma venda */}
      {active.length > 0 && (
        <section>
          <SectionTitle title="Começar uma venda" />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
            {active.map((p) => (
              <Link key={p.slug} href={`/documentos/novo?tipo=moto&modelo=${p.slug}`} className="group flex w-[250px] shrink-0 items-center gap-3 rounded-[22px] bg-[#050706] p-3 text-white ring-1 ring-white/[0.07] transition hover:ring-[#6FBF8E]/50">
                <span className="grid h-16 w-20 shrink-0 place-items-center rounded-[16px]" style={{ background: `radial-gradient(closest-side, ${p.accent}40, transparent)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo || "/mob/cmp-scooter.webp"} alt="" className="max-h-16 w-auto object-contain transition group-hover:scale-105" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] leading-tight font-bold">{p.name}</span>
                  <span className="block text-[12.5px] text-white/60">{brl0(p.price)} à vista</span>
                  <span className="block text-[11.5px] text-white/40">
                    {p.installments}x {brlPlain(installmentValue(p.price, p.installments, p.rate))}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* a fazer */}
      <section>
        <SectionTitle title="A fazer" count={list.length} />
        {sales.loading && !sales.data ? (
          <Skeleton className="h-40" />
        ) : list.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[22px] bg-emerald-50 p-5 text-[14.5px] text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
            <ShieldCheck className="h-5 w-5 shrink-0" /> Tudo em dia: nenhum contrato parado, entrega sem data ou garantia vencendo.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-ink-200/80 dark:bg-[#111513] dark:ring-white/[0.07]">
            {shown.map((t, i) => {
              const d = sale(t.doc as DocumentRow);
              const cfg = TODO[t.kind];
              const link = todoLink(t.kind, t.doc as DocumentRow);
              return (
                <div key={`${t.kind}-${t.doc.id}`} className={cx("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-ink-200/60 dark:border-white/[0.06]")}>
                  <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", cfg.tone)}>{cfg.icon}</span>
                  <Link href={clientHref(clientKey(d))} className="min-w-0 flex-1">
                    <span className="block text-[14.5px] leading-snug font-medium">{cfg.text(d, t.doc as DocumentRow)}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">{[vehicleName(d).replace(/^Scooter elétrica\s*/, ""), d.color].filter(Boolean).join(" · ")}</span>
                  </Link>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 dark:ring-white/[0.12]">
                      <MessageCircle className="h-4 w-4 text-emerald-600" /> {cfg.action}
                    </a>
                  ) : (
                    <Link href={`/documentos/${t.doc.id}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 dark:ring-white/[0.12]">
                      <PencilLine className="h-4 w-4" /> {cfg.action}
                    </Link>
                  )}
                </div>
              );
            })}
            {list.length > 6 && (
              <button type="button" onClick={() => setMore((v) => !v)} className="flex w-full items-center justify-center gap-1.5 border-t border-ink-200/60 py-3 text-[13.5px] font-semibold text-ink-600 hover:bg-ink-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04]">
                {more ? "Mostrar menos" : `Ver mais ${list.length - 6}`} <ChevronDown className={cx("h-4 w-4 transition", more && "rotate-180")} />
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* =================================================================== Vendas */

type SalesFilter = "todas" | SaleStage;

export function SalesPanel({ sales, products, actions }: { sales: Sales; products: MotoProduct[]; actions: SaleActions }) {
  const all = sales.data ?? [];
  const [q, setQ] = useState("");
  const [f, setF] = useState<SalesFilter>("todas");
  const by = (s: SaleStage) => all.filter((d) => saleStage(d) === s && matchSale(d, q));
  const groups: { id: SaleStage; title: string; rows: DocumentRow[] }[] = [
    { id: "aguardando", title: "Aguardando assinatura", rows: by("aguardando") },
    { id: "orcamento", title: "Orçamentos", rows: by("orcamento") },
    { id: "vendida", title: "Vendidas", rows: by("vendida") },
  ];
  const count = (s: SaleStage) => all.filter((d) => saleStage(d) === s).length;
  const shown = groups.filter((g) => (f === "todas" || g.id === f) && g.rows.length);
  const old = all.filter((d) => saleStage(d) === "orcamento" && daysSince(d.updated_at) > 30);

  if (sales.error) return <div className="rounded-[22px] bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200">Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar as vendas de scooter.</div>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <SearchBox q={q} setQ={setQ} placeholder="Buscar por cliente, CPF, telefone, modelo ou chassi" />
      <Chips<SalesFilter>
        value={f}
        onChange={setF}
        items={[
          ["todas", "Todas", all.length],
          ["aguardando", "Aguardando assinatura", count("aguardando")],
          ["orcamento", "Orçamentos", count("orcamento")],
          ["vendida", "Vendidas", count("vendida")],
        ]}
      />
      {sales.loading && !sales.data ? (
        <Skeleton className="h-64" />
      ) : shown.length === 0 ? (
        <Box>
          <Empty icon={<GlyphTile id="scooter" size="lg" />} title={all.length ? "Nada encontrado" : "Nenhuma venda ainda"} text="Comece pela aba Início escolhendo a scooter: o orçamento sai em PDF e o contrato vai por link para assinar." />
        </Box>
      ) : (
        shown.map((g) => (
          <section key={g.id}>
            <SectionTitle title={g.title} count={g.rows.length}>
              {g.id === "orcamento" && old.length > 0 && !q && (
                <button type="button" onClick={() => actions.removeMany(old as DocumentRow[])} disabled={!!actions.busy} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-600 hover:underline disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Apagar {old.length} com mais de 30 dias
                </button>
              )}
            </SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {g.rows.map((d) => (
                <SaleRow key={d.id} doc={d} actions={actions} profit={g.id === "vendida" ? saleProfit(sale(d), products) : null} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/* ================================================================ Garantias */

export function WarrantyPanel({ sales, actions }: { sales: Sales; actions: SaleActions }) {
  const all = (sales.data ?? []).filter((d) => saleStage(d) === "vendida");
  const [q, setQ] = useState("");
  const [showEnded, setShowEnded] = useState(false);
  const rows = all.filter((d) => matchSale(d, q)).map((doc) => ({ doc, w: warrantyOf(sale(doc)) }));
  const ativas = rows.filter((r) => r.w.state === "ativa").sort((a, b) => a.w.left - b.w.left);
  const entrega = rows.filter((r) => r.w.state === "entrega");
  const encerradas = rows.filter((r) => r.w.state === "encerrada").sort((a, b) => b.w.end.localeCompare(a.w.end));

  const Row = ({ doc, w }: (typeof rows)[number]) => {
    const d = sale(doc);
    const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
    const chat = wa(d.client.phone);
    const tone = w.state === "encerrada" ? "bg-ink-300" : w.left <= 15 && w.state === "ativa" ? "bg-rose-500" : "bg-emerald-500";
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-ink-200/80 sm:flex-nowrap dark:bg-[#111513] dark:ring-white/[0.07]">
        <Link href={clientHref(clientKey(d))} className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
          <span className="grid h-14 w-16 shrink-0 place-items-center rounded-[14px] bg-[#050706]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={motoPhoto(d)} alt="" className="max-h-12 w-auto object-contain" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{d.client.name}</span>
            <span className="block truncate text-[13px] text-ink-500">
              {model}
              {d.color ? ` · ${d.color}` : ""}
              {d.chassis ? ` · chassi ${d.chassis}` : " · sem chassi"}
            </span>
            <span className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-500">
              <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                <span className={cx("block h-full rounded-full", tone)} style={{ width: `${w.state === "encerrada" ? 100 : Math.max(4, w.remaining * 100)}%` }} />
              </span>
              <span className="truncate">{w.state === "ativa" ? `${w.left} dias · até ${dateBr(w.end)}` : w.state === "entrega" ? (d.delivery?.date ? `começa na entrega, ${dateBr(d.delivery.date)}` : "começa na entrega (sem data)") : `encerrada em ${dateBr(w.end)}`}</span>
            </span>
          </span>
        </Link>
        <div className="flex w-full gap-2 sm:w-auto">
          {chat && (
            <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 sm:flex-none dark:ring-white/[0.12]">
              <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
            </a>
          )}
          <button type="button" disabled={!!actions.busy} onClick={() => actions.pdf(doc, "manual")} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 disabled:opacity-50 sm:flex-none dark:ring-white/[0.12]">
            <ShieldCheck className="h-4 w-4" /> Certificado
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <SearchBox q={q} setQ={setQ} placeholder="Buscar por cliente, CPF, telefone, modelo ou chassi" />
      {sales.loading && !sales.data ? (
        <Skeleton className="h-64" />
      ) : all.length === 0 ? (
        <Box>
          <Empty icon={<ShieldCheck className="h-6 w-6" />} title="Nenhuma scooter vendida ainda" text="Assim que o comprador assina o contrato, a garantia aparece aqui com a contagem dos dias." />
        </Box>
      ) : (
        <>
          <section>
            <SectionTitle title="Em garantia" count={ativas.length} />
            {ativas.length ? <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{ativas.map((r) => <Row key={r.doc.id} {...r} />)}</div> : <p className="text-[14px] text-ink-500">Nenhuma garantia correndo agora.</p>}
          </section>
          {entrega.length > 0 && (
            <section>
              <SectionTitle title="Começam na entrega" count={entrega.length} />
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{entrega.map((r) => <Row key={r.doc.id} {...r} />)}</div>
            </section>
          )}
          {encerradas.length > 0 && (
            <section>
              <button type="button" onClick={() => setShowEnded((v) => !v)} className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">
                Encerradas <span className="text-ink-400">{encerradas.length}</span> <ChevronDown className={cx("h-4 w-4 transition", showEnded && "rotate-180")} />
              </button>
              {showEnded && <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{encerradas.map((r) => <Row key={r.doc.id} {...r} />)}</div>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
