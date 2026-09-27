"use client";

import { ArrowDown, ArrowUp, Mail, MessageCircle, Paperclip, Phone, Plus, RotateCcw, Trash2, Users, Wrench, Zap, CalendarCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CADENCE_STAGES, CADENCE_VARS, DEFAULT_CADENCE, renderCopy, whenLabel, type CadencePrefs, type CadenceStep } from "@/lib/cadence";
import { PRIORITIES, TASK_TYPES, stageOf } from "@/lib/constants";
import type { LeadStatus, Priority, TaskType } from "@/lib/types";
import { useApp } from "./app-context";
import { Button, Card, CardHeader, Field, Input, Select, Switch, Textarea, cx } from "../ui";

const TYPE_ICON: Record<TaskType, ReactNode> = {
  whatsapp: <MessageCircle className="h-4 w-4" />,
  ligacao: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  visita: <Users className="h-4 w-4" />,
  reuniao: <CalendarCheck className="h-4 w-4" />,
  tarefa: <Wrench className="h-4 w-4" />,
};

const uid = () => Math.random().toString(36).slice(2, 9);

/** Configurações → Cadências: os passos automáticos de cada etapa do funil e as mensagens prontas. */
export function CadenceTab({ value, onChange }: { value: CadencePrefs; onChange: (v: CadencePrefs) => void }) {
  const { profile, settings } = useApp();
  const [stage, setStage] = useState<LeadStatus>("novo");
  const [editing, setEditing] = useState<string | null>(null);
  const steps = value.stages[stage] ?? [];
  const meta = CADENCE_STAGES.find((s) => s.id === stage)!;

  const setSteps = (list: CadenceStep[]) => onChange({ ...value, stages: { ...value.stages, [stage]: list } });
  const patch = (id: string, p: Partial<CadenceStep>) => setSteps(steps.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const list = [...steps];
    [list[i], list[j]] = [list[j], list[i]];
    setSteps(list);
  };
  const add = () => {
    const last = steps[steps.length - 1];
    const step: CadenceStep = { id: `${stage}-${uid()}`, day: last ? last.day + 2 : 0, hour: last ? 10 : null, type: "whatsapp", priority: "media", title: "Novo follow-up", copy: "Olá, {nome}! " };
    setSteps([...steps, step]);
    setEditing(step.id);
  };
  const sample = (text: string) => renderCopy(text, { name: "Maria Oliveira", seller: profile?.full_name, company: settings.company_name, segment: "solar", city: "Maceió" });
  const sorted = steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.day - b.s.day || (a.s.hour ?? -1) - (b.s.hour ?? -1));

  return (
    <div className="grid gap-5">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-sun-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-4 p-5 sm:p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink-900 text-brand-yellow shadow-lift">
            <Zap className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">Cadência automática de follow-up</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Quando um lead é criado (inclusive pela página de captura) ou muda de etapa no funil, o CRM cria sozinho as tarefas da etapa, no dia e hora certos, já com a
              mensagem pronta. As tarefas automáticas ainda abertas da etapa anterior saem da agenda — o próximo passo está sempre atualizado.
            </p>
          </div>
          <Switch checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} label={value.enabled ? "Ligada" : "Desligada"} />
        </div>
      </Card>

      <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[220px_minmax(0,1fr)]", !value.enabled && "opacity-60")}>
        {/* Etapas */}
        <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {CADENCE_STAGES.map((s) => {
            const st = stageOf(s.id);
            const n = value.stages[s.id]?.length ?? 0;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setStage(s.id);
                  setEditing(null);
                }}
                className={cx(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition",
                  stage === s.id ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300",
                )}
              >
                <span className={cx("h-2 w-2 rounded-full", st.dot)} />
                {s.label}
                <span className={cx("ml-auto rounded-full px-1.5 text-[11px] tabular-nums", stage === s.id ? "bg-white/15" : "bg-ink-100 text-ink-500")}>{n}</span>
              </button>
            );
          })}
        </nav>

        {/* Linha do tempo */}
        <Card className="min-w-0">
          <CardHeader
            title={`Etapa: ${meta.label}`}
            subtitle={meta.hint}
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Restaurar os passos padrão da etapa "${meta.label}"?`)) setSteps(DEFAULT_CADENCE.stages[stage] ?? []);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Padrão
              </Button>
            }
          />
          <div className="px-4 pb-5 sm:px-6">
            {!steps.length && <p className="rounded-xl bg-ink-50 p-4 text-center text-sm text-ink-500">Nenhum passo automático nesta etapa.</p>}
            <ol className="relative grid grid-cols-[minmax(0,1fr)] gap-3">
              {sorted.length > 1 && <span className="absolute top-5 bottom-5 left-[19px] w-px bg-ink-200" aria-hidden />}
              {sorted.map(({ s, i }) => {
                const open = editing === s.id;
                return (
                  <li key={s.id} className="relative">
                    <div className="flex gap-3">
                      <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink-700 ring-1 ring-ink-200">{TYPE_ICON[s.type]}</span>
                      <div className={cx("min-w-0 flex-1 rounded-2xl ring-1 transition", open ? "bg-white ring-ink-300 shadow-soft" : "bg-ink-50/60 ring-transparent hover:ring-ink-200")}>
                        <button onClick={() => setEditing(open ? null : s.id)} className="flex w-full items-start gap-3 p-3 text-left">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold tracking-wide text-sun-700 uppercase">
                              {whenLabel(s)} · {TASK_TYPES[s.type]}
                              {s.priority === "alta" && <span className="text-rose-600"> · alta</span>}
                            </p>
                            <p className="truncate text-sm font-semibold text-ink-900">{s.title}</p>
                            {!open && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{sample(s.copy)}</p>}
                          </div>
                        </button>
                        {open && (
                          <div className="grid gap-3 border-t border-ink-100 p-3">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <Field label="Dia">
                                <Input type="number" min={0} max={365} value={s.day} onChange={(e) => {
                                    const day = Math.max(0, Math.min(365, Number(e.target.value) || 0));
                                    patch(s.id, { day, hour: day > 0 && s.hour == null ? 10 : s.hour });
                                  }} />
                              </Field>
                              <Field label="Horário">
                                <Select value={s.hour == null ? "" : String(s.hour)} onChange={(e) => patch(s.id, { hour: e.target.value === "" ? null : Number(e.target.value) })}>
                                  {s.day === 0 && <option value="">Na hora</option>}
                                  {Array.from({ length: 15 }, (_, h) => h + 7).map((h) => (
                                    <option key={h} value={h}>
                                      {h}h
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Tipo">
                                <Select value={s.type} onChange={(e) => patch(s.id, { type: e.target.value as TaskType })}>
                                  {(Object.keys(TASK_TYPES) as TaskType[]).map((t) => (
                                    <option key={t} value={t}>
                                      {TASK_TYPES[t]}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Prioridade">
                                <Select value={s.priority} onChange={(e) => patch(s.id, { priority: e.target.value as Priority })}>
                                  {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                                    <option key={p} value={p}>
                                      {PRIORITIES[p].label}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                            <Field label="Título da tarefa">
                              <Input value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} />
                            </Field>
                            <Field label={s.type === "ligacao" || s.type === "tarefa" ? "Roteiro / mensagem" : "Mensagem pronta (copy)"}>
                              <Textarea value={s.copy} onChange={(e) => patch(s.id, { copy: e.target.value })} className="min-h-[120px]" />
                            </Field>
                            <div className="flex flex-wrap gap-1.5">
                              {CADENCE_VARS.map((v) => (
                                <button
                                  key={v.key}
                                  type="button"
                                  title={v.label}
                                  onClick={() => patch(s.id, { copy: `${s.copy}${s.copy.endsWith(" ") || !s.copy ? "" : " "}${v.key}` })}
                                  className="rounded-full bg-ink-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-600 hover:bg-ink-200"
                                >
                                  {v.key}
                                </button>
                              ))}
                            </div>
                            <div className="rounded-2xl rounded-tl-md bg-[#E7F8EE] p-3 text-[13px] leading-relaxed whitespace-pre-line text-ink-800 ring-1 ring-emerald-200/70">
                              <p className="mb-1 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">Prévia para “Maria Oliveira”</p>
                              {sample(s.copy)}
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                              <Field label="Atalho na tarefa">
                                <Select value={s.action ?? ""} onChange={(e) => patch(s.id, { action: (e.target.value || null) as CadenceStep["action"] })}>
                                  <option value="">Nenhum</option>
                                  <option value="procuracao">Gerar procuração</option>
                                  <option value="proposta">Criar proposta</option>
                                </Select>
                              </Field>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Subir">
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Descer">
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))} aria-label="Remover passo">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button variant="secondary" className="mt-4 w-full" onClick={add}>
              <Plus className="h-4 w-4" /> Adicionar passo
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Material gráfico"
          subtitle="Catálogo, apresentação, vídeos de depoimento e fotos de obras. Anexe com um toque nas mensagens das tarefas."
          icon={<Paperclip className="h-4 w-4" />}
        />
        <div className="grid gap-2 px-4 pb-5 sm:px-6">
          {value.materials.map((m, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-2">
              <Input value={m.title} placeholder="Nome (ex.: Catálogo)" onChange={(e) => onChange({ ...value, materials: value.materials.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <Input value={m.url} placeholder="https://…" onChange={(e) => onChange({ ...value, materials: value.materials.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)) })} />
              <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => onChange({ ...value, materials: value.materials.filter((_, j) => j !== i) })} aria-label="Remover material">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => onChange({ ...value, materials: [...value.materials, { title: "", url: "" }] })}>
            <Plus className="h-4 w-4" /> Adicionar material
          </Button>
          <p className="text-xs text-ink-500">Dica: suba o PDF no Google Drive (compartilhado com “qualquer pessoa com o link”) e cole o endereço aqui.</p>
        </div>
      </Card>
    </div>
  );
}
