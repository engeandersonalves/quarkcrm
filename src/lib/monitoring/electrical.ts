import type { DeviceData } from "./types.ts";
import { num } from "./units.ts";

/**
 * Cada fabricante nomeia as leituras de um jeito (uPv1, vpv1, pv1_u, "DC Voltage PV1"…).
 * Este leitor entende os padrões mais comuns e devolve CA por fase e CC por string.
 */
type Flat = Record<string, unknown>;

const PHASE: Record<string, string> = { r: "R", s: "S", t: "T", "1": "R", "2": "S", "3": "T", a: "R", b: "S", c: "T", u: "R", v: "S", w: "T", l1: "R", l2: "S", l3: "T" };

/** Converte [{key|name, value, unit}] (Deye/Solarman/FoxESS) num mapa plano. */
export function flatten(list: unknown, keyField = "key"): Flat {
  const out: Flat = {};
  if (!Array.isArray(list)) return out;
  for (const it of list as Record<string, unknown>[]) {
    const k = String(it[keyField] ?? it.variable ?? it.key ?? it.name ?? "");
    if (!k) continue;
    out[k] = it.value;
    if (typeof it.name === "string") out[it.name] = it.value;
    if (it.unit) out[`${k}__unit`] = it.unit;
  }
  return out;
}

const LINE: Record<string, string> = { rs: "R-S", st: "S-T", tr: "T-R", ab: "R-S", bc: "S-T", ca: "T-R", l1l2: "L1-L2", l2l3: "L2-L3", l3l1: "L3-L1" };

const norm = (k: string) => k.toLowerCase().replace(/[\s_\-.()]/g, "");

export function parseElectrical(raw: Flat) {
  const dc = new Map<number, { voltage: number | null; current: number | null; powerKw: number | null }>();
  const ac = new Map<string, { voltage: number | null; current: number | null }>();
  const line = new Map<string, number>();
  let temperatureC: number | null = null;
  let frequencyHz: number | null = null;

  const setDc = (i: number, field: "voltage" | "current" | "powerKw", v: number | null) => {
    if (v === null || i < 1 || i > 64) return;
    const cur = dc.get(i) ?? { voltage: null, current: null, powerKw: null };
    if (cur[field] === null) cur[field] = v;
    dc.set(i, cur);
  };
  const setAc = (ph: string, field: "voltage" | "current", v: number | null) => {
    if (v === null) return;
    const cur = ac.get(ph) ?? { voltage: null, current: null };
    if (cur[field] === null) cur[field] = v;
    ac.set(ph, cur);
  };

  for (const [key, value] of Object.entries(raw)) {
    if (key.endsWith("__unit")) continue;
    const k = norm(key);
    const v = num(value);
    if (v === null) continue;
    const unit = String(raw[`${key}__unit`] ?? "").toLowerCase();
    let m: RegExpMatchArray | null;
    // CC por string/MPPT
    if ((m = k.match(/^(?:u|v)pv(\d+)$|^pv(\d+)(?:u|volt|voltage)$|^dcvoltage(?:pv|mppt)?(\d+)$|^pv(\d+)voltage$|^mppt(\d+)(?:u|voltage)$|^dv(\d+)$/))) setDc(Number(m.slice(1).find(Boolean)), "voltage", v);
    else if ((m = k.match(/^ipv(\d+)$|^pv(\d+)(?:i|current)$|^dccurrent(?:pv|mppt)?(\d+)$|^pv(\d+)current$|^mppt(\d+)(?:i|current)$|^dc(\d+)$/))) setDc(Number(m.slice(1).find(Boolean)), "current", v);
    else if ((m = k.match(/^(?:pow|ppv)(\d+)$|^pv(\d+)(?:p|power)$|^dcpower(?:pv|mppt)?(\d+)$|^pv(\d+)power$|^dp(\d+)$/))) setDc(Number(m.slice(1).find(Boolean)), "powerKw", unit === "kw" ? v : v / 1000);
    // Tensão entre fases / entre linhas (Huawei ab_u, Growatt vacRs, Deye "Grid Voltage L1-L2")
    else if ((m = k.match(/^(?:u|v)ac(rs|st|tr)$|^(ab|bc|ca)u$|^u(ab|bc|ca)$|^(?:grid|g|ac|load|out|inverter)?(?:voltage|volt|v|u)(l1l2|l2l3|l3l1|rs|st|tr)$|^(?:grid|g)(?:voltage)?(l1l2|l2l3|l3l1)$|^(?:grid|ac)?linevoltage(ab|bc|ca|rs|st|tr|l1l2)?$/))) {
      const pair = m.slice(1).find(Boolean) ?? "l1l2";
      const label = LINE[pair] ?? "L1-L2";
      if (v > 0 && !line.has(label)) line.set(label, v);
    }
    // CA por fase
    else if ((m = k.match(/^(?:u|v)ac(r|s|t|1|2|3)$|^([abc])u$|^acvoltage(r|s|t|1|2|3|l1|l2|l3|u|v|w)(?:[uvwi]?[abc])?$|^([rst])volt$|^grid(?:voltage)?(r|s|t|l1|l2|l3)$|^phase([abc])voltage$|^av(1|2|3)$/))) setAc(PHASE[m.slice(1).find(Boolean)!] ?? "R", "voltage", v);
    else if ((m = k.match(/^iac(r|s|t|1|2|3)$|^([abc])i$|^accurrent(r|s|t|1|2|3|l1|l2|l3|u|v|w)(?:[uvwi]?[abc])?$|^([rst])current$|^phase([abc])current$|^ac(1|2|3)$/))) setAc(PHASE[m.slice(1).find(Boolean)!] ?? "R", "current", v);
    // Linha (Huawei: ab_u…) só se não houver fase
    else if (/^(fac|fac1|elecfreq|frequency|gridfrequency|rfreq|afo1|acfrequency)$/.test(k) || /^acoutputfrequency/.test(k) || /^gridfreq/.test(k)) frequencyHz ??= v;
    else if (/^(temperature|tempperature|invertertemperature|invtemperation|radiatortemperature|temperatureinverter|actemperature|internaltemperature)$/.test(k) || /(temperature|temp)$/.test(k)) {
      if (!/ambient|battery|bat|module|env/.test(k)) temperatureC ??= v;
    }
  }

  // Corrente zero e tensão zero em strings vazias: descarta strings sem nenhuma leitura útil
  const dcList = [...dc.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, d]) => (d.voltage ?? 0) > 0 || (d.current ?? 0) > 0)
    .map(([i, d]) => ({ label: `PV${i}`, ...d, powerKw: d.powerKw ?? (d.voltage !== null && d.current !== null ? (d.voltage * d.current) / 1000 : null) }));
  const acList = ["R", "S", "T"].filter((p) => ac.has(p) && ((ac.get(p)!.voltage ?? 0) > 0 || (ac.get(p)!.current ?? 0) > 0)).map((p) => ({ label: `Fase ${p}`, ...ac.get(p)! }));
  const acLine = [...line.entries()].map(([label, voltage]) => ({ label, voltage }));
  const phaseV = acList.map((a) => a.voltage).filter((v): v is number => v !== null && v > 0);
  // Inversores split-phase (ex.: Deye/Growatt modelos US ligados em 220 V) medem cada perna
  // contra o neutro interno (~110–127 V); a tensão que alimenta o inversor é a entre as pernas.
  const split = acLine.length > 0 && phaseV.length > 0 && phaseV.length <= 2 && phaseV.every((v) => v < acLine[0].voltage * 0.65);
  const grid = split || !phaseV.length ? (acLine[0] ?? null) : { label: acList.length > 1 ? "Média das fases" : "Fase-neutro", voltage: phaseV.reduce((a, b) => a + b, 0) / phaseV.length };
  return {
    dc: dcList,
    ac: acList,
    acLine,
    gridVoltage: grid ? Math.round(grid.voltage * 10) / 10 : null,
    gridVoltageLabel: grid ? (split ? `${grid.label} (split-phase)` : grid.label) : null,
    temperatureC,
    frequencyHz,
  };
}

/** Monta um DeviceData a partir de um mapa plano de leituras. */
export function deviceFrom(base: Omit<DeviceData, "ac" | "dc" | "acLine" | "gridVoltage" | "gridVoltageLabel" | "temperatureC" | "frequencyHz" | "readings">, raw: Flat): DeviceData {
  const e = parseElectrical(raw);
  return { ...base, ...e, readings: readingsOf(raw) };
}

/** Todas as leituras numéricas do inversor, para conferir campo a campo (limite de 120). */
export function readingsOf(raw: Flat) {
  const out: { key: string; value: number; unit: string }[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key.endsWith("__unit") || out.length >= 120) continue;
    const v = num(value);
    if (v === null || typeof value === "boolean") continue;
    if (/time|date|sn$|^id$|id$|serial|version|type|status|code|lat|lng|lon/i.test(key)) continue;
    if (out.some((o) => o.key === key)) continue;
    out.push({ key, value: v, unit: String(raw[`${key}__unit`] ?? "") });
  }
  return out;
}
