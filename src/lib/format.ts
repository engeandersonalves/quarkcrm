export { brl, fmtNum, pct } from "./pricing";

export function parseNumber(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/[^\d,.-]/g, "");
  // pt-BR: ponto = milhar, vírgula = decimal
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

export function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

export function formatPhone(v: string | null | undefined) {
  const d = onlyDigits(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

export function whatsappUrl(phone: string | null | undefined, text?: string) {
  let d = onlyDigits(phone);
  if (d && d.length <= 11) d = `55${d}`;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${d}${q}`;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR", opts ?? { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Converte ISO → valor para <input type="datetime-local"> no fuso local. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : null;
}

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
