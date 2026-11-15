"use client";

import { BadgeCheck, BookOpen, ChevronRight, ClipboardPaste, Loader2, MessageCircle, Phone, Plus, Search, Send, ShieldAlert, ShieldCheck, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Empty, Skeleton, cx } from "@/components/ui";
import { brlPlain, dateBr, digits, maskDoc } from "@/lib/br";
import { formatPhone, relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { groupClients, matchClient, portalMessage, warrantyDaysLeft, type ClientStage, type MotoClient } from "@/lib/moto-clients";
import { contractValue, motoPhoto, vehicleName, warrantyEnd, type MotoData } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";
import { CadastroPanel } from "./cadastro-panel";
import { saleCompany } from "./sale-docs";

type Filter = "todos" | ClientStage | "interessados";
type Interested = { id: string; name: string; phone: string | null; city: string | null; status: string; created_at: string; notes: string | null };

const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");
const wa = (phone: string | null | undefined, text = "") => {
  const n = digits(phone);
  if (!n) return null;
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const STAGE: Record<ClientStage, { label: string; cls: string }> = {
  garantia: { label: "Em garantia", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" },
  assinatura: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30" },
  orcamento: { label: "Orçamento", cls: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30" },
  encerrada: { label: "Garantia encerrada", cls: "bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/[0.06] dark:text-white/60 dark:ring-white/10" },
};

const BTN = "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap ring-1 ring-ink-200 transition hover:ring-ink-300 disabled:opacity-50 dark:ring-white/[0.12] dark:hover:ring-white/25";

function useInterested() {
  return useLive(
    async () =>
      must(
        await supabase().from("leads").select("id,name,phone,city,status,created_at,notes").eq("segment", "mobilidade").order("created_at", { ascending: false }).limit(300),
      ) as Interested[],
    [],
    ["leads"],
  );
}

export function ClientsPanel({ sales, loading, startWithCadastro }: { sales: DocumentRow[]; loading: boolean; startWithCadastro?: boolean }) {
  const { settings, profile } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [cadastro, setCadastro] = useState(!!startWithCadastro);
  const [busy, setBusy] = useState<string | null>(null);
  const leads = useInterested();

  const clients = useMemo(() => groupClients(sales, (d) => contractValue(d)), [sales]);
  const buyerPhones = useMemo(() => new Set(clients.map((c) => digits(c.phone).slice(-9)).filter(Boolean)), [clients]);
  const buyerLeads = useMemo(() => new Set(clients.map((c) => c.leadId).filter(Boolean)), [clients]);
  const interested = useMemo(
    () => (leads.data ?? []).filter((l) => l.status !== "perdido" && !buyerLeads.has(l.id) && !buyerPhones.has(digits(l.phone).slice(-9))),
    [leads.data, buyerLeads, buyerPhones],
  );

  const count = (f: Filter) => (f === "todos" ? clients.length : f === "interessados" ? interested.length : clients.filter((c) => c.stage === f).length);
  const shown = clients.filter((c) => (filter === "todos" || c.stage === filter) && matchClient(c, q));
  const shownLeads = interested.filter((l) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return l.name.toLowerCase().includes(t) || (digits(t).length >= 3 && digits(l.phone).includes(digits(t))) || (l.city ?? "").toLowerCase().includes(t);
  });
  const portal = typeof window !== "undefined" ? `${window.location.origin}/cliente` : "/cliente";

  const pdf = async (d: DocumentRow, which: "manual" | "comprovante") => {
    setBusy(`${d.id}-${which}`);
    try {
      const s = d.data as unknown as MotoData;
      const signedAt = (d.signers ?? []).find((x) => x.role === "comprador")?.signed_at ?? null;
      if (which === "manual") await (await import("./moto-manual")).downloadSaleManual(s, d.id, settings, signedAt);
      else await (await import("./purchase-receipt")).downloadPurchaseReceipt(s, saleCompany(settings, profile), d.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF");
    } finally {
      setBusy(null);
    }
  };

  const filters: [Filter, string][] = [
    ["todos", "Todos"],
    ["garantia", "Em garantia"],
    ["assinatura", "Aguardando assinatura"],
    ["orcamento", "Orçamentos"],
    ["encerrada", "Garantia encerrada"],
    ["interessados", "Interessados"],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* busca e ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" />
          <span className="sr-only">Buscar cliente</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CPF, telefone, cidade ou chassi"
            className="h-12 w-full rounded-full bg-white pr-10 pl-11 text-[15px] ring-1 ring-ink-200 outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] dark:ring-white/[0.1]"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="absolute top-1/2 right-3 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCadastro((v) => !v)} className={cx(BTN, "h-12 flex-1 sm:flex-none", cadastro && "bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-[#0A0D0B]")}>
            <ClipboardPaste className="h-4 w-4" /> Colar cadastro
          </button>
          <Link href="/documentos/novo?tipo=moto" className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-[13px] font-bold text-[#0A0D0B] sm:flex-none">
            <Plus className="h-4 w-4" /> Nova venda
          </Link>
        </div>
      </div>

      {cadastro && (
        <section className="relative rounded-[28px] bg-white p-4 ring-1 ring-ink-200/80 sm:p-6 dark:bg-[#0d110f] dark:ring-white/[0.07]">
          <button type="button" onClick={() => setCadastro(false)} aria-label="Fechar cadastro" className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
          <CadastroPanel />
        </section>
      )}

      {/* filtros */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {filters.map(([v, l]) => {
          const n = count(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={cx(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold ring-1 transition",
                filter === v ? "bg-[#0A0D0B] text-[#fff] ring-[#0A0D0B] dark:bg-[#fff] dark:text-[#0A0D0B] dark:ring-[#fff]" : "text-ink-600 ring-ink-200 hover:ring-ink-300 dark:ring-white/[0.12]",
              )}
            >
              {l}
              <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", filter === v ? "bg-white/15 dark:bg-black/10" : "bg-ink-100 dark:bg-white/10")}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* lista */}
      {loading && !sales.length ? (
        <Skeleton className="h-64" />
      ) : filter === "interessados" ? (
        shownLeads.length ? (
          <div className="grid gap-2.5 md:grid-cols-2">
            {shownLeads.map((l) => (
              <InterestedCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <EmptyBox title={q ? "Ninguém encontrado" : "Sem interessados no momento"} text="Quem pede orçamento pelo catálogo, por indicação ou é cadastrado por texto aparece aqui até comprar." />
        )
      ) : shown.length ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {shown.map((c) => (
            <ClientCard key={c.key} c={c} sales={sales} busy={busy} onPdf={pdf} portal={portal} />
          ))}
        </div>
      ) : (
        <EmptyBox title={q ? "Nenhum cliente encontrado" : clients.length ? "Nada neste filtro" : "Nenhum cliente ainda"} text="Cada comprador ganha uma ficha aqui assim que você cria a venda: scooters, garantia, documentos e contatos num lugar só." />
      )}

      {filter === "todos" && !q && interested.length > 0 && (
        <button type="button" onClick={() => setFilter("interessados")} className="flex items-center justify-between rounded-[22px] bg-white px-5 py-4 text-left ring-1 ring-ink-200/80 hover:ring-ink-300 dark:bg-[#111513] dark:ring-white/[0.07]">
          <span>
            <span className="block text-[15px] font-semibold">
              {interested.length} {interested.length === 1 ? "interessado ainda não comprou" : "interessados ainda não compraram"}
            </span>
            <span className="block text-[13px] text-ink-500">Leads de Mobilidade: catálogo, indicações e cadastros</span>
          </span>
          <ChevronRight className="h-5 w-5 text-ink-400" />
        </button>
      )}
    </div>
  );
}

function EmptyBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[28px] ring-1 ring-ink-200 dark:ring-white/[0.08]">
      <Empty icon={<UserRound className="h-6 w-6" />} title={title} text={text} />
    </div>
  );
}

function ClientCard({ c, sales, busy, onPdf, portal }: { c: MotoClient; sales: DocumentRow[]; busy: string | null; onPdf: (d: DocumentRow, w: "manual" | "comprovante") => void; portal: string }) {
  const st = STAGE[c.stage];
  const rows = c.sales.map((s) => sales.find((x) => x.id === s.id)).filter((x): x is DocumentRow => !!x);
  const hasSigned = rows.some((r) => r.status === "assinado");
  const chat = wa(c.phone);
  const access = wa(c.phone, portalMessage(c.name, portal));
  return (
    <article className="overflow-hidden rounded-[26px] bg-white ring-1 ring-ink-200/80 dark:bg-[#111513] dark:ring-white/[0.07]">
      {/* ficha */}
      <div className="flex flex-wrap items-start gap-3.5 p-4 sm:p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#F3E93B,#9FDB7C_55%,#4FC38A)] text-[15px] font-bold text-[#0A0D0B]">{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-2 text-[17px] leading-tight font-semibold">{c.name}</h3>
            <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1", st.cls)}>
              {st.label}
              {c.stage === "garantia" ? ` · ${c.warrantyLeft} dias` : ""}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13.5px] text-ink-500">
            {c.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {formatPhone(c.phone)}
              </span>
            )}
            {c.doc && <span>CPF {maskDoc(c.doc)}</span>}
            {c.city && <span>{c.city}</span>}
          </p>
        </div>
        {c.total > 0 && (
          <div className="text-right">
            <p className="text-[16px] font-bold tabular-nums">{brl0(c.total)}</p>
            <p className="text-[12px] text-ink-500">
              {rows.filter((r) => r.status === "assinado").length} {rows.filter((r) => r.status === "assinado").length === 1 ? "scooter" : "scooters"}
            </p>
          </div>
        )}
      </div>

      {/* scooters do cliente */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pb-3 sm:px-4">
        {rows.map((d) => {
          const s = d.data as unknown as MotoData;
          const signed = d.status === "assinado";
          const left = warrantyDaysLeft(s, signed);
          const end = warrantyEnd(s);
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-[20px] bg-ink-50/70 p-2.5 sm:flex-nowrap dark:bg-white/[0.04]">
              <Link href={`/documentos/${d.id}`} className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                <span className="grid h-14 w-16 shrink-0 place-items-center rounded-[14px] bg-[#050706]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={motoPhoto(s)} alt="" className="max-h-12 w-auto object-contain" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">
                    {vehicleName(s).replace(/^Scooter elétrica\s*/, "") || "Scooter"}
                    {s.color ? ` · ${s.color}` : ""}
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-500">
                    {signed ? left > 0 ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-ink-400" /> : null}
                    <span className="truncate">
                      {signed
                        ? left > 0 && end
                          ? `garantia até ${dateBr(end)}`
                          : end
                            ? `garantia encerrada em ${dateBr(end)}`
                            : "garantia começa na entrega"
                        : d.status === "enviado"
                          ? "contrato enviado, aguardando assinatura"
                          : `orçamento · ${relativeTime(d.updated_at)}`}
                      {s.chassis ? ` · chassi ${s.chassis}` : ""}
                    </span>
                  </span>
                </span>
              </Link>
              <div className="flex w-full gap-2 sm:w-auto">
                <button type="button" disabled={!!busy} onClick={() => onPdf(d, "manual")} className={cx(BTN, "flex-1 bg-white sm:flex-none dark:bg-transparent")} title="Manual do proprietário com o certificado de garantia">
                  {busy === `${d.id}-manual` ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />} Manual
                </button>
                {signed && (
                  <button type="button" disabled={!!busy} onClick={() => onPdf(d, "comprovante")} className={cx(BTN, "flex-1 bg-white sm:flex-none dark:bg-transparent")} title="Comprovante de compra e propriedade">
                    {busy === `${d.id}-comprovante` ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Comprovante
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ações */}
      <div className="grid grid-cols-2 gap-2 border-t border-ink-200/70 px-4 py-3 sm:flex sm:flex-wrap sm:px-5 dark:border-white/[0.06]">
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1 sm:flex-none")}>
            <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
          </a>
        )}
        {hasSigned && access && (
          <a href={access} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1 sm:flex-none")} title="Envia pelo WhatsApp o link da área do cliente com as instruções de acesso">
            <Send className="h-4 w-4 text-emerald-600" /> Área do cliente
          </a>
        )}
        <Link href={`/documentos/novo?tipo=moto${c.leadId ? `&lead=${c.leadId}` : ""}`} className={cx(BTN, "flex-1 sm:flex-none")}>
          <Plus className="h-4 w-4" /> Nova venda
        </Link>
        {c.leadId && (
          <Link href={`/leads/${c.leadId}`} className={cx(BTN, "flex-1 sm:flex-none")}>
            <UserRound className="h-4 w-4" /> Ver lead
          </Link>
        )}
      </div>
    </article>
  );
}

function InterestedCard({ l }: { l: Interested }) {
  const chat = wa(l.phone, `Olá, ${l.name.trim().split(/\s+/)[0]}! Aqui é da Quark Mobilidade.`);
  const interest = l.notes?.match(/Interesse:\s*([^\n]+)/i)?.[1]?.trim();
  return (
    <article className="flex flex-col gap-3 rounded-[24px] bg-white p-4 ring-1 ring-ink-200/80 dark:bg-[#111513] dark:ring-white/[0.07]">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-100 text-[14px] font-bold text-ink-600 dark:bg-white/[0.08] dark:text-white/70">{initials(l.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{l.name}</p>
          <p className="truncate text-[13px] text-ink-500">{[l.phone && formatPhone(l.phone), l.city, relativeTime(l.created_at)].filter(Boolean).join(" · ")}</p>
          {interest && <p className="mt-1 truncate text-[13px] font-medium text-emerald-700 dark:text-emerald-300">Interesse: {interest}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1")}>
            <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
          </a>
        )}
        <Link href={`/documentos/novo?tipo=moto&lead=${l.id}`} className={cx(BTN, "flex-1")}>
          <Plus className="h-4 w-4" /> Venda
        </Link>
        <Link href={`/leads/${l.id}`} aria-label="Abrir lead" className={cx(BTN, "w-10 px-0")}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
