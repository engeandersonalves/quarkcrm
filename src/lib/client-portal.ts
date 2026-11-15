/**
 * Portal do cliente: tipos da resposta, máscaras dos campos de entrada,
 * situação da garantia e o texto da indicação de amigo.
 */
import { digits } from "./br.ts";
import { warrantyEnd, type MotoData } from "./moto-sale.ts";

export interface PortalSale {
  id: string;
  status: "enviado" | "assinado";
  created_at: string;
  completed_at: string | null;
  data: MotoData;
  signed_at: string | null;
  token: string | null;
  /** Selfie da assinatura do contrato (foto 3/4 do cartão do proprietário). */
  selfie?: string | null;
  /** Último pedido de transferência de propriedade feito por este dono. */
  transfer?: PortalTransfer | null;
}

export type TransferStatus = "analise" | "aprovada" | "recusada" | "concluida" | "cancelada";
export interface PortalTransfer {
  id: string;
  status: TransferStatus;
  created_at: string;
  new_owner: string | null;
  decision_note: string | null;
  fee: number;
  paid: boolean;
}

/** Taxa da transferência de propriedade. */
export const TRANSFER_FEE = 50;

export interface PortalCompany {
  company_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  logo_url: string | null;
}

export type PortalResult = { ok: true; sales: PortalSale[]; company: PortalCompany | null } | { ok: false; error: "dados" | "bloqueado" | "nao_encontrado" | "indisponivel" | "erro" };

/** Bônus máximo por amigo indicado que compra. */
export const REFERRAL_BONUS = 300;

/** CPF (até 11 dígitos) ou CNPJ (até 14) formatado enquanto digita. */
export function maskDocInput(v: string) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (_, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? `-${f}` : ""}`);
}

/** Telefone (DDD + número) formatado enquanto digita. */
export function maskPhoneInput(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

/** CPF válido (dígitos verificadores) ou CNPJ com 14 dígitos. */
export function validDoc(v: string) {
  const d = digits(v);
  if (d.length === 14) return !/^(\d)\1+$/.test(d);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

const DAY = 86_400_000;
const atNoon = (iso: string) => new Date(`${iso}T12:00:00`).getTime();

/** Situação da garantia para o anel de progresso. */
export function warrantyStatus(d: MotoData, now = new Date(), signed = true) {
  const total0 = Math.max(1, Number(d.warrantyDays) || 90);
  // Sem contrato assinado, ou entrega em casa ainda sem data: a garantia ainda não começou.
  if (!signed || (d.delivery.mode === "entrega" && !d.delivery.date)) return { state: "pendente" as const, left: total0, total: total0, progress: 1, start: "", end: "" };
  const start = d.delivery.date || d.date;
  const end = warrantyEnd(d);
  const total = Math.max(1, Number(d.warrantyDays) || 90);
  if (!start || !end) return { state: "pendente" as const, left: total, total, progress: 1, start: "", end: "" };
  const today = atNoon(now.toISOString().slice(0, 10));
  if (today < atNoon(start)) return { state: "aguardando" as const, left: total, total, progress: 1, start, end };
  const left = Math.max(0, Math.round((atNoon(end) - today) / DAY));
  return { state: left > 0 ? ("ativa" as const) : ("encerrada" as const), left, total, progress: Math.min(1, left / total), start, end };
}

/** Primeiro nome com só a inicial maiúscula ("MARIA SOUZA" → "Maria"). */
export function firstName(name: string) {
  const f = name.trim().split(/\s+/)[0] ?? "";
  return f ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : "";
}

/** Observação do lead criado pela indicação do cliente. */
export function referralNotes(r: { referrer: string; referrerPhone: string; model: string; notes: string; saleId: string }) {
  return [
    `Indicação de cliente da Quark Mobilidade: ${r.referrer.trim()} · WhatsApp ${r.referrerPhone || "não informado"}`,
    `Bônus de até R$ ${REFERRAL_BONUS} para quem indicou, pago após a compra do amigo`,
    r.model ? `Interesse: ${r.model}` : "",
    r.notes.trim() ? `Observações: ${r.notes.trim().slice(0, 600)}` : "",
    `Venda de origem: ${r.saleId}`,
  ]
    .filter(Boolean)
    .join("\n");
}
