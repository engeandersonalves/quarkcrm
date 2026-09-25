"use client";

import { Calculator, Download, PlugZap, Copy, Eye, FileText, MoreHorizontal, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Empty, Input, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { PRODUCTS, PROPOSAL_STATUS, productOf } from "@/lib/constants";
import { proposalSummary } from "@/lib/proposal-summary";
import { formatDate, relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum } from "@/lib/pricing";
import { downloadCsv, today } from "@/lib/csv";
import { supabase } from "@/lib/supabase/client";
import type { Product, Proposal, ProposalStatus } from "@/lib/types";

type Filter = "todas" | ProposalStatus;

export default function ProposalsPage() {
  return (
    <Suspense>
      <Proposals />
    </Suspense>
  );
}

function Proposals() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [product, setProduct] = useState<"todos" | Product>(params.get("tipo") === "save" ? "save" : params.get("tipo") === "solar" ? "solar" : "todos");
  useEffect(() => {
    const t = params.get("tipo");
    setProduct(t === "save" ? "save" : t === "solar" ? "solar" : "todos");
  }, [params]);
  const { data, loading } = useLive(
    async () => must(await supabase().from("proposals").select("*, lead:leads(id,name,city,phone)").order("created_at", { ascending: false })) as Proposal[],
    [],
    ["proposals"],
  );
  const scoped = useMemo(() => (data ?? []).filter((p) => product === "todos" || productOf(p.inputs) === product), [data, product]);

  const rows = useMemo(
    () =>
      scoped.filter(
        (p) =>
          (filter === "todas" || p.status === filter) &&
          `${p.number} ${p.lead?.name ?? ""} ${p.title ?? ""} ${p.lead?.city ?? ""}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [scoped, q, filter],
  );

  const totals = useMemo(() => {
    const all = scoped;
    const open = all.filter((p) => ["enviada", "visualizada"].includes(p.status));
    const won = all.filter((p) => p.status === "aceita");
    return {
      open: open.reduce((s, p) => s + Number(p.final_price), 0),
      openCount: open.length,
      won: won.reduce((s, p) => s + Number(p.final_price), 0),
      wonCount: won.length,
      profit: won.reduce((s, p) => s + Number(p.profit_value), 0),
    };
  }, [scoped]);

  const duplicate = async (p: Proposal) => {
    const { id, number, public_token, created_at, updated_at, lead, sent_at, viewed_at, view_count, accepted_at, accepted_by, status, ...rest } = p;
    void id; void number; void public_token; void created_at; void updated_at; void lead; void sent_at; void viewed_at; void view_count; void accepted_at; void accepted_by; void status;
    const { data: copy, error } = await supabase().from("proposals").insert({ ...rest, status: "rascunho" }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Orçamento duplicado");
    router.push(`/propostas/${copy.id}`);
  };

  const remove = async (p: Proposal) => {
    if (!confirm(`Excluir o orçamento #${p.number}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase().from("proposals").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento excluído");
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={product === "save" ? "Propostas S.A.V.E" : product === "solar" ? "Propostas solares" : "Propostas"}
        subtitle={product === "save" ? "Sistemas de abastecimento de veículo elétrico" : "Todos os orçamentos gerados, com status de envio e visualização"}
        actions={
          <>
            {product !== "save" && (
              <Link href="/propostas/nova">
                <Button variant="sun">
                  <Calculator className="h-4 w-4" /> Orçamento solar
                </Button>
              </Link>
            )}
            {product !== "solar" && (
              <Link href="/propostas/nova?tipo=save">
                <Button>
                  <PlugZap className="h-4 w-4" /> Orçamento S.A.V.E
                </Button>
              </Link>
            )}
            <Button
              variant="secondary"
              title="Baixar planilha (Excel) com as propostas filtradas"
              onClick={() =>
                downloadCsv(
                  `propostas-${today()}.csv`,
                  ["Nº", "Tipo", "Cliente", "Resumo", "Status", "Valor final (R$)", "Custo direto (R$)", "Lucro (R$)", "Comissão (R$)", "Visualizações", "Criada em", "Aceita em"],
                  rows.map((p) => [
                    p.number,
                    PRODUCTS[productOf(p.inputs)].short,
                    p.lead?.name,
                    proposalSummary(p),
                    PROPOSAL_STATUS[p.status]?.label,
                    Number(p.final_price),
                    Number(p.direct_cost),
                    Number(p.profit_value),
                    Number(p.commission_value),
                    p.view_count,
                    new Date(p.created_at).toLocaleDateString("pt-BR"),
                    p.accepted_at ? new Date(p.accepted_at).toLocaleDateString("pt-BR") : "",
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar</span>
            </Button>
          </>
        }
      />

      <Segmented<"todos" | Product>
        className="mb-4"
        value={product}
        onChange={(v) => {
          setProduct(v);
          router.replace(v === "todos" ? "/propostas" : `/propostas?tipo=${v}`);
        }}
        options={[
          { value: "todos", label: "Todas" },
          { value: "solar", label: "☀️ Solar" },
          { value: "save", label: "⚡ S.A.V.E" },
        ]}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Em aberto" value={brl(totals.open, 0)} sub={`${totals.openCount} propostas enviadas`} />
        <Stat label="Aceitas" value={brl(totals.won, 0)} sub={`${totals.wonCount} propostas`} accent />
        <Stat label="Lucro nas aceitas" value={brl(totals.profit, 0)} sub="Soma do lucro previsto" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente, número ou cidade" className="pl-10" />
        </div>
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "todas", label: "Todas" },
              { value: "rascunho", label: "Rascunhos" },
              { value: "enviada", label: "Enviadas" },
              { value: "visualizada", label: "Vistas" },
              { value: "aceita", label: "Aceitas" },
            ]}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="grid gap-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !rows.length ? (
          <Empty
            icon={<FileText className="h-6 w-6" />}
            title={data?.length ? "Nada encontrado" : "Nenhum orçamento ainda"}
            text={data?.length ? "Ajuste a busca ou o filtro." : "Crie o primeiro orçamento e envie uma proposta impecável ao seu cliente."}
            action={
              !data?.length && (
                <Link href="/propostas/nova">
                  <Button variant="sun">Criar orçamento</Button>
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((p) => (
              <li key={p.id} className="group relative flex items-center gap-4 px-5 py-4 transition hover:bg-ink-50/60">
                <Link href={`/propostas/${p.id}`} className="absolute inset-0" aria-label={`Abrir orçamento ${p.number}`} />
                <div className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-sun-50 font-display text-xs font-bold text-sun-700 ring-1 ring-sun-200/70 sm:grid">
                  #{p.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink-900">{p.lead?.name ?? "—"}</p>
                    <Badge className={PROPOSAL_STATUS[p.status].cls}>{PROPOSAL_STATUS[p.status].label}</Badge>
                    {productOf(p.inputs) === "save" && <Badge className={PRODUCTS.save.cls}>⚡ S.A.V.E</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-ink-500">
                    <span className="sm:hidden">#{p.number} · </span>
                    {proposalSummary(p)} · {formatDate(p.created_at)}
                    {p.view_count > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-violet-600">
                        <Eye className="h-3 w-3" /> {p.view_count}× · {relativeTime(p.viewed_at)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum font-display font-semibold">{brl(p.final_price)}</p>
                  <p className={cx("tnum text-xs", p.profit_value < 0 ? "text-rose-600" : "text-emerald-600")}>lucro {brl(p.profit_value, 0)}</p>
                </div>
                <RowMenu onDuplicate={() => duplicate(p)} onDelete={() => remove(p)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, accent, className }: { label: string; value: string; sub: string; accent?: boolean; className?: string }) {
  return (
    <Card className={cx("p-4 sm:p-5", accent && "bg-ink-950 text-white ring-ink-950", className)}>
      <p className={cx("text-xs font-semibold", accent ? "text-ink-400" : "text-ink-500")}>{label}</p>
      <p className={cx("tnum mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl", accent && "text-sun-gradient")}>{value}</p>
      <p className={cx("mt-0.5 text-xs", accent ? "text-ink-500" : "text-ink-400")}>{sub}</p>
    </Card>
  );
}

function RowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-10">
      <button onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-800" aria-label="Ações">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="animate-fade-up absolute top-full right-0 z-20 mt-1 w-44 rounded-xl bg-white p-1 shadow-lift ring-1 ring-ink-200">
          <button onMouseDown={onDuplicate} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-ink-50">
            <Copy className="h-4 w-4 text-ink-400" /> Duplicar
          </button>
          <button onMouseDown={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
