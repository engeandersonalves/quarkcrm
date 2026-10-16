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

const norm = (k: string) => k.toLowerCase().replace(/[\s_\-.()]/g, "");

export function parseElectrical(raw: Flat) {
  const dc = new Map<number, { voltage: number | null; current: number | null; powerKw: number | null }>();
  const ac = new Map<string, { voltage: number | null; current: number | null }>();
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
  return { dc: dcList, ac: acList, temperatureC, frequencyHz };
}

/** Monta um DeviceData a partir de um mapa plano de leituras. */
export function deviceFrom(base: Omit<DeviceData, "ac" | "dc" | "temperatureC" | "frequencyHz">, raw: Flat): DeviceData {
  const e = parseElectrical(raw);
  return { ...base, ...e };
}
