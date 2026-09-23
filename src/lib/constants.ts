import type { LeadStatus, Priority, ProposalStatus, TaskType } from "./types";

export const STAGES: { id: LeadStatus; label: string; dot: string; soft: string }[] = [
  { id: "novo", label: "Novo lead", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-700 ring-sky-600/15" },
  { id: "contato", label: "Em contato", dot: "bg-indigo-500", soft: "bg-indigo-50 text-indigo-700 ring-indigo-600/15" },
  { id: "visita", label: "Visita técnica", dot: "bg-violet-500", soft: "bg-violet-50 text-violet-700 ring-violet-600/15" },
  { id: "proposta", label: "Proposta enviada", dot: "bg-amber-500", soft: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  { id: "negociacao", label: "Negociação", dot: "bg-orange-500", soft: "bg-orange-50 text-orange-700 ring-orange-600/15" },
  { id: "ganho", label: "Fechado", dot: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  { id: "perdido", label: "Perdido", dot: "bg-rose-500", soft: "bg-rose-50 text-rose-700 ring-rose-600/15" },
];
export const stageOf = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];
export const OPEN_STAGES: LeadStatus[] = ["novo", "contato", "visita", "proposta", "negociacao"];

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-ink-100 text-ink-600 ring-ink-500/15" },
  enviada: { label: "Enviada", cls: "bg-sky-50 text-sky-700 ring-sky-600/15" },
  visualizada: { label: "Visualizada", cls: "bg-violet-50 text-violet-700 ring-violet-600/15" },
  aceita: { label: "Aceita", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  recusada: { label: "Recusada", cls: "bg-rose-50 text-rose-700 ring-rose-600/15" },
};

export const TASK_TYPES: Record<TaskType, string> = {
  tarefa: "Tarefa",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  visita: "Visita",
  email: "E-mail",
  reuniao: "Reunião",
};

export const PRIORITIES: Record<Priority, { label: string; cls: string }> = {
  baixa: { label: "Baixa", cls: "bg-ink-100 text-ink-600 ring-ink-500/15" },
  media: { label: "Média", cls: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  alta: { label: "Alta", cls: "bg-rose-50 text-rose-700 ring-rose-600/15" },
};

export const SOURCES = ["Indicação", "Instagram", "Facebook", "Google", "Site", "WhatsApp", "Porta a porta", "Evento", "Outro"];
export const ROOF_TYPES = ["Telhado cerâmico", "Telhado fibrocimento", "Telhado metálico", "Laje", "Solo", "Carport"];
export const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
