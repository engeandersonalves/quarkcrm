/**
 * Ficha do cliente e dados pós-venda da Mobilidade. O contrato assinado nunca muda:
 * estas atualizações (contatos, foto, números da scooter, entrega) são aplicadas por
 * cima, no CRM, nos PDFs, no cartão e na área do cliente.
 */
import type { MotoData } from "./moto-sale.ts";

export interface SaleInfo {
  document_id: string;
  chassis: string | null;
  motor_no: string | null;
  battery_no: string | null;
  charger_no: string | null;
  delivery_date: string | null;
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

/** Venda com a ficha do cliente e os dados pós-venda aplicados. */
export function applyOverrides(d: MotoData, info?: SaleInfo | null, cust?: MotoCustomer | null): MotoData {
  if (!info && !cust) return d;
  const pick = (over: string | null | undefined, base: string) => val(over) || base;
  return {
    ...d,
    chassis: pick(info?.chassis, d.chassis),
    motorNo: pick(info?.motor_no, d.motorNo),
    batteryNo: pick(info?.battery_no, d.batteryNo),
    chargerNo: pick(info?.charger_no, d.chargerNo),
    delivery: { ...d.delivery, date: info?.delivery_date || d.delivery.date },
    client: {
      ...d.client,
      phone: pick(cust?.phone, d.client.phone),
      email: pick(cust?.email, d.client.email),
      address: pick(cust?.address, d.client.address),
      city: pick(cust?.city, d.client.city),
      state: pick(cust?.state, d.client.state),
      cep: pick(cust?.cep, d.client.cep),
    },
  };
}

/** Senha da área do cliente: 4 últimos dígitos do celular. */
export const portalPin = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-4);

export const emptyCustomer = (key: string): MotoCustomer => ({ key, name: null, phone: null, email: null, address: null, city: null, state: null, cep: null, photo: null, notes: null });
