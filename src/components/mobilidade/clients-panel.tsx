"use client";

import { ChevronDown, ChevronRight, ClipboardPaste, MessageCircle, Phone, Plus, Send, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty, Skeleton, cx } from "@/components/ui";
import { digits, maskDoc } from "@/lib/br";
import { formatPhone, relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { saleStage } from "@/lib/moto-board";
import { groupClients, matchClient, portalMessage, type ClientStage, type MotoClient } from "@/lib/moto-clients";
import { contractValue } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";
import { Chips } from "./board-panels";
import { CadastroPanel } from "./cadastro-panel";
import { SaleRow, brl0, wa, type SaleActions, type Sales } from "./sale-row";

type Filter = "todos" | "compraram" | "negociando" | "interessados";
type Interested = { id: string; name: string; phone: string | null; city: string | null; status: string; created_at: string; notes: string | null };

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const STAGE: Record<ClientStage, { label: string; cls: string }> = {
  garantia: { label: "Comprou · em garantia", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" },
  cliente: { label: "Comprou", cls: "bg-ink-100 text-ink-700 ring-ink-200 dark:bg-white/[0.06] dark:text-white/70 dark:ring-white/10" },
  assinatura: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30" },
  orcamento: { label: "Orçamento", cls: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30" },
};
const BOUGHT: ClientStage[] = ["garantia", "cliente"];

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

export function ClientsPanel({ sales, actions, startWithCadastro }: { sales: Sales; actions: SaleActions; startWithCadastro?: boolean }) {
  const all = useMemo(() => sales.data ?? [], [sales.data]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [cadastro, setCadastro] = useState(!!startWithCadastro);
  const leads = useInterested();

  const clients = useMemo(() => groupClients(all, (d) => contractValue(d)), [all]);
  const buyerPhones = useMemo(() => new Set(clients.map((c) => digits(c.phone).slice(-9)).filter(Boolean)), [clients]);
  const buyerLeads = useMemo(() => new Set(clients.map((c) => c.leadId).filter(Boolean)), [clients]);
  const interested = useMemo(
    () => (leads.data ?? []).filter((l) => l.status !== "perdido" && !buyerLeads.has(l.id) && !buyerPhones.has(digits(l.phone).slice(-9))),
    [leads.data, buyerLeads, buyerPhones],
  );

  const inFilter = (c: MotoClient, f: Filter) => f === "todos" || (f === "compraram" ? BOUGHT.includes(c.stage) : f === "negociando" ? !BOUGHT.includes(c.stage) : false);
  const count = (f: Filter) => (f === "interessados" ? interested.length : clients.filter((c) => inFilter(c, f)).length);
  const shown = clients.filter((c) => inFilter(c, filter) && matchClient(c, q));
  const shownLeads = interested.filter((l) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return l.name.toLowerCase().includes(t) || (digits(t).length >= 3 && digits(l.phone).includes(digits(t))) || (l.city ?? "").toLowerCase().includes(t);
  });
  const portal = typeof window !== "undefined" ? `${window.location.origin}/cliente` : "/cliente";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* busca e ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar cliente</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CPF, telefone, cidade ou chassi"
            className="h-12 w-full rounded-full bg-white pr-10 pl-5 text-[15px] ring-1 ring-ink-200 outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] dark:ring-white/[0.1]"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="absolute top-1/2 right-3 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <button type="button" onClick={() => setCadastro((v) => !v)} className={cx(BTN, "h-12", cadastro && "bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-[#0A0D0B]")}>
          <ClipboardPaste className="h-4 w-4" /> Colar cadastro
        </button>
      </div>

      {cadastro && (
        <section className="relative rounded-[28px] bg-white p-4 ring-1 ring-ink-200/80 sm:p-6 dark:bg-[#0d110f] dark:ring-white/[0.07]">
          <button type="button" onClick={() => setCadastro(false)} aria-label="Fechar cadastro" className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
          <CadastroPanel />
        </section>
      )}

      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          ["todos", "Todos", count("todos")],
          ["compraram", "Compraram", count("compraram")],
          ["negociando", "Em negociação", count("negociando")],
          ["interessados", "Interessados", count("interessados")],
        ]}
      />

      {sales.loading && !sales.data ? (
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
            <ClientCard key={c.key} c={c} all={all} actions={actions} portal={portal} />
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

function ClientCard({ c, all, actions, portal }: { c: MotoClient; all: DocumentRow[]; actions: SaleActions; portal: string }) {
  const [openQuotes, setOpenQuotes] = useState(false);
  const st = STAGE[c.stage];
  const rows = c.sales.map((s) => all.find((x) => x.id === s.id)).filter((x): x is DocumentRow => !!x);
  const main = rows.filter((r) => saleStage(r) !== "orcamento");
  const quotes = rows.filter((r) => saleStage(r) === "orcamento");
  const bought = c.bought > 0;
  const chat = wa(c.phone);
  const access = wa(c.phone, portalMessage(c.name, portal));
  const collapse = quotes.length > 1;
  return (
    <article className="overflow-hidden rounded-[26px] bg-white ring-1 ring-ink-200/80 dark:bg-[#0d110f] dark:ring-white/[0.07]">
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
        {bought && (
          <div className="text-right">
            <p className="text-[16px] font-bold tabular-nums">{brl0(c.total)}</p>
            <p className="text-[12px] text-ink-500">
              {c.bought} {c.bought === 1 ? "scooter" : "scooters"}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pb-3 sm:px-4">
        {main.map((d) => (
          <SaleRow key={d.id} doc={d} actions={actions} hideClient />
        ))}
        {collapse ? (
          <div className="rounded-[20px] bg-ink-50/70 p-1.5 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-1.5">
              <button type="button" onClick={() => setOpenQuotes((v) => !v)} aria-expanded={openQuotes} className="flex items-center gap-1.5 text-left text-[14px] font-semibold">
                <span>
                  {quotes.length} orçamentos
                  <span className="block text-[12.5px] font-normal text-ink-500">último {relativeTime(quotes[0].updated_at)}</span>
                </span>
                <ChevronDown className={cx("h-4 w-4 shrink-0 transition", openQuotes && "rotate-180")} />
              </button>
              <button type="button" disabled={!!actions.busy} onClick={() => actions.removeMany(quotes.slice(1))} className="inline-flex items-center gap-1 text-[13px] font-semibold text-rose-600 hover:underline disabled:opacity-50" title="Mantém só o orçamento mais recente">
                <Trash2 className="h-4 w-4" /> Manter só o último
              </button>
            </div>
            {openQuotes && (
              <div className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {quotes.map((d) => (
                  <SaleRow key={d.id} doc={d} actions={actions} hideClient />
                ))}
              </div>
            )}
          </div>
        ) : (
          quotes.map((d) => <SaleRow key={d.id} doc={d} actions={actions} hideClient />)
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-ink-200/70 px-4 py-3 sm:flex sm:flex-wrap sm:px-5 dark:border-white/[0.06]">
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1 sm:flex-none")}>
            <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
          </a>
        )}
        {bought && access && (
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
