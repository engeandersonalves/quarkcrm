"use client";

import { Flame, LayoutGrid, List, MapPin, Phone, Plus, Search, Snowflake, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuick } from "@/components/app/shell";
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Segmented, Select, Skeleton, cx } from "@/components/ui";
import { SOURCES, STAGES, stageOf } from "@/lib/constants";
import { formatPhone, relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { Lead, LeadStatus } from "@/lib/types";

type LeadRow = Lead & { proposals: { final_price: number; status: string }[] };

export default function LeadsPage() {
  return (
    <Suspense>
      <Leads />
    </Suspense>
  );
}

function Leads() {
  const params = useSearchParams();
  const { openLead } = useQuick();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [stage, setStage] = useState<string>(params.get("etapa") ?? "");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("leads-view");
      if (saved === "lista" || saved === "kanban") setView(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (params.get("etapa")) setView("lista");
  }, [params]);

  const { data, loading, setData } = useLive(
    async () => must(await supabase().from("leads").select("*, proposals(final_price,status)").order("position", { ascending: false })) as LeadRow[],
    [],
    ["leads", "proposals"],
  );

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (l) =>
          (!source || l.source === source) &&
          (!stage || l.status === stage) &&
          `${l.name} ${l.city ?? ""} ${l.phone ?? ""} ${l.email ?? ""}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [data, q, source, stage],
  );

  const move = async (id: string, status: LeadStatus) => {
    const lead = data?.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    setData((rows) => rows?.map((l) => (l.id === id ? { ...l, status, position: Date.now() / 1000 } : l)) ?? null);
    const { error } = await supabase().from("leads").update({ status, position: Date.now() / 1000 }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`${lead.name} → ${stageOf(status).label}`);
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Leads"
        subtitle={data ? `${data.length} ${data.length === 1 ? "cliente" : "clientes"} no funil` : " "}
        actions={
          <>
            <Segmented
              value={view}
              onChange={(v) => {
                setView(v);
                try {
                  localStorage.setItem("leads-view", v);
                } catch {}
              }}
              options={[
                { value: "kanban", label: <><LayoutGrid className="h-3.5 w-3.5" /> Funil</> },
                { value: "lista", label: <><List className="h-3.5 w-3.5" /> Lista</> },
              ]}
            />
            <Button onClick={() => openLead()}>
              <Plus className="h-4 w-4" /> Novo lead
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, cidade, telefone ou e-mail" className="pl-10" />
        </div>
        <div className="flex gap-2">
          {view === "lista" && (
            <Select value={stage} onChange={(e) => setStage(e.target.value)} className="sm:w-48">
              <option value="">Todas as etapas</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
          <Select value={source} onChange={(e) => setSource(e.target.value)} className="sm:w-44">
            <option value="">Todas as origens</option>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <Empty
            icon={<Users className="h-6 w-6" />}
            title="Seu funil está vazio"
            text="Cadastre seu primeiro lead ou compartilhe o formulário de captura no seu site e Instagram."
            action={<Button onClick={() => openLead()}>Cadastrar lead</Button>}
          />
        </Card>
      ) : view === "kanban" ? (
        <Kanban leads={filtered} onMove={move} />
      ) : (
        <LeadTable leads={filtered} />
      )}
    </div>
  );
}

function leadValue(l: LeadRow) {
  const best = Math.max(0, ...l.proposals.filter((p) => p.status !== "recusada").map((p) => Number(p.final_price)));
  return best || Number(l.estimated_value ?? 0);
}

function Kanban({ leads, onMove }: { leads: LeadRow[]; onMove: (id: string, s: LeadStatus) => void }) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-10 lg:snap-none lg:px-10">
      {STAGES.map((s) => {
        const items = leads.filter((l) => l.status === s.id);
        const total = items.reduce((sum, l) => sum + leadValue(l), 0);
        return (
          <div
            key={s.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/lead");
              if (id) onMove(id, s.id);
            }}
            className={cx(
              "flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-3xl bg-ink-100/70 p-2 transition sm:w-[290px]",
              over === s.id && "bg-sun-100/70 ring-2 ring-sun-400",
            )}
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-3">
              <div className="flex items-center gap-2">
                <span className={cx("h-2 w-2 rounded-full", s.dot)} />
                <p className="text-[13px] font-semibold text-ink-800">{s.label}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500">{items.length}</span>
              </div>
              {total > 0 && <p className="tnum text-[11px] font-semibold text-ink-500">{brl(total, 0)}</p>}
            </div>
            <div className="flex min-h-24 flex-col gap-2">
              {items.map((l) => (
                <LeadCard key={l.id} lead={l} onMove={onMove} />
              ))}
              {!items.length && <p className="rounded-2xl border-2 border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">Arraste leads para cá</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead, onMove }: { lead: LeadRow; onMove: (id: string, s: LeadStatus) => void }) {
  const router = useRouter();
  const value = leadValue(lead);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead", lead.id)}
      onClick={() => router.push(`/leads/${lead.id}`)}
      className="group cursor-pointer rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-ink-200/60 transition hover:-translate-y-0.5 hover:shadow-lift active:cursor-grabbing"
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={lead.name} className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-ink-900">
            {lead.name}
            {lead.temperature === "quente" && <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" />}
            {lead.temperature === "frio" && <Snowflake className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
          </p>
          <p className="truncate text-xs text-ink-500">{[lead.city, lead.source].filter(Boolean).join(" · ") || relativeTime(lead.created_at)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-ink-500">
          {lead.consumption_kwh ? (
            <span className="flex items-center gap-1 rounded-md bg-ink-50 px-1.5 py-0.5">
              <Zap className="h-3 w-3 text-sun-600" /> {fmtNum(lead.consumption_kwh)} kWh
            </span>
          ) : null}
          {lead.proposals.length > 0 && <span className="rounded-md bg-ink-50 px-1.5 py-0.5">{lead.proposals.length} prop.</span>}
        </div>
        {value > 0 && <p className="tnum text-[13px] font-semibold text-ink-900">{brl(value, 0)}</p>}
      </div>
      {/* Mudança de etapa no celular (sem arrastar) */}
      <select
        value={lead.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onMove(lead.id, e.target.value as LeadStatus)}
        className="mt-3 w-full rounded-lg bg-ink-50 px-2 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200/60 lg:hidden"
        aria-label="Mover para etapa"
      >
        {STAGES.map((s) => (
          <option key={s.id} value={s.id}>
            Mover para: {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LeadTable({ leads }: { leads: LeadRow[] }) {
  if (!leads.length) return <Card><Empty icon={<Search className="h-6 w-6" />} title="Nenhum lead encontrado" text="Ajuste a busca ou os filtros." /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 border-b border-ink-100 bg-ink-50/60 px-5 py-3 text-xs font-semibold text-ink-500 md:grid">
        <span>Cliente</span>
        <span>Contato</span>
        <span>Etapa</span>
        <span>Consumo</span>
        <span className="text-right">Valor</span>
      </div>
      <ul className="divide-y divide-ink-100">
        {leads.map((l) => {
          const st = stageOf(l.status);
          const value = leadValue(l);
          return (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition hover:bg-ink-50/60 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_120px] md:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={l.name} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      {l.name} {l.temperature === "quente" && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-ink-500">
                      {l.city && <MapPin className="h-3 w-3" />}
                      {[l.city, l.source].filter(Boolean).join(" · ")} · {relativeTime(l.created_at)}
                    </p>
                  </div>
                </div>
                <p className="hidden truncate text-sm text-ink-600 md:flex md:items-center md:gap-1.5">
                  {l.phone && <Phone className="h-3.5 w-3.5 text-ink-400" />}
                  {formatPhone(l.phone) || l.email || "—"}
                </p>
                <span className="hidden md:block">
                  <Badge className={st.soft} dot={st.dot}>
                    {st.label}
                  </Badge>
                </span>
                <p className="tnum hidden text-sm text-ink-600 md:block">{l.consumption_kwh ? `${fmtNum(l.consumption_kwh)} kWh` : "—"}</p>
                <div className="text-right">
                  <p className="tnum text-sm font-semibold">{value ? brl(value, 0) : "—"}</p>
                  <span className="md:hidden">
                    <Badge className={cx("mt-1 !text-[10px]", st.soft)}>{st.label}</Badge>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
