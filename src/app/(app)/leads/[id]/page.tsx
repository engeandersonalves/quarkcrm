"use client";

import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Eye,
  FileText,
  Flame,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { useQuick } from "@/components/app/shell";
import { TaskRow } from "@/components/app/task-row";
import { Avatar, Badge, Button, Card, CardHeader, Empty, Input, Textarea, cx } from "@/components/ui";
import { PROPOSAL_STATUS, STAGES, stageOf } from "@/lib/constants";
import { formatDateTime, formatPhone, relativeTime, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { Activity, Lead, LeadStatus, Proposal, Task } from "@/lib/types";

interface Data {
  lead: Lead | null;
  proposals: Proposal[];
  tasks: Task[];
  activities: Activity[];
}

const ACTIVITY_TYPES = [
  { id: "nota", label: "Nota", icon: MessageSquare },
  { id: "ligacao", label: "Ligação", icon: PhoneCall },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "visita", label: "Visita", icon: MapPin },
];

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profiles } = useApp();
  const { openLead, openTask } = useQuick();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("nota");
  const [lostReason, setLostReason] = useState("");
  const [askLost, setAskLost] = useState(false);

  const { data, loading } = useLive<Data>(
    async () => {
      const sb = supabase();
      const [lead, proposals, tasks, activities] = await Promise.all([
        sb.from("leads").select("*").eq("id", id).maybeSingle(),
        sb.from("proposals").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        sb.from("tasks").select("*").eq("lead_id", id).order("done").order("due_at", { ascending: true, nullsFirst: false }),
        sb.from("activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
      ]);
      return { lead: must(lead) as Lead | null, proposals: must(proposals) as Proposal[], tasks: must(tasks) as Task[], activities: must(activities) as Activity[] };
    },
    [id],
    ["leads", "proposals", "tasks", "activities"],
  );

  if (loading && !data)
    return (
      <div className="grid h-[60vh] place-items-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  const lead = data?.lead;
  if (!lead) return <Empty icon={<FileText className="h-6 w-6" />} title="Lead não encontrado" action={<Link href="/leads"><Button>Voltar</Button></Link>} />;

  const stage = stageOf(lead.status);
  const owner = profiles.find((p) => p.id === lead.owner_id);

  const setStatus = async (status: LeadStatus, reason?: string) => {
    if (status === "perdido" && reason === undefined) {
      setAskLost(true);
      return;
    }
    const { error } = await supabase()
      .from("leads")
      .update({ status, lost_reason: status === "perdido" ? reason || null : lead.lost_reason })
      .eq("id", lead.id);
    if (error) return toast.error(error.message);
    setAskLost(false);
    toast.success(`Etapa: ${stageOf(status).label}`);
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    const { error } = await supabase().from("activities").insert({ lead_id: lead.id, type: noteType, content: note.trim(), created_by: user.id });
    if (error) return toast.error(error.message);
    setNote("");
  };

  const remove = async () => {
    if (!confirm(`Excluir ${lead.name} e todas as propostas, tarefas e histórico? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase().from("leads").delete().eq("id", lead.id);
    if (error) return toast.error(error.message);
    toast.success("Lead excluído");
    router.replace("/leads");
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-start gap-3">
        <Link href="/leads" className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-500 shadow-soft ring-1 ring-ink-200 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={lead.name} className="hidden h-14 w-14 text-base sm:grid" />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate font-display text-2xl font-semibold tracking-tight">
                {lead.name} {lead.temperature === "quente" && <Flame className="h-5 w-5 text-orange-500" />}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
                <Badge className={stage.soft} dot={stage.dot}>
                  {stage.label}
                </Badge>
                {lead.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {[lead.city, lead.state].filter(Boolean).join(" – ")}
                  </span>
                )}
                <span>Criado {relativeTime(lead.created_at)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {lead.phone && (
              <>
                <a href={whatsappUrl(lead.phone, `Olá, ${lead.name.split(" ")[0]}! Tudo bem?`)} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="text-emerald-700">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
                <a href={`tel:${lead.phone}`}>
                  <Button variant="secondary" size="icon" aria-label="Ligar">
                    <Phone className="h-4 w-4" />
                  </Button>
                </a>
              </>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`}>
                <Button variant="secondary" size="icon" aria-label="E-mail">
                  <Mail className="h-4 w-4" />
                </Button>
              </a>
            )}
            <Button variant="secondary" size="icon" onClick={() => openLead(lead)} aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Link href={`/propostas/nova?lead=${lead.id}`}>
              <Button variant="sun">
                <Calculator className="h-4 w-4" /> Novo orçamento
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Etapas */}
      <Card className="mb-5 p-2">
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {STAGES.map((s, i) => {
            const currentIdx = STAGES.findIndex((x) => x.id === lead.status);
            const active = s.id === lead.status;
            const passed = lead.status !== "perdido" && i < currentIdx && s.id !== "perdido";
            return (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={cx(
                  "flex h-10 min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold whitespace-nowrap transition",
                  active ? (s.id === "perdido" ? "bg-rose-600 text-white" : s.id === "ganho" ? "bg-emerald-600 text-white" : "bg-ink-900 text-white") : passed ? "bg-ink-100 text-ink-700" : "text-ink-400 hover:bg-ink-50 hover:text-ink-700",
                )}
              >
                {passed && <CheckCircle2 className="h-3.5 w-3.5" />}
                {s.label}
              </button>
            );
          })}
        </div>
        {askLost && (
          <div className="animate-fade-up flex flex-col gap-2 border-t border-ink-100 p-3 sm:flex-row">
            <Input autoFocus value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Motivo da perda (ex.: preço, concorrente, desistiu)" />
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => setStatus("perdido", lostReason)}>
                Marcar como perdido
              </Button>
              <Button variant="ghost" onClick={() => setAskLost(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          {/* Propostas */}
          <Card>
            <CardHeader
              title="Orçamentos"
              subtitle={data.proposals.length ? `${data.proposals.length} gerado${data.proposals.length > 1 ? "s" : ""}` : undefined}
              action={
                <Link href={`/propostas/nova?lead=${lead.id}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-3.5 w-3.5" /> Orçamento
                  </Button>
                </Link>
              }
            />
            {!data.proposals.length ? (
              <Empty icon={<Calculator className="h-6 w-6" />} title="Nenhum orçamento ainda" text="Monte o orçamento e envie a proposta pelo WhatsApp em segundos." />
            ) : (
              <ul className="divide-y divide-ink-100 border-t border-ink-100">
                {data.proposals.map((p) => (
                  <li key={p.id}>
                    <Link href={`/propostas/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50/60">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sun-50 font-display text-xs font-bold text-sun-700 ring-1 ring-sun-200/70">#{p.number}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{p.title || `${fmtNum(p.power_kwp, 2)} kWp`}</p>
                          <Badge className={PROPOSAL_STATUS[p.status].cls}>{PROPOSAL_STATUS[p.status].label}</Badge>
                        </div>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                          {fmtNum(p.power_kwp, 2)} kWp · {(p.inputs.moduleQty as number) ?? 0} placas · {relativeTime(p.created_at)}
                          {p.view_count > 0 && (
                            <span className="flex items-center gap-1 text-violet-600">
                              <Eye className="h-3 w-3" /> {p.view_count}×
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tnum font-display font-semibold">{brl(p.final_price)}</p>
                        <p className="tnum text-xs text-emerald-600">lucro {brl(p.profit_value, 0)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Histórico */}
          <Card>
            <CardHeader title="Histórico" subtitle="Registre ligações, conversas e visitas" />
            <form onSubmit={addNote} className="px-5 pb-5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {ACTIVITY_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setNoteType(t.id)}
                    className={cx("flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition", noteType === t.id ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200")}
                  >
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="O que aconteceu? Ex.: cliente pediu para retornar na sexta…"
                  className="min-h-[72px] pr-14"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(e);
                  }}
                />
                <Button type="submit" size="icon" className="absolute right-2 bottom-2" disabled={!note.trim()} aria-label="Registrar">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
            <ol className="relative border-t border-ink-100 px-5 py-5">
              {!data.activities.length && <p className="py-6 text-center text-sm text-ink-400">Nada registrado ainda.</p>}
              {data.activities.map((a, i) => {
                const author = profiles.find((p) => p.id === a.created_by);
                return (
                  <li key={a.id} className="group relative flex gap-3 pb-5 last:pb-0">
                    {i < data.activities.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-ink-200" />}
                    <ActivityIcon type={a.type} />
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-sm whitespace-pre-line text-ink-800">{activityText(a)}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {author?.full_name ?? (a.created_by ? "Equipe" : "Sistema")} · {formatDateTime(a.created_at)}
                      </p>
                    </div>
                    {a.type !== "etapa" && a.created_by === user.id && (
                      <button
                        onClick={async () => {
                          await supabase().from("activities").delete().eq("id", a.id);
                        }}
                        className="h-7 w-7 shrink-0 rounded-lg text-ink-300 transition hover:bg-ink-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Apagar"
                      >
                        <Trash2 className="mx-auto h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {/* Tarefas */}
          <Card>
            <CardHeader
              title="Tarefas"
              action={
                <Button size="sm" variant="secondary" onClick={() => openTask({ leadId: lead.id })}>
                  <Plus className="h-3.5 w-3.5" /> Tarefa
                </Button>
              }
            />
            <div className="px-2 pb-3">
              {!data.tasks.length ? (
                <p className="px-3 pb-3 text-sm text-ink-400">Nenhuma tarefa. Agende o próximo contato!</p>
              ) : (
                data.tasks.map((t) => <TaskRow key={t.id} task={t} showLead={false} />)
              )}
            </div>
          </Card>

          {/* Dados */}
          <Card>
            <CardHeader title="Dados do cliente" action={<button onClick={() => openLead(lead)} className="text-[13px] font-semibold text-sun-700">Editar</button>} />
            <dl className="grid gap-3 px-5 pb-5 text-sm">
              <Info label="Telefone" value={formatPhone(lead.phone)} />
              <Info label="E-mail" value={lead.email} />
              <Info label="Endereço" value={lead.address} />
              <Info label="Origem" value={lead.source} />
              <Info label="Responsável" value={owner?.full_name ?? owner?.email} />
              <div className="my-1 h-px bg-ink-100" />
              <Info label="Consumo médio" value={lead.consumption_kwh ? `${fmtNum(lead.consumption_kwh)} kWh/mês` : null} icon={<Zap className="h-3.5 w-3.5 text-sun-600" />} />
              <Info label="Conta média" value={lead.avg_bill ? brl(lead.avg_bill) : null} />
              <Info label="Ligação" value={lead.connection_type ? { mono: "Monofásica", bi: "Bifásica", tri: "Trifásica" }[lead.connection_type] : null} />
              <Info label="Telhado" value={lead.roof_type} />
              {lead.lost_reason && <Info label="Motivo da perda" value={lead.lost_reason} />}
              {lead.notes && (
                <div className="mt-1 rounded-xl bg-sun-50 p-3 text-[13px] whitespace-pre-line text-ink-700 ring-1 ring-sun-200/60">{lead.notes}</div>
              )}
            </dl>
          </Card>

          <button onClick={remove} className="flex items-center justify-center gap-2 rounded-xl py-2 text-[13px] font-medium text-ink-400 hover:text-rose-600">
            <Trash2 className="h-3.5 w-3.5" /> Excluir lead
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium text-ink-900">
        {value ? (
          <>
            {icon}
            {value}
          </>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </dd>
    </div>
  );
}

function activityText(a: Activity) {
  if (a.type === "etapa") {
    const [from, to] = a.content.split("→");
    return `Etapa alterada: ${stageOf(from).label} → ${stageOf(to).label}`;
  }
  return a.content;
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { icon: typeof MessageSquare; cls: string }> = {
    nota: { icon: MessageSquare, cls: "bg-ink-100 text-ink-600" },
    ligacao: { icon: PhoneCall, cls: "bg-sky-50 text-sky-600" },
    whatsapp: { icon: MessageCircle, cls: "bg-emerald-50 text-emerald-600" },
    visita: { icon: MapPin, cls: "bg-violet-50 text-violet-600" },
    proposta: { icon: FileText, cls: "bg-sun-50 text-sun-600" },
    etapa: { icon: CheckCircle2, cls: "bg-ink-900 text-white" },
  };
  const { icon: Icon, cls } = map[type] ?? map.nota;
  return (
    <div className={cx("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white", cls)}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}
