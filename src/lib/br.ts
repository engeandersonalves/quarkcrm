/* Utilitários brasileiros: CPF/CNPJ, CEP, valores e datas por extenso. */

export const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export function isValidCpf(v: string | null | undefined) {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(v: string | null | undefined) {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const isValidDoc = (v: string | null | undefined) => (digits(v).length > 11 ? isValidCnpj(v) : isValidCpf(v));

/** Formata CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) enquanto digita. */
export function formatDoc(v: string | null | undefined) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** CPF parcialmente oculto para o registro público de assinaturas (***.456.789-**). */
export function maskDoc(v: string | null | undefined) {
  const f = formatDoc(v);
  if (digits(v).length === 11) return `***.${f.slice(4, 11)}-**`;
  return f;
}

export function formatCep(v: string | null | undefined) {
  return digits(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

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

/** Número inteiro por extenso (até 999 milhões). */
export function numberInWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const groups: { text: string; value: number }[] = [];
  if (millions) groups.push({ text: millions === 1 ? "um milhão" : `${upTo999(millions)} milhões`, value: millions });
  if (thousands) groups.push({ text: thousands === 1 ? "mil" : `${upTo999(thousands)} mil`, value: thousands });
  if (rest) groups.push({ text: upTo999(rest), value: rest });
  // "e" antes do último grupo quando ele é menor que 100 ou uma centena redonda (ex.: mil e duzentos).
  const last = groups[groups.length - 1];
  if (groups.length > 1 && (last.value < 100 || last.value % 100 === 0)) {
    return `${groups.slice(0, -1).map((g) => g.text).join(" ")} e ${last.text}`;
  }
  return groups.map((g) => g.text).join(" ");
}

/** Valor em reais por extenso: 1.250,50 → "mil duzentos e cinquenta reais e cinquenta centavos". */
export function moneyInWords(value: number): string {
  const v = Math.round(Math.abs(value) * 100);
  const reais = Math.floor(v / 100);
  const cents = v % 100;
  const parts: string[] = [];
  if (reais) {
    const words = numberInWords(reais);
    const de = reais % 1_000_000 === 0 ? " de" : "";
    parts.push(`${words}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (cents) parts.push(`${numberInWords(cents)} ${cents === 1 ? "centavo" : "centavos"}`);
  return parts.length ? parts.join(" e ") : "zero reais";
}

export const brlPlain = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 1.500,00 (mil e quinhentos reais)" */
export const moneyFull = (v: number) => `${brlPlain(v)} (${moneyInWords(v)})`;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "27 de setembro de 2026" a partir de "2026-09-27". */
export function dateInWords(iso: string | null | undefined) {
  if (!iso) return "____ de ____________ de ______";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d === 1 ? "1º" : d} de ${MONTHS[m - 1]} de ${y}`;
}

export function dateBr(iso: string | null | undefined) {
  if (!iso) return "__/__/____";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Soma meses a uma data ISO (yyyy-mm-dd) e devolve o dia anterior (fim do prazo). */
export function endOfTerm(startIso: string, months: number) {
  const [y, m, d] = startIso.slice(0, 10).split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}
