/** Conversões de unidade: cada fabricante devolve W/kW/MW, Wh/kWh/MWh… */

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || v === "--") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const factor = (unit: unknown, base: "W" | "Wh" | "Wp") => {
  const u = String(unit ?? "").trim().toLowerCase();
  const b = base.toLowerCase();
  if (u === b) return 1 / 1000;
  if (u === "k" + b || u === "") return 1;
  if (u === "m" + b) return 1000;
  if (u === "g" + b) return 1_000_000;
  return 1;
};

/** Potência em kW. Unidade vazia = já está em kW. */
export const toKw = (v: unknown, unit?: unknown) => {
  const n = num(v);
  return n === null ? null : n * factor(unit, "W");
};
/** Energia em kWh. */
export const toKwh = (v: unknown, unit?: unknown) => {
  const n = num(v);
  return n === null ? null : n * factor(unit, "Wh");
};
/** Potência instalada em kWp ("kWp", "MWp", "kW"…). */
export const toKwp = (v: unknown, unit?: unknown) => {
  const n = num(v);
  if (n === null) return null;
  const u = String(unit ?? "").trim().toLowerCase().replace(/p$/, "");
  return n * factor(u, "W");
};

/** Valor no formato {value, unit} (Sungrow) ou número simples. */
export const valueUnit = (v: unknown): [unknown, unknown] => {
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    const o = v as { value: unknown; unit?: unknown };
    return [o.value, o.unit];
  }
  return [v, undefined];
};

/** Timestamp em segundos, milissegundos ou texto → ISO. */
export const toIso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v))) {
    const n = Number(v);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Data local de hoje (AAAA-MM-DD) no fuso de Maceió. */
export const todayIso = (now = new Date()) => new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
