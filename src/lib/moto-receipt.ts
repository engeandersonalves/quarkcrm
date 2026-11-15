/**
 * Comprovante de compra e propriedade da scooter (documento não fiscal do MEI).
 * Funções puras: linhas da compra, resumo do pagamento e o texto do QR code.
 */
import { brlPlain, dateBr, formatDoc, maskDoc } from "./br.ts";
import { accessoriesTotal, cardTotal, motoTotal, shortNo, vehicleName, type MotoData } from "./moto-sale.ts";

export interface ReceiptLine {
  label: string;
  detail?: string;
  qty: number;
  unit: number;
  total: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Itens da compra: scooter(s), acessórios com valor e frete. Acessórios de brinde saem como cortesia. */
export function receiptLines(d: MotoData): ReceiptLine[] {
  const qty = Math.max(1, Number(d.qty) || 1);
  const lines: ReceiptLine[] = [
    {
      label: vehicleName(d),
      detail: [d.color.trim() && `cor ${d.color.trim().toLowerCase()}`, d.year && `ano ${d.year}`, d.chassis.trim() && `chassi ${d.chassis.trim().toUpperCase()}`].filter(Boolean).join(" · "),
      qty,
      unit: Number(d.price) || 0,
      total: r2((Number(d.price) || 0) * qty),
    },
  ];
  for (const a of d.accessories) {
    const q = Number(a.qty) || 0;
    const unit = Number(a.price) || 0;
    // Sem nome e sem valor: linha vazia do formulário. Com valor, entra (o total da venda já conta).
    if (q <= 0 || (!a.name.trim() && unit <= 0)) continue;
    lines.push({ label: a.name.trim() || "Acessório", detail: unit > 0 ? undefined : "cortesia", qty: q, unit, total: r2(unit * q) });
  }
  if ((Number(d.freight) || 0) > 0) lines.push({ label: "Entrega", qty: 1, unit: Number(d.freight), total: Number(d.freight) });
  return lines;
}

export function receiptTotals(d: MotoData) {
  const subtotal = r2((Number(d.price) || 0) * Math.max(1, Number(d.qty) || 1) + accessoriesTotal(d) + (Number(d.freight) || 0));
  const discount = Number(d.discount) || 0;
  const cash = motoTotal(d);
  const card = d.payment.method === "cartao" ? cardTotal(d) : 0;
  return { subtotal, discount, cash, paid: card > 0 ? card : cash };
}

/** Forma de pagamento em uma linha, no passado (o comprovante é emitido após o pagamento). */
export function paymentSummary(d: MotoData) {
  const p = d.payment;
  const money = (v: number) => brlPlain(v);
  switch (p.method) {
    case "pix":
      return { title: "PIX / transferência", detail: "Pagamento à vista" };
    case "cartao":
      return {
        title: "Cartão de crédito",
        detail: p.installments > 1 && p.installmentValue > 0 ? `${p.installments}× de ${money(p.installmentValue)}${p.multipleCards ? " · aceita mais de um cartão" : ""}` : "Pagamento à vista no cartão",
      };
    case "entrada": {
      const rest = Math.max(0, motoTotal(d) - (Number(p.entry) || 0));
      return { title: "Entrada + saldo", detail: `Entrada de ${money(p.entry)} + saldo de ${money(rest)}` };
    }
    default:
      return { title: "Pagamento", detail: p.custom.trim() || "Conforme combinado" };
  }
}

/** Número e código de verificação do comprovante. */
export function receiptNumber(id: string | null) {
  return {
    number: shortNo(id, "CPV"),
    code: (id ?? "").replace(/-/g, "").slice(-10).toUpperCase(),
  };
}

/**
 * Texto do QR code: legível por qualquer câmera, sem internet. Confere com o papel na hora
 * (CPF mascarado: o QR não expõe o documento inteiro do cliente).
 */
export function receiptQrText(d: MotoData, id: string | null, company: { name: string; cnpj: string }) {
  const { number, code } = receiptNumber(id);
  return [
    `QUARK MOBILIDADE · ${number}`,
    `Proprietário: ${d.client.name.trim() || "-"}`,
    d.client.doc ? `${d.client.doc.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}: ${d.client.doc.replace(/\D/g, "").length > 11 ? formatDoc(d.client.doc) : maskDoc(d.client.doc)}` : "",
    `Veículo: ${vehicleName(d)}${d.color.trim() ? ` ${d.color.trim()}` : ""}`,
    d.chassis.trim() ? `Chassi: ${d.chassis.trim().toUpperCase()}` : "",
    d.motorNo.trim() ? `Motor: ${d.motorNo.trim().toUpperCase()}` : "",
    `Compra: ${dateBr(d.date)}`,
    `Vendedora: ${company.name}${company.cnpj ? ` · CNPJ ${formatDoc(company.cnpj)}` : ""}`,
    code ? `Código: ${code}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Venda para empresa (CNPJ): aí a nota fiscal é obrigatória mesmo para o MEI. */
export const buyerIsCompany = (d: MotoData) => d.client.kind === "pj" || d.client.doc.replace(/\D/g, "").length === 14;
