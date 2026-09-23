import type { ConnectionType, ProposalInputs } from "./pricing";

export type LeadStatus = "novo" | "contato" | "visita" | "proposta" | "negociacao" | "ganho" | "perdido";
export type ProposalStatus = "rascunho" | "enviada" | "visualizada" | "aceita" | "recusada";
export type TaskType = "tarefa" | "ligacao" | "whatsapp" | "visita" | "email" | "reuniao";
export type Priority = "baixa" | "media" | "alta";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  source: string | null;
  status: LeadStatus;
  temperature: "frio" | "morno" | "quente" | null;
  consumption_kwh: number | null;
  avg_bill: number | null;
  tariff: number | null;
  connection_type: ConnectionType | null;
  roof_type: string | null;
  estimated_value: number | null;
  lost_reason: string | null;
  notes: string | null;
  owner_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  number: number;
  lead_id: string;
  title: string | null;
  status: ProposalStatus;
  inputs: Partial<ProposalInputs>;
  power_kwp: number;
  monthly_generation: number;
  direct_cost: number;
  commission_value: number;
  tax_value: number;
  profit_value: number;
  final_price: number;
  public_token: string;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  view_count: number;
  accepted_at: string | null;
  accepted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lead?: Pick<Lead, "id" | "name" | "city" | "phone"> | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: Priority;
  due_at: string | null;
  done: boolean;
  done_at: string | null;
  lead_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  lead?: Pick<Lead, "id" | "name"> | null;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_by: string | null;
  created_at: string;
}
