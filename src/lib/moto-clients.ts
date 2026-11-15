/**
 * Clientes da Mobilidade: junta as vendas de scooter por comprador (CPF/CNPJ, ou
 * telefone, ou nome) para a aba Clientes ter uma ficha por pessoa.
 */
import { digits } from "./br.ts";
import { warrantyEnd, type MotoData } from "./moto-sale.ts";

export interface SaleLike {
  id: string;
  status: "rascunho" | "enviado" | "assinado" | "cancelado";
  data: unknown;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  lead_id?: string | null;
}

export type ClientStage = "garantia" | "assinatura" | "orcamento" | "encerrada";

export interface MotoClient {
  key: string;
  name: string;
  doc: string;
  phone: string;
  email: string;
  city: string;
  leadId: string | null;
  sales: SaleLike[];
  /** Situação mais importante do cliente (garantia ativa > aguardando assinatura > orçamento > garantia encerrada). */
  stage: ClientStage;
  /** Dias restantes da garantia mais longa em vigor. */
  warrantyLeft: number;
  total: number;
  lastAt: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const atNoon = (s: string) => new Date(`${s}T12:00:00`).getTime();

export const clientKey = (d: Pick<MotoData, "client">) => {
  const doc = digits(d.client.doc);
  if (doc.length >= 11) return `doc:${doc}`;
  const phone = digits(d.client.phone);
  if (phone.length >= 10) return `tel:${phone.slice(-9)}`;
  return `nome:${d.client.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
};

/** Dias restantes de garantia (0 = sem garantia em vigor). */
export function warrantyDaysLeft(d: MotoData, signed: boolean, now = new Date()) {
  if (!signed) return 0;
  const start = d.delivery.date || d.date;
  const end = warrantyEnd(d);
  if (!start || !end) return 0;
  const today = atNoon(iso(now));
  if (today < atNoon(start)) return Number(d.warrantyDays) || 0;
  return Math.max(0, Math.round((atNoon(end) - today) / 86_400_000));
}

const RANK: Record<ClientStage, number> = { garantia: 0, assinatura: 1, orcamento: 2, encerrada: 3 };

export function groupClients(sales: SaleLike[], value: (d: MotoData) => number, now = new Date()): MotoClient[] {
  const map = new Map<string, MotoClient>();
  for (const s of sales) {
    if (s.status === "cancelado") continue;
    const d = s.data as MotoData;
    if (!d?.client || !d.client.name?.trim()) continue;
    const key = clientKey(d);
    const signed = s.status === "assinado";
    const left = warrantyDaysLeft(d, signed, now);
    const stage: ClientStage = signed ? (left > 0 ? "garantia" : "encerrada") : s.status === "enviado" ? "assinatura" : "orcamento";
    const at = s.completed_at ?? s.updated_at;
    const c = map.get(key);
    if (!c) {
      map.set(key, {
        key,
        name: d.client.name.trim(),
        doc: d.client.doc,
        phone: d.client.phone,
        email: d.client.email,
        city: [d.client.city, d.client.state].filter(Boolean).join("/"),
        leadId: s.lead_id ?? null,
        sales: [s],
        stage,
        warrantyLeft: left,
        total: signed ? value(d) : 0,
        lastAt: at,
      });
      continue;
    }
    c.sales.push(s);
    if (RANK[stage] < RANK[c.stage]) c.stage = stage;
    c.warrantyLeft = Math.max(c.warrantyLeft, left);
    if (signed) c.total += value(d);
    if (at > c.lastAt) {
      c.lastAt = at;
      // Dados mais recentes valem (telefone ou endereço atualizados).
      c.phone = d.client.phone || c.phone;
      c.email = d.client.email || c.email;
      c.city = [d.client.city, d.client.state].filter(Boolean).join("/") || c.city;
    }
    c.leadId = c.leadId ?? s.lead_id ?? null;
  }
  return [...map.values()].sort((a, b) => RANK[a.stage] - RANK[b.stage] || b.lastAt.localeCompare(a.lastAt));
}

/** Busca por nome, CPF, telefone, cidade, chassi ou modelo. */
export function matchClient(c: MotoClient, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const n = digits(t);
  const hay = [c.name, c.city, c.email, ...c.sales.map((s) => `${(s.data as MotoData).modelName} ${(s.data as MotoData).chassis} ${(s.data as MotoData).color}`)].join(" ").toLowerCase();
  if (hay.includes(t)) return true;
  return n.length >= 3 && (digits(c.doc).includes(n) || digits(c.phone).includes(n));
}

/** Mensagem de WhatsApp com o acesso à área do cliente. */
export function portalMessage(name: string, url: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return [
    `Olá${first ? `, ${first}` : ""}! Aqui é da Quark Mobilidade.`,
    "",
    "Na sua área do cliente estão o manual, o certificado de garantia, o comprovante de compra, o contrato e o cartão digital da sua scooter para guardar na carteira do celular:",
    url,
    "",
    "Para entrar, use o seu CPF e os 4 últimos dígitos deste celular.",
  ].join("\n");
}
