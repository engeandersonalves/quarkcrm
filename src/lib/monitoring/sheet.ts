/**
 * Lê planilhas de geração exportadas dos portais (qualquer fabricante):
 * encontra a coluna de data e a de energia, entende datas BR/ISO/Excel e
 * números com vírgula ou ponto, e converte Wh/MWh para kWh.
 */
export interface SheetResult {
  rows: { day: string; kwh: number }[];
  dateHeader: string | null;
  valueHeader: string | null;
  unit: "kWh" | "Wh" | "MWh";
  skipped: number;
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** "1.234,5" / "1,234.5" / "12,3" / "12.3" → número. */
export function parseNumberLoose(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[^\d.,\-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma >= 0) s = /^\-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (/^\-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) => y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/** Datas comuns → AAAA-MM-DD (dd/mm/aaaa no padrão brasileiro). */
export function parseDateLoose(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 30000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400_000);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m && valid(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
    if (valid(y, d, mo)) return `${y}-${pad(d)}-${pad(mo)}`;
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m && valid(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const DATE_WORDS = /(^|\b)(data|date|dia|day|time|tempo|periodo|period|statistical|collect)/;
const VALUE_WORDS = /(kwh|mwh|wh\b|energia|energy|geracao|generation|yield|producao|production|e[-_ ]?day|e[-_ ]?today|pv|rendimento|generated)/;
const NOT_VALUE = /(receita|income|revenue|r\$|money|co2|arvore|tree|hora|hour|temperatura|irrad|consumo|consumption|load|compra|purchas|feed|export|import|soc|bateria|battery)/;

export function parseGenerationRows(table: unknown[][]): SheetResult {
  const rows = table.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  let headerIdx = -1, dateCol = -1, valueCol = -1;
  for (let i = 0; i < Math.min(rows.length, 25) && headerIdx < 0; i++) {
    const cells = rows[i].map((c) => strip(String(c ?? "")));
    const dc = cells.findIndex((c) => DATE_WORDS.test(c));
    const vc = cells.findIndex((c, j) => j !== dc && VALUE_WORDS.test(c) && !NOT_VALUE.test(c));
    if (dc >= 0 && vc >= 0) [headerIdx, dateCol, valueCol] = [i, dc, vc];
  }
  // Sem cabeçalho reconhecível: primeira coluna com datas e a primeira numérica depois dela
  if (headerIdx < 0) {
    const sample = rows.slice(0, 40);
    const width = Math.max(0, ...sample.map((r) => r.length));
    for (let c = 0; c < width && dateCol < 0; c++) if (sample.filter((r) => parseDateLoose(r[c])).length >= Math.min(3, sample.length)) dateCol = c;
    for (let c = 0; c < width && valueCol < 0; c++) if (c !== dateCol && sample.filter((r) => parseDateLoose(r[dateCol]) && parseNumberLoose(r[c]) !== null).length >= Math.min(3, sample.length)) valueCol = c;
  }
  const header = headerIdx >= 0 ? rows[headerIdx] : null;
  const vh = header ? strip(String(header[valueCol] ?? "")) : "";
  const unit: SheetResult["unit"] = /mwh/.test(vh) ? "MWh" : /(^|[^k])wh/.test(vh) && !/kwh/.test(vh) ? "Wh" : "kWh";
  const factor = unit === "MWh" ? 1000 : unit === "Wh" ? 1 / 1000 : 1;

  const byDay = new Map<string, number>();
  let skipped = 0;
  if (dateCol >= 0 && valueCol >= 0) {
    for (const r of rows.slice(headerIdx + 1)) {
      const day = parseDateLoose(r[dateCol]);
      const v = parseNumberLoose(r[valueCol]);
      if (!day || v === null || v < 0) {
        skipped++;
        continue;
      }
      byDay.set(day, (byDay.get(day) ?? 0) + v * factor);
    }
  }
  return {
    rows: [...byDay.entries()].sort().map(([day, kwh]) => ({ day, kwh: Math.round(kwh * 1000) / 1000 })),
    dateHeader: header ? String(header[dateCol] ?? "") : null,
    valueHeader: header ? String(header[valueCol] ?? "") : null,
    unit,
    skipped,
  };
}
