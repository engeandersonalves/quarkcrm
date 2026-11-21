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

/** Itens de custo de uma venda, na ordem em que aparecem. */
export const COST_FIELDS = [
  { k: "purchase", label: "Valor do produto", hint: "compra no fornecedor" },
  { k: "freight", label: "Frete", hint: "até a loja" },
  { k: "assembly", label: "Montagem", hint: "preparação e revisão" },
  { k: "accessories", label: "Brindes e acessórios", hint: "capacete, cadeado…" },
  { k: "delivery", label: "Entrega ao cliente", hint: "frete até a casa do cliente" },
  { k: "other", label: "Outros", hint: "documentação, marketing…" },
  { k: "taxes", label: "Impostos", hint: "sobre a venda" },
  { k: "commission", label: "Comissão", hint: "vendedor ou parceiro" },
] as const;
export type CostKey = (typeof COST_FIELDS)[number]["k"];
export type CostBreakdown = Partial<Record<CostKey, number | null>>;
export const COST_LABEL = Object.fromEntries(COST_FIELDS.map((f) => [f.k, f.label])) as Record<CostKey, string>;

export interface CostInfo {
  total: number;
  /** Cada item com o valor e de onde veio (venda = informado nesta venda; modelo = cadastro do modelo). */
  parts: { k: CostKey; label: string; v: number; from: "venda" | "modelo" }[];
  /** venda = algum item informado na venda; modelo = tudo do cadastro; null = sem custo. */
  source: "venda" | "modelo" | null;
}

/** Custos padrão pelo cadastro do modelo (por unidade × quantidade; impostos e comissão sobre o preço). */
export function modelCosts(d: MotoData, product?: Pick<MotoProduct, "costs"> | null): Record<CostKey, number> {
  const zero = { purchase: 0, freight: 0, assembly: 0, accessories: 0, delivery: 0, other: 0, taxes: 0, commission: 0 };
  if (!product) return zero;
  const c = product.costs;
  const qty = Math.max(1, n(d.qty) || 1);
  const price = motoTotal(d);
  return {
    purchase: r2(n(c.purchase) * qty),
    freight: r2(n(c.freight) * qty),
    assembly: r2(n(c.assembly) * qty),
    accessories: r2(n(c.accessories) * qty),
    delivery: 0,
    other: r2(n(c.other) * qty),
    taxes: r2((price * n(c.taxPct)) / 100),
    commission: r2((price * n(c.commissionPct)) / 100),
  };
}

/**
 * Custos da venda, item a item: o que foi informado na venda vale; o resto vem do modelo.
 * `manual` (custo único antigo) entra como "Outros" quando não há detalhamento.
 */
export function costOf(d: MotoData, product?: Pick<MotoProduct, "costs"> | null, manual?: number | null, breakdown?: CostBreakdown | null): CostInfo {
  const base = modelCosts(d, product);
  const own: CostBreakdown = { ...(breakdown ?? {}) };
  if (manual != null && n(manual) > 0 && !Object.values(own).some((v) => v != null)) {
    // Custo único informado antes do detalhamento: vale sozinho.
    return { total: r2(n(manual)), parts: [{ k: "other", label: "Custo informado", v: r2(n(manual)), from: "venda" }], source: "venda" };
  }
  const hasModel = product ? unitCost(product.costs) > 0 : false;
  const parts = COST_FIELDS.map((f) => {
    const mine = own[f.k];
    const v = mine != null ? r2(n(mine)) : base[f.k];
    return { k: f.k as CostKey, label: f.label, v, from: (mine != null ? "venda" : "modelo") as "venda" | "modelo" };
  }).filter((p) => p.v > 0);
  const fromSale = parts.some((p) => p.from === "venda");
  if (!fromSale && !hasModel) return { total: 0, parts: [], source: null };
  return { total: r2(parts.reduce((t, p) => t + p.v, 0)), parts, source: fromSale ? "venda" : "modelo" };
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

export function ledgerRow(d: MotoData, payments: MotoPayment[], product?: Pick<MotoProduct, "costs"> | null, manualCost?: number | null, breakdown?: CostBreakdown | null): LedgerRow {
  const pay = paySummary(payments);
  const price = motoTotal(d);
  const estimated = pay.status === "sem";
  const final = estimated ? (d.payment.method === "cartao" && cardTotal(d) > 0 ? cardTotal(d) : price) : pay.net;
  const cost = costOf(d, product, manualCost, breakdown);
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
