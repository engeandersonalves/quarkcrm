/**
 * Recibos: valor por extenso (pt-BR), formas de pagamento e o texto da declaração.
 */

const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0–999 por extenso ("cento e vinte e três"). */
function upTo999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(" e ");
}

/** Número inteiro por extenso (até 999 bilhões). */
export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";
  const groups = [
    { value: Math.floor(n / 1e9) % 1000, one: "bilhão", many: "bilhões" },
    { value: Math.floor(n / 1e6) % 1000, one: "milhão", many: "milhões" },
    { value: Math.floor(n / 1e3) % 1000, one: "mil", many: "mil" },
    { value: n % 1000, one: "", many: "" },
  ];
  const parts: { text: string; value: number }[] = [];
  for (const g of groups) {
    if (!g.value) continue;
    let text: string;
    if (g.one === "mil") text = g.value === 1 ? "mil" : `${upTo999(g.value)} mil`;
    else if (g.one) text = `${upTo999(g.value)} ${g.value === 1 ? g.one : g.many}`;
    else text = upTo999(g.value);
    parts.push({ text, value: g.value });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou uma centena redonda (mil e quinhentos, mil e vinte).
  return parts
    .map((p, i) => {
      if (i === 0) return p.text;
      const last = i === parts.length - 1;
      const join = last && (p.value < 100 || p.value % 100 === 0) ? " e " : last ? " " : ", ";
      return `${join}${p.text}`;
    })
    .join("")
    .replace(/, (?=\S+$)/, " e ");
}

/** Valor em reais por extenso: "mil e quinhentos reais e cinquenta centavos". */
export function moneyToWords(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  const reais = Math.floor(cents / 100);
  const c = cents % 100;
  const parts: string[] = [];
  if (reais) {
    const words = numberToWords(reais);
    // "um milhão de reais", "dois bilhões de reais"
    const de = /(milhão|milhões|bilhão|bilhões)$/.test(words) ? " de" : "";
    parts.push(`${words}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (c) parts.push(`${numberToWords(c)} ${c === 1 ? "centavo" : "centavos"}`);
  if (!parts.length) return "zero real";
  return parts.join(" e ");
}

export const RECEIPT_METHODS = ["PIX", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência bancária", "Boleto", "Cheque"] as const;

export const RECEIPT_REASONS = [
  "Sinal de entrada do sistema de energia solar fotovoltaica",
  "Pagamento do sistema de energia solar fotovoltaica",
  "Instalação do carregador veicular S.A.V.E",
  "Limpeza e manutenção de usina solar",
  "Serviço de gestão energética",
  "Visita técnica e elaboração de projeto",
];

export interface ReceiptData {
  number: number | null;
  payerName: string;
  payerDoc: string;
  amount: number;
  description: string;
  method: string;
  installment: string; // ex.: "2 de 6" (vazio = pagamento único)
  paidAt: string; // AAAA-MM-DD
  city: string;
}

/** CPF (11 dígitos) ou CNPJ (14) formatado; outros valores voltam como digitados. */
export function formatDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v.trim();
}

export const docLabel = (v: string) => (v.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF");

/** Data por extenso: "Maceió/AL, 2 de outubro de 2026". */
export function longDate(iso: string, city?: string) {
  const d = new Date(`${iso}T12:00:00`);
  const txt = Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  return city ? `${city}, ${txt}` : txt;
}

/** Texto da declaração do recibo. */
export function receiptStatement(r: ReceiptData, company: string, brl: (v: number) => string) {
  const payer = r.payerName.trim() || "________________________";
  const doc = r.payerDoc.trim() ? `, inscrito(a) no ${docLabel(r.payerDoc)} sob o nº ${formatDoc(r.payerDoc)},` : "";
  const what = r.description.trim() || "________________________";
  const part = r.installment.trim() ? `, correspondente à parcela ${r.installment.trim()}` : "";
  const how = r.method ? `, pago via ${r.method.toLowerCase().replace("pix", "PIX")}` : "";
  const settle = r.installment.trim() ? "dando quitação do valor desta parcela" : "dando plena e geral quitação do valor recebido";
  return `${company} declara que recebeu de ${payer}${doc} a importância de ${brl(r.amount)} (${moneyToWords(r.amount)}), referente a ${what}${part}${how}, ${settle}.`;
}
