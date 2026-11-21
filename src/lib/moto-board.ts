/**
 * Situação de cada venda de scooter e da garantia, numa regra só para todas as
 * abas da Mobilidade (Início, Vendas, Clientes e Garantias).
 *
 * Venda fechada = o COMPRADOR assinou (ou o documento está todo assinado). Testemunha
 * que ainda não assinou não deixa a venda "aguardando".
 */
import { warrantyEnd, type MotoData } from "./moto-sale.ts";

export type SaleStage = "orcamento" | "aguardando" | "vendida";
export type WarrantyState = "ativa" | "entrega" | "encerrada";

export interface BoardDoc {
  id: string;
  status: "rascunho" | "enviado" | "assinado" | "cancelado" | "registrada";
  data: unknown;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  lead_id?: string | null;
  signers?: { role: string; signed_at: string | null; selfie_at?: string | null }[];
}

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00`).getTime();

export const buyerOf = (doc: BoardDoc) => (doc.signers ?? []).find((s) => s.role === "comprador") ?? null;
export const saleData = (doc: BoardDoc) => doc.data as MotoData;

export function saleStage(doc: BoardDoc): SaleStage {
  // Venda registrada direto no CRM continua vendida mesmo se depois gerar contrato para assinar.
  if (doc.status === "assinado" || doc.status === "registrada" || (doc.data as { registeredAt?: string } | null)?.registeredAt || buyerOf(doc)?.signed_at) return "vendida";
  // Link do contrato gerado = venda fechada; a assinatura que falta vira só um aviso (signaturePending).
  if (doc.status === "enviado") return "vendida";
  return "orcamento";
}

/** Contrato enviado que o comprador ainda não assinou (a venda já conta como fechada). */
export const signaturePending = (doc: BoardDoc) => doc.status === "enviado" && !buyerOf(doc)?.signed_at;

/** Data em que a venda fechou: assinatura do comprador, conclusão, data do contrato ou última alteração. */
export const closedAt = (doc: BoardDoc) => {
  const date = (doc.data as { date?: string } | null)?.date;
  return buyerOf(doc)?.signed_at ?? doc.completed_at ?? (date ? `${date}T12:00:00` : doc.updated_at);
};

export interface WarrantyInfo {
  state: WarrantyState;
  start: string;
  end: string;
  left: number;
  total: number;
  /** 0 a 1: quanto do prazo ainda resta. */
  remaining: number;
}

/** Garantia de uma venda fechada. A contagem começa na entrega (ou na data da venda, se não houver entrega). */
export function warrantyOf(d: MotoData, now = new Date()): WarrantyInfo {
  const total = Math.max(1, Number(d.warrantyDays) || 90);
  // Entrega em casa ainda sem data: a garantia só começa quando a scooter chegar.
  if (d.delivery?.mode === "entrega" && !d.delivery.date) return { state: "entrega", start: "", end: "", left: total, total, remaining: 1 };
  const start = d.delivery?.date || d.date || "";
  const end = start ? warrantyEnd(d) : "";
  const today = noon(isoDay(now));
  if (!start || !end) return { state: "entrega", start: "", end: "", left: total, total, remaining: 1 };
  if (today < noon(start)) return { state: "entrega", start, end, left: total, total, remaining: 1 };
  const left = Math.max(0, Math.round((noon(end) - today) / DAY));
  return { state: left > 0 ? "ativa" : "encerrada", start, end, left, total, remaining: Math.min(1, left / total) };
}

export type TodoKind = "assinatura" | "selfie" | "entrega" | "chassi" | "vencendo" | "parado";

export interface Todo {
  kind: TodoKind;
  doc: BoardDoc;
}

/** Pendências da Mobilidade, da mais urgente para a menos. */
export function todos(docs: BoardDoc[], now = new Date()): Todo[] {
  const out: Todo[] = [];
  for (const doc of docs) {
    if (doc.status === "cancelado") continue;
    const d = saleData(doc);
    if (!d?.client) continue;
    const stage = saleStage(doc);
    if (signaturePending(doc)) out.push({ kind: "assinatura", doc });
    if (stage === "orcamento" && now.getTime() - new Date(doc.updated_at).getTime() > 7 * DAY && now.getTime() - new Date(doc.updated_at).getTime() < 60 * DAY) out.push({ kind: "parado", doc });
    if (stage !== "vendida") continue;
    const buyer = buyerOf(doc);
    if (buyer?.signed_at && !buyer.selfie_at) out.push({ kind: "selfie", doc });
    if (!d.delivery?.date) out.push({ kind: "entrega", doc });
    if (!d.chassis?.trim()) out.push({ kind: "chassi", doc });
    const w = warrantyOf(d, now);
    if (w.state === "ativa" && w.left <= 15) out.push({ kind: "vencendo", doc });
  }
  const order: TodoKind[] = ["assinatura", "entrega", "chassi", "selfie", "vencendo", "parado"];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.doc.updated_at.localeCompare(a.doc.updated_at));
}
