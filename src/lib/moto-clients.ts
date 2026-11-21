/**
 * Clientes da Mobilidade: junta as vendas de scooter por comprador (CPF/CNPJ, ou
 * telefone, ou nome) para a aba Clientes ter uma ficha por pessoa.
 */
import { digits } from "./br.ts";
import { closedAt, saleStage, warrantyOf, type BoardDoc } from "./moto-board.ts";
import type { MotoData } from "./moto-sale.ts";

export type SaleLike = BoardDoc;

/** garantia: comprou e está na garantia (ou ela começa na entrega) · cliente: comprou, garantia encerrada · assinatura / orcamento: ainda negociando. */
export type ClientStage = "garantia" | "cliente" | "assinatura" | "orcamento";

export interface MotoClient {
  key: string;
  name: string;
  doc: string;
  phone: string;
  email: string;
  city: string;
  leadId: string | null;
  sales: SaleLike[];
  /** Situação mais importante do cliente. */
  stage: ClientStage;
  /** Dias restantes da garantia mais longa em vigor (ou do prazo que começa na entrega). */
  warrantyLeft: number;
  bought: number;
  total: number;
  lastAt: string;
}

export const clientKey = (d: Pick<MotoData, "client">) => {
  const doc = digits(d.client.doc);
  if (doc.length >= 11) return `doc:${doc}`;
  const phone = digits(d.client.phone);
  if (phone.length >= 10) return `tel:${phone.slice(-9)}`;
  return `nome:${d.client.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
};

const RANK: Record<ClientStage, number> = { assinatura: 0, garantia: 1, orcamento: 2, cliente: 3 };

export function groupClients(sales: SaleLike[], value: (d: MotoData) => number, now = new Date()): MotoClient[] {
  const map = new Map<string, MotoClient>();
  for (const s of sales) {
    if (s.status === "cancelado") continue;
    const d = s.data as MotoData;
    if (!d?.client || !d.client.name?.trim()) continue;
    const key = clientKey(d);
    const st = saleStage(s);
    const w = st === "vendida" ? warrantyOf(d, now) : null;
    const stage: ClientStage = st === "vendida" ? (w!.state === "encerrada" ? "cliente" : "garantia") : st === "aguardando" ? "assinatura" : "orcamento";
    const left = w && w.state !== "encerrada" ? w.left : 0;
    const at = st === "vendida" ? closedAt(s) : s.updated_at;
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
        bought: st === "vendida" ? 1 : 0,
        total: st === "vendida" ? value(d) : 0,
        lastAt: at,
      });
      continue;
    }
    c.sales.push(s);
    if (RANK[stage] < RANK[c.stage]) c.stage = stage;
    c.warrantyLeft = Math.max(c.warrantyLeft, left);
    if (st === "vendida") {
      c.bought += 1;
      c.total += value(d);
    }
    if (at > c.lastAt) {
      c.lastAt = at;
      // Dados mais recentes valem (telefone ou endereço atualizados).
      c.phone = d.client.phone || c.phone;
      c.email = d.client.email || c.email;
      c.city = [d.client.city, d.client.state].filter(Boolean).join("/") || c.city;
    }
    c.leadId = c.leadId ?? s.lead_id ?? null;
  }
  for (const c of map.values()) {
    // Vendas primeiro, depois aguardando assinatura e por último os orçamentos (mais recentes antes).
    const order = { vendida: 0, aguardando: 1, orcamento: 2 } as const;
    c.sales.sort((a, b) => order[saleStage(a)] - order[saleStage(b)] || b.updated_at.localeCompare(a.updated_at));
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
    "Na sua área do cliente estão o contrato, o manual completo e o cartão do proprietário da sua scooter, para guardar no celular ou imprimir:",
    url,
    "",
    "Para entrar, use o seu CPF e os 4 últimos dígitos deste celular.",
  ].join("\n");
}

/** Endereço da ficha do cliente no CRM. */
export const clientHref = (key: string) => `/mobilidade/cliente/${encodeURIComponent(key)}`;
