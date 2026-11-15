"use client";

import { Ban, ChevronRight, ClipboardPaste, Copy, FileText, MessageCircle, PencilLine, Phone, Plus, Search, ShieldAlert, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Empty, Skeleton, cx } from "@/components/ui";
import { digits, maskDoc } from "@/lib/br";
import { formatPhone, relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { buyerOf, saleStage, warrantyOf } from "@/lib/moto-board";
import { clientHref, clientKey, groupClients, matchClient, type MotoClient } from "@/lib/moto-clients";
import { contractValue, motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";
import { Chips, SectionTitle } from "./board-panels";
import { CadastroPanel } from "./cadastro-panel";
import { Menu, brl0, wa, type SaleActions, type SaleDoc, type Sales } from "./sale-row";

type Interested = { id: string; name: string; phone: string | null; city: string | null; status: string; created_at: string; notes: string | null };

const sale = (d: SaleDoc) => d.data as unknown as MotoData;
const model = (d: MotoData) => vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
const first = (n: string) => n.trim().split(/\s+/)[0] || "";
const days = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const BTN = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap ring-1 ring-ink-200 transition hover:ring-ink-300 disabled:opacity-50 dark:ring-white/[0.12] dark:hover:ring-white/25";
const CARD = "rounded-[20px] bg-white p-3.5 ring-1 ring-ink-200/80 transition hover:ring-ink-300 dark:bg-[#111513] dark:ring-white/[0.07] dark:hover:ring-white/20";

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

function SearchBox({ q, setQ, placeholder }: { q: string; setQ: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block flex-1">
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

function Avatar({ name }: { name: string }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#F3E93B,#9FDB7C_55%,#4FC38A)] text-[14px] font-bold text-[#0A0D0B]">{initials(name)}</span>;
}

function Column({ title, hint, count, total, children }: { title: string; hint: string; count: number; total?: number; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-[24px] bg-ink-50/70 p-3 ring-1 ring-ink-200/60 dark:bg-white/[0.025] dark:ring-white/[0.06]">
      <div className="px-1.5 pt-1 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[15px] font-semibold">
            {title} <span className="text-ink-400">{count}</span>
          </p>
          {total ? <p className="text-[13px] font-semibold text-ink-500 tabular-nums">{brl0(total)}</p> : null}
        </div>
        <p className="text-[12.5px] text-ink-500">{hint}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{children}</div>
    </section>
  );
}

/* ============================================================ Negociação */

export function NegotiationPanel({ sales, actions, startWithCadastro }: { sales: Sales; actions: SaleActions; startWithCadastro?: boolean }) {
  const all = useMemo(() => (sales.data ?? []) as SaleDoc[], [sales.data]);
  const leads = useInterested();
  const [q, setQ] = useState("");
  const [cadastro, setCadastro] = useState(!!startWithCadastro);
  const clients = useMemo(() => groupClients(all, (d) => contractValue(d)), [all]);
  const known = useMemo(() => new Set(clients.map((c) => digits(c.phone).slice(-9)).filter(Boolean)), [clients]);
  const knownLeads = useMemo(() => new Set(all.map((d) => d.lead_id).filter(Boolean)), [all]);
  const match = (name: string, phone: string | null, extra = "") => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return `${name} ${extra}`.toLowerCase().includes(t) || (digits(t).length >= 3 && digits(phone).includes(digits(t)));
  };

  const interested = (leads.data ?? []).filter((l) => l.status !== "perdido" && !knownLeads.has(l.id) && !known.has(digits(l.phone).slice(-9)) && match(l.name, l.phone, l.city ?? ""));
  // Orçamentos: um cartão por cliente (o mais recente), só para quem ainda não tem contrato enviado.
  const waitingKeys = new Set(all.filter((d) => saleStage(d) === "aguardando").map((d) => clientKey(sale(d))));
  const quoteGroups = new Map<string, SaleDoc[]>();
  for (const d of all) {
    if (saleStage(d) !== "orcamento") continue;
    const k = clientKey(sale(d));
    if (waitingKeys.has(k)) continue;
    quoteGroups.set(k, [...(quoteGroups.get(k) ?? []), d]);
  }
  const quotes = [...quoteGroups.entries()].filter(([, list]) => match(sale(list[0]).client.name, sale(list[0]).client.phone, model(sale(list[0]))));
  const waiting = all.filter((d) => saleStage(d) === "aguardando" && match(sale(d).client.name, sale(d).client.phone, model(sale(d))));
  const sum = (list: SaleDoc[]) => list.reduce((t, d) => t + contractValue(sale(d)), 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox q={q} setQ={setQ} placeholder="Buscar por nome, telefone ou modelo" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setCadastro((v) => !v)} className={cx(BTN, "h-12 flex-1 px-4 sm:flex-none", cadastro && "bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-[#0A0D0B]")}>
            <ClipboardPaste className="h-4 w-4" /> Colar cadastro
          </button>
          <Link href="/documentos/novo?tipo=moto" className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-[13.5px] font-bold text-[#0A0D0B] sm:flex-none">
            <Plus className="h-4 w-4" /> Novo orçamento
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

      {sales.loading && !sales.data ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-3 lg:items-start">
          <Column title="1 · Interessados" hint="Pediram informação, ainda sem orçamento" count={interested.length}>
            {interested.length ? (
              interested.slice(0, 40).map((l) => {
                const chat = wa(l.phone, `Olá, ${first(l.name)}! Aqui é da Quark Mobilidade.`);
                const interest = l.notes?.match(/Interesse:\s*([^\n]+)/i)?.[1]?.trim();
                return (
                  <article key={l.id} className={CARD}>
                    <Link href={`/leads/${l.id}`} className="block">
                      <p className="truncate text-[15px] font-semibold">{l.name}</p>
                      <p className="truncate text-[12.5px] text-ink-500">{[l.phone && formatPhone(l.phone), l.city, relativeTime(l.created_at)].filter(Boolean).join(" · ")}</p>
                      {interest && <p className="mt-0.5 truncate text-[12.5px] font-medium text-emerald-700 dark:text-emerald-300">Interesse: {interest}</p>}
                    </Link>
                    <div className="mt-2.5 flex gap-2">
                      {chat && (
                        <a href={chat} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1")}>
                          <MessageCircle className="h-4 w-4 text-emerald-600" /> Conversar
                        </a>
                      )}
                      <Link href={`/documentos/novo?tipo=moto&lead=${l.id}`} className={cx(BTN, "flex-1")}>
                        <Plus className="h-4 w-4" /> Orçamento
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="px-1.5 pb-2 text-[13px] text-ink-500">Ninguém aguardando contato.</p>
            )}
          </Column>

          <Column title="2 · Orçamentos" hint="Receberam proposta, sem contrato ainda" count={quotes.length} total={quotes.reduce((t, [, l]) => t + contractValue(sale(l[0])), 0)}>
            {quotes.length ? (
              quotes.map(([k, list]) => {
                const d = list[0];
                const s = sale(d);
                const stale = days(d.updated_at) > 7;
                const chat = wa(s.client.phone, `Olá, ${first(s.client.name)}! Tudo bem? Ainda pensando na scooter ${model(s)}? Posso te ajudar com alguma dúvida?`);
                return (
                  <article key={k} className={CARD}>
                    <Link href={clientHref(k)} className="flex items-center gap-3">
                      <span className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-[#050706]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={motoPhoto(s)} alt="" className="max-h-9 w-auto object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{s.client.name || "Cliente sem nome"}</span>
                        <span className="block truncate text-[12.5px] text-ink-500">
                          {model(s)} · {brl0(contractValue(s))}
                          {list.length > 1 ? ` · ${list.length} orçamentos` : ""}
                        </span>
                        <span className={cx("block text-[12px]", stale ? "font-semibold text-amber-700 dark:text-amber-300" : "text-ink-500")}>{stale ? `parado há ${days(d.updated_at)} dias` : relativeTime(d.updated_at)}</span>
                      </span>
                    </Link>
                    <div className="mt-2.5 flex gap-2">
                      {chat && (
                        <a href={chat} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1")}>
                          <MessageCircle className="h-4 w-4 text-emerald-600" /> Retomar
                        </a>
                      )}
                      <Link href={`/documentos/${d.id}`} className={cx(BTN, "flex-1")}>
                        <PencilLine className="h-4 w-4" /> Fechar contrato
                      </Link>
                      <Menu
                        items={[
                          { label: "Baixar orçamento", icon: <FileText className="h-4 w-4" />, onClick: () => actions.pdf(d, "orcamento") },
                          { label: "Abrir ficha do cliente", icon: <UserRound className="h-4 w-4" />, href: clientHref(k) },
                          ...(list.length > 1 ? [{ label: "Manter só o último", icon: <Trash2 className="h-4 w-4" />, onClick: () => actions.removeMany(list.slice(1)), danger: true }] : []),
                          { label: list.length > 1 ? "Apagar todos os orçamentos" : "Apagar orçamento", icon: <Trash2 className="h-4 w-4" />, onClick: () => (list.length > 1 ? actions.removeMany(list) : actions.remove(d)), danger: true },
                        ]}
                      />
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="px-1.5 pb-2 text-[13px] text-ink-500">Nenhum orçamento em aberto.</p>
            )}
          </Column>

          <Column title="3 · Aguardando assinatura" hint="Contrato enviado, falta o cliente assinar" count={waiting.length} total={sum(waiting)}>
            {waiting.length ? (
              waiting.map((d) => {
                const s = sale(d);
                const token = (buyerOf(d) as { token?: string } | null)?.token;
                const link = token && typeof window !== "undefined" ? `${window.location.origin}/assinar/${token}` : "";
                const chat = wa(s.client.phone, `Olá, ${first(s.client.name)}! Seu contrato da scooter ${model(s)} está pronto para assinar pelo celular, leva 1 minuto${link ? `: ${link}` : "."}`);
                return (
                  <article key={d.id} className={CARD}>
                    <Link href={clientHref(clientKey(s))} className="flex items-center gap-3">
                      <span className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-[#050706]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={motoPhoto(s)} alt="" className="max-h-9 w-auto object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{s.client.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-500">
                          {model(s)} · {brl0(contractValue(s))}
                        </span>
                        <span className={cx("block text-[12px]", days(d.updated_at) > 2 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-ink-500")}>enviado {relativeTime(d.updated_at)}</span>
                      </span>
                    </Link>
                    <div className="mt-2.5 flex gap-2">
                      {chat && (
                        <a href={chat} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1")}>
                          <MessageCircle className="h-4 w-4 text-emerald-600" /> Cobrar assinatura
                        </a>
                      )}
                      <Menu
                        items={[
                          { label: "Abrir contrato", icon: <PencilLine className="h-4 w-4" />, href: `/documentos/${d.id}` },
                          ...(link ? [{ label: "Copiar link de assinatura", icon: <Copy className="h-4 w-4" />, onClick: () => navigator.clipboard?.writeText(link).then(() => toast.success("Link copiado")) }] : []),
                          { label: "Abrir ficha do cliente", icon: <UserRound className="h-4 w-4" />, href: clientHref(clientKey(s)) },
                          { label: "Cancelar contrato", icon: <Ban className="h-4 w-4" />, onClick: () => actions.cancel(d), danger: true },
                        ]}
                      />
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="px-1.5 pb-2 text-[13px] text-ink-500">Nenhum contrato esperando.</p>
            )}
          </Column>
        </div>
      )}
    </div>
  );
}

/* ================================================================ Clientes */

type CustFilter = "todos" | "garantia" | "encerrada";

export function CustomersPanel({ sales }: { sales: Sales }) {
  const all = useMemo(() => (sales.data ?? []) as SaleDoc[], [sales.data]);
  const [q, setQ] = useState("");
  const [f, setF] = useState<CustFilter>("todos");
  const clients = useMemo(() => groupClients(all, (d) => contractValue(d)).filter((c) => c.bought > 0), [all]);
  const inF = (c: MotoClient, x: CustFilter) => x === "todos" || (x === "garantia" ? c.stage === "garantia" : c.stage === "cliente");
  const shown = clients.filter((c) => inF(c, f) && matchClient(c, q)).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const byId = new Map(all.map((d) => [d.id, d]));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <SearchBox q={q} setQ={setQ} placeholder="Buscar cliente por nome, CPF, telefone, cidade ou chassi" />
      <Chips<CustFilter>
        value={f}
        onChange={setF}
        items={[
          ["todos", "Todos os clientes", clients.length],
          ["garantia", "Em garantia", clients.filter((c) => c.stage === "garantia").length],
          ["encerrada", "Garantia encerrada", clients.filter((c) => c.stage === "cliente").length],
        ]}
      />
      {sales.loading && !sales.data ? (
        <Skeleton className="h-64" />
      ) : shown.length ? (
        <section>
          <SectionTitle title="Clientes" count={shown.length} />
          <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-ink-200/80 dark:bg-[#0f1311] dark:ring-white/[0.07]">
            {shown.map((c, i) => {
              const sold = c.sales.filter((s) => saleStage(s) === "vendida").map((s) => sale(byId.get(s.id) ?? (s as SaleDoc)));
              const w = sold.map((d) => warrantyOf(d)).filter((x) => x.state !== "encerrada").sort((a, b) => b.left - a.left)[0];
              const open = c.sales.length - c.bought;
              return (
                <Link key={c.key} href={clientHref(c.key)} className={cx("flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 dark:hover:bg-white/[0.03]", i > 0 && "border-t border-ink-200/60 dark:border-white/[0.06]")}>
                  <Avatar name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold">{c.name}</span>
                    <span className="block truncate text-[13px] text-ink-500">
                      {sold.map((d) => `${model(d)}${d.color ? ` ${d.color.toLowerCase()}` : ""}`).join(", ")}
                      {c.city ? ` · ${c.city}` : ""}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-500">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {formatPhone(c.phone)}
                        </span>
                      )}
                      {c.doc && <span>CPF {maskDoc(c.doc)}</span>}
                      {w ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" /> {w.state === "ativa" ? `garantia · ${w.left} dias` : "garantia começa na entrega"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <ShieldAlert className="h-3.5 w-3.5" /> garantia encerrada
                        </span>
                      )}
                      {open > 0 && <span className="font-semibold text-amber-700 dark:text-amber-300">{open} em aberto</span>}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-[15px] font-bold tabular-nums">{brl0(c.total)}</span>
                    <span className="block text-[12px] text-ink-500">
                      {c.bought} {c.bought === 1 ? "scooter" : "scooters"}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-[28px] ring-1 ring-ink-200 dark:ring-white/[0.08]">
          <Empty icon={<UserRound className="h-6 w-6" />} title={q ? "Nenhum cliente encontrado" : "Nenhum cliente fechado ainda"} text="Quando o comprador assina o contrato, ele vira cliente e ganha uma ficha completa aqui." />
        </div>
      )}
    </div>
  );
}
