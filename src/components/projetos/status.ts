import { PROJECT_STATUS, type ProjectFiles, type ProjectStatus } from "@/lib/solar-project";

export interface ProjectRow {
  id: string;
  lead_id: string | null;
  proposal_id: string | null;
  title: string;
  status: ProjectStatus;
  data: unknown;
  files: ProjectFiles;
  created_at: string;
  updated_at: string;
}

const STATUS_CLS: Record<ProjectStatus, string> = {
  rascunho: "bg-ink-100 text-ink-700 ring-ink-200",
  pronto: "bg-sky-50 text-sky-700 ring-sky-200",
  enviado: "bg-amber-50 text-amber-800 ring-amber-200",
  aprovado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  vistoria: "bg-violet-50 text-violet-700 ring-violet-200",
  concluido: "bg-emerald-600 text-white ring-emerald-600",
};
export const statusLabel = (s: ProjectStatus) => PROJECT_STATUS.find((x) => x.id === s)?.label ?? s;
export const statusCls = (s: ProjectStatus) => STATUS_CLS[s] ?? STATUS_CLS.rascunho;
