/**
 * Ficha do cliente e dados pós-venda da Mobilidade. O contrato assinado nunca muda:
 * estas atualizações (contatos, foto, números da scooter, entrega) são aplicadas por
 * cima, no CRM, nos PDFs, no cartão e na área do cliente.
 */
import type { MotoProduct } from "./moto-products.ts";
import { vehicleName, type MotoData } from "./moto-sale.ts";

/** Correção do modelo de uma venda já assinada (erro de digitação), sem reassinar. */
export interface ModelFix {
  model: string;
  modelName: string;
  color: string;
  photo: string | null;
  specs: MotoData["specs"];
  /** Como estava no contrato ("Scooter elétrica T1 (Branca)"). */
  from: string;
  /** Quando foi corrigido (ISO). */
  at: string;
}

export interface SaleInfo {
  document_id: string;
  chassis: string | null;
  motor_no: string | null;
  battery_no: string | null;
  charger_no: string | null;
  delivery_date: string | null;
  /** Novo dono depois de uma transferência concluída (substitui o comprador do contrato). */
  owner?: Partial<MotoData["client"]> | null;
  transferred_at?: string | null;
  /** Data em que a scooter foi entregue ao cliente (controle de vendas). */
  delivered_at?: string | null;
  /** Custo real da unidade informado na venda (substitui o custo do modelo). */
  cost?: number | null;
  cost_notes?: string | null;
  /** Custos discriminados da venda (cada item vazio usa o cadastro do modelo). */
  costs?: Partial<Record<string, number | null>> | null;
  /** Modelo corrigido (vale no CRM, no cartão, na área do cliente e na verificação). */
  model_fix?: ModelFix | null;
  updated_at?: string;
}

export interface MotoCustomer {
  key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  photo: string | null;
  notes: string | null;
  updated_at?: string;
}

const val = (v: string | null | undefined) => (v ?? "").trim();

/** Como o modelo aparece no contrato: "Scooter elétrica T1 (Branca)". */
export const modelLabel = (d: Pick<MotoData, "model" | "modelName" | "color">) => `${vehicleName(d)}${val(d.color) ? ` (${val(d.color)})` : ""}`;

/** Monta a correção de modelo a partir do modelo cadastrado. Preço e pagamento do contrato não mudam. */
export function buildModelFix(original: MotoData, p: Pick<MotoProduct, "slug" | "name" | "photo" | "specs">, color: string, at = new Date().toISOString()): ModelFix {
  const s = p.specs;
  return {
    model: p.slug,
    modelName: p.name,
    color: val(color),
    photo: p.photo || null,
    specs: { power: s.power, battery: s.battery, range: s.range, speed: s.speed, load: s.load, brakes: s.brakes, recharge: s.recharge, weight: s.weight },
    from: modelLabel(original),
    at,
  };
}

/** Venda com a ficha do cliente e os dados pós-venda aplicados. */
export function applyOverrides(d: MotoData, info?: SaleInfo | null, cust?: MotoCustomer | null): MotoData {
  if (!info && !cust) return d;
  const pick = (over: string | null | undefined, base: string) => val(over) || base;
  const owner = info?.owner && val(info.owner.doc) ? info.owner : null;
  // Novo dono substitui o comprador por inteiro: nada do dono anterior (RG, endereço…) passa adiante.
  const blank = Object.fromEntries(Object.entries(d.client).map(([k, v]) => [k, typeof v === "string" ? "" : v])) as MotoData["client"];
  const client = owner ? { ...blank, ...Object.fromEntries(Object.entries(owner).filter(([, v]) => v !== null && v !== undefined)) } : d.client;
  const fix = info?.model_fix && val(info.model_fix.model) ? info.model_fix : null;
  return {
    ...d,
    ...(fix
      ? {
          model: fix.model,
          modelName: fix.modelName,
          color: val(fix.color) || d.color,
          photo: fix.photo || undefined,
          specs: { ...d.specs, ...fix.specs },
          modelFix: { from: fix.from, at: fix.at },
        }
      : {}),
    transferredAt: owner ? (info?.transferred_at ?? null) : d.transferredAt,
    chassis: pick(info?.chassis, d.chassis),
    motorNo: pick(info?.motor_no, d.motorNo),
    batteryNo: pick(info?.battery_no, d.batteryNo),
    chargerNo: pick(info?.charger_no, d.chargerNo),
    delivery: { ...d.delivery, date: info?.delivery_date || d.delivery.date },
    client: {
      ...client,
      phone: pick(cust?.phone, client.phone),
      email: pick(cust?.email, client.email),
      address: pick(cust?.address, client.address),
      city: pick(cust?.city, client.city),
      state: pick(cust?.state, client.state),
      cep: pick(cust?.cep, client.cep),
    },
  };
}

/** Senha da área do cliente: 4 últimos dígitos do celular. */
export const portalPin = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-4);

export const emptyCustomer = (key: string): MotoCustomer => ({ key, name: null, phone: null, email: null, address: null, city: null, state: null, cep: null, photo: null, notes: null });
