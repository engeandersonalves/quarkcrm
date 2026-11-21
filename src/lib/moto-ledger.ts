/**
 * Controle de vendas da Mobilidade: preço, custos, valor final, lucro e pagamentos.
 * Uma regra só para a tabela, os totais e o detalhe de cada venda.
 *
 * - Preço: valor à vista combinado no contrato (scooter + acessórios + frete − desconto).
 * - Valor final: o que entra para a empresa = soma dos pagamentos − taxas. Sem pagamentos
 *   lançados, usa o valor do contrato como estimativa.
 * - Custos: o custo informado na venda ou, se não houver, o custo do modelo cadastrado
 *   (compra, frete, montagem, brindes, outros) mais impostos e comissão sobre o preço.
 * - Lucro: valor final − custos.
 */
import { unitCost, type MotoProduct } from "./moto-products.ts";
import { cardTotal, motoTotal, type MotoData } from "./moto-sale.ts";

export type PayMethod = "pix" | "dinheiro" | "cartao" | "boleto" | "transferencia";

export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: "pix", label: "PIX" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao", label: "Cartão" },
  { id: "boleto", label: "Boleto" },
  { id: "transferencia", label: "Transferência" },
];
export const PAY_LABEL: Record<PayMethod, string> = Object.fromEntries(PAY_METHODS.map((m) => [m.id, m.label])) as Record<PayMethod, string>;

export interface MotoPayment {
  id: string;
  document_id: string;
  method: PayMethod;
  amount: number;
  installments: number | null;
  /** Taxa da maquininha, do boleto etc. (sai do valor final). */
  fee: number;
  /** Data do pagamento ou do vencimento (yyyy-mm-dd). */
  date: string | null;
  paid: boolean;
  notes: string | null;
  position: number;
}

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface CostInfo {
  total: number;
  parts: { k: string; v: number }[];
  /** manual = informado na venda; modelo = calculado pelo cadastro do modelo; null = sem custo. */
  source: "manual" | "modelo" | null;
}

export function costOf(d: MotoData, product?: Pick<MotoProduct, "costs"> | null, manual?: number | null): CostInfo {
  if (manual != null && n(manual) > 0) return { total: r2(n(manual)), parts: [{ k: "Custo informado", v: r2(n(manual)) }], source: "manual" };
  if (!product || !(unitCost(product.costs) > 0)) return { total: 0, parts: [], source: null };
  const qty = Math.max(1, n(d.qty) || 1);
  const price = motoTotal(d);
  const unit = r2(unitCost(product.costs) * qty);
  const taxes = r2((price * n(product.costs.taxPct)) / 100);
  const commission = r2((price * n(product.costs.commissionPct)) / 100);
  const parts = [
    { k: qty > 1 ? `Scooter (${qty} un.)` : "Scooter (compra, frete, montagem)", v: unit },
    { k: "Impostos", v: taxes },
    { k: "Comissão", v: commission },
  ].filter((p) => p.v > 0);
  return { total: r2(unit + taxes + commission), parts, source: "modelo" };
}

export type PayStatus = "pago" | "parcial" | "pendente" | "sem";

export interface PaySummary {
  /** Soma dos valores lançados. */
  total: number;
  fees: number;
  /** total − taxas. */
  net: number;
  /** Líquido já pago. */
  received: number;
  /** Líquido que falta receber. */
  open: number;
  overdue: number;
  /** "PIX", "Cartão", "Misto"… */
  method: string;
  status: PayStatus;
}

export function paySummary(list: Pick<MotoPayment, "method" | "amount" | "fee" | "date" | "paid">[], today = new Date().toISOString().slice(0, 10)): PaySummary {
  const lines = list.filter((p) => n(p.amount) > 0);
  const total = r2(lines.reduce((t, p) => t + n(p.amount), 0));
  const fees = r2(lines.reduce((t, p) => t + n(p.fee), 0));
  const net = r2(total - fees);
  const received = r2(lines.filter((p) => p.paid).reduce((t, p) => t + n(p.amount) - n(p.fee), 0));
  const methods = [...new Set(lines.map((p) => p.method))];
  return {
    total,
    fees,
    net,
    received,
    open: r2(net - received),
    overdue: lines.filter((p) => !p.paid && p.date && p.date < today).length,
    method: methods.length === 0 ? "—" : methods.length > 1 ? "Misto" : PAY_LABEL[methods[0]],
    status: !lines.length ? "sem" : lines.every((p) => p.paid) ? "pago" : lines.some((p) => p.paid) ? "parcial" : "pendente",
  };
}

export interface LedgerRow {
  price: number;
  final: number;
  /** Valor final ainda estimado pelo contrato (nenhum pagamento lançado). */
  estimated: boolean;
  cost: CostInfo;
  profit: number | null;
  /** Lucro sobre o valor final (%). */
  margin: number | null;
  pay: PaySummary;
}

export function ledgerRow(d: MotoData, payments: MotoPayment[], product?: Pick<MotoProduct, "costs"> | null, manualCost?: number | null): LedgerRow {
  const pay = paySummary(payments);
  const price = motoTotal(d);
  const estimated = pay.status === "sem";
  const final = estimated ? (d.payment.method === "cartao" && cardTotal(d) > 0 ? cardTotal(d) : price) : pay.net;
  const cost = costOf(d, product, manualCost);
  const profit = cost.source ? r2(final - cost.total) : null;
  return { price, final, estimated, cost, profit, margin: profit != null && final > 0 ? Math.round((profit / final) * 1000) / 10 : null, pay };
}

/** Sugestão de pagamentos a partir do que foi combinado no contrato. */
export function paymentsFromContract(d: MotoData): Omit<MotoPayment, "id" | "document_id">[] {
  const total = motoTotal(d);
  const when = d.delivery?.date || d.date || null;
  const p = d.payment;
  if (p.method === "cartao")
    return [{ method: "cartao", amount: cardTotal(d) > 0 ? cardTotal(d) : total, installments: n(p.installments) || 1, fee: 0, date: d.date || when, paid: false, notes: null, position: 0 }];
  if (p.method === "entrada" && n(p.entry) > 0 && n(p.entry) < total)
    return [
      { method: "pix", amount: r2(n(p.entry)), installments: null, fee: 0, date: d.date || when, paid: false, notes: "Entrada", position: 0 },
      { method: "pix", amount: r2(total - n(p.entry)), installments: null, fee: 0, date: when, paid: false, notes: p.balanceWhen ? `Saldo ${p.balanceWhen}` : "Saldo", position: 1 },
    ];
  return [{ method: "pix", amount: total, installments: null, fee: 0, date: when, paid: false, notes: null, position: 0 }];
}
