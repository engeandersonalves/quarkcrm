/**
 * Cupom de venda (estilo cupom fiscal, sem valor fiscal) da scooter.
 * Funções puras: itens numerados, totais, pagamentos e textos do rodapé.
 */
import { brlPlain, dateBr } from "./br.ts";
import { PAY_LABEL, type PayMethod } from "./moto-ledger.ts";
import { buyerIsCompany, paymentSummary, receiptLines, receiptNumber, receiptTotals } from "./moto-receipt.ts";
import { warrantyEnd, type MotoData } from "./moto-sale.ts";

/** Pagamento lançado na venda (o que o cliente vê: sem taxas internas). */
export interface CouponPayment {
  method: PayMethod;
  amount: number;
  installments: number | null;
  date: string | null;
  paid: boolean;
}

export interface CouponItem {
  n: string;
  label: string;
  /** Linhas de detalhe (cor, ano, números de série). */
  details: string[];
  qty: number;
  unit: number;
  total: number;
  courtesy: boolean;
}

export interface CouponPayRow {
  label: string;
  detail: string;
  amount: number;
  status: "pago" | "a vencer" | "pendente" | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const up = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();
/** Valor no padrão do cupom: 6.399,00 (sem R$). */
export const cv = (v: number) => brlPlain(v).replace(/^R\$\s*/, "");

export function couponData(d: MotoData, id: string | null, payments: CouponPayment[] = [], today = new Date().toISOString().slice(0, 10)) {
  const { number, code } = receiptNumber(id);
  const lines = receiptLines(d);
  const items: CouponItem[] = lines.map((l, i) => {
    const details: string[] = [];
    if (i === 0) {
      const head = [d.color.trim() && `Cor ${d.color.trim()}`, d.year && `Ano ${d.year}`].filter(Boolean).join(" · ");
      if (head) details.push(head);
      if (d.chassis.trim()) details.push(`Chassi ${up(d.chassis)}`);
      if (d.motorNo.trim()) details.push(`Motor ${up(d.motorNo)}`);
      if (d.batteryNo.trim()) details.push(`Bateria ${up(d.batteryNo)}`);
      if (d.chargerNo.trim()) details.push(`Carregador ${up(d.chargerNo)}`);
    }
    return { n: String(i + 1).padStart(3, "0"), label: up(l.label), details, qty: l.qty, unit: l.unit, total: l.total, courtesy: l.total <= 0 };
  });
  const t = receiptTotals(d);

  const lancados = payments.filter((p) => (Number(p.amount) || 0) > 0);
  let pay: CouponPayRow[];
  let total: number;
  if (lancados.length) {
    pay = lancados.map((p) => {
      const parc = p.method === "cartao" && (Number(p.installments) || 0) > 1 ? `${p.installments}x de ${cv(r2(p.amount / Number(p.installments)))}` : p.method === "cartao" ? "à vista" : "";
      return {
        label: PAY_LABEL[p.method] ?? "Pagamento",
        detail: [parc, p.date && dateBr(p.date)].filter(Boolean).join(" · "),
        amount: r2(Number(p.amount) || 0),
        status: p.paid ? "pago" : p.date && p.date >= today ? "a vencer" : "pendente",
      };
    });
    total = r2(lancados.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  } else {
    const s = paymentSummary(d);
    pay = [{ label: s.title, detail: s.detail, amount: t.paid, status: null }];
    total = t.paid;
  }
  // Encargos da operadora (parcelado no cartão): o que passa do preço à vista.
  const charges = r2(Math.max(0, total - t.cash));
  const paidSoFar = lancados.length ? r2(lancados.filter((p) => p.paid).reduce((s, p) => s + (Number(p.amount) || 0), 0)) : null;

  const end = d.delivery.date ? warrantyEnd(d) : "";
  return {
    number,
    code,
    items,
    qtyItems: items.reduce((s, i) => s + i.qty, 0),
    subtotal: t.subtotal,
    discount: t.discount,
    cash: t.cash,
    pay,
    charges,
    total,
    paidSoFar,
    open: paidSoFar == null ? null : r2(total - paidSoFar),
    warranty: end ? `${d.warrantyDays} dias · até ${dateBr(end)}` : `${d.warrantyDays} dias a partir da entrega`,
    delivery: `${d.delivery.mode === "entrega" ? "Entrega no endereço do cliente" : "Retirada na loja"}${d.delivery.date ? ` · ${dateBr(d.delivery.date)}` : ""}`,
    company: buyerIsCompany(d),
  };
}
export type CouponData = ReturnType<typeof couponData>;
