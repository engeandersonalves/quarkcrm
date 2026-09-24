import type { Endereco } from "./types";

/* ------------------------------------------------------------------ Datas (AAAA-MM-DD, horário local) */

export function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const hoje = () => isoLocal(new Date());

export function parseData(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDias(s: string, n: number): string {
  const d = parseData(s);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

/** b − a em dias. */
export function diffDias(a: string, b: string): number {
  return Math.round((parseData(b).getTime() - parseData(a).getTime()) / 86_400_000);
}

export function fmtData(s: string | null | undefined): string {
  if (!s) return "—";
  return parseData(s).toLocaleDateString("pt-BR");
}

export function fmtDataCurta(s: string | null | undefined): string {
  if (!s) return "—";
  return parseData(s)
    .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    .replace(/\./g, "");
}

export function fmtDataHora(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function relativo(s: string): string {
  const d = diffDias(hoje(), s);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d > 1) return `em ${d} dias`;
  return `há ${-d} dias`;
}

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ------------------------------------------------------------------ Números */

export function parseNumero(s: string): number {
  const t = s.trim().replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function fmtNum(n: number, casas = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;

/* ------------------------------------------------------------------ Documentos, telefone */

export const soDigitos = (s: string) => (s || "").replace(/\D/g, "");

export function fmtTelefone(s: string): string {
  const d = soDigitos(s).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
}

export function fmtDocumento(s: string): string {
  const d = soDigitos(s);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return s;
}

export function fmtCep(s: string): string {
  const d = soDigitos(s).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/* ------------------------------------------------------------------ Endereço, mapas e WhatsApp */

export const enderecoVazio = (): Endereco => ({
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  referencia: "",
  maps_url: "",
});

export function linhaEndereco(e: Endereco | null | undefined, comCidade = true): string {
  if (!e) return "";
  const rua = [e.logradouro, e.numero && `nº ${e.numero}`, e.complemento].filter(Boolean).join(", ");
  const parts = [rua, e.bairro];
  if (comCidade) parts.push([e.cidade, e.uf].filter(Boolean).join("/"));
  return parts.filter(Boolean).join(" — ");
}

export function enderecoCompleto(e: Endereco): string {
  return [linhaEndereco(e), e.cep && `CEP ${fmtCep(e.cep)}`].filter(Boolean).join(" — ");
}

export function temEndereco(e: Endereco | null | undefined): boolean {
  return Boolean(e && (e.logradouro || e.maps_url || e.bairro));
}

export function linkMaps(e: Endereco): string {
  if (e.maps_url) return e.maps_url;
  const q = [e.logradouro, e.numero, e.bairro, e.cidade, e.uf, e.cep].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function linkWaze(e: Endereco): string {
  const coords = e.maps_url.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (coords) return `https://waze.com/ul?ll=${coords[1]},${coords[2]}&navigate=yes`;
  const q = [e.logradouro, e.numero, e.bairro, e.cidade, e.uf].filter(Boolean).join(", ");
  return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
}

/** Link wa.me. Sem telefone, abre o WhatsApp para escolher o contato. */
export function linkWhatsApp(telefone: string, texto: string): string {
  let d = soDigitos(telefone);
  if (d && d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
