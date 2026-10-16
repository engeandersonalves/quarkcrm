import { createHmac } from "node:crypto";
import { deviceFrom } from "../electrical.ts";
import { MonitoringError, type Credentials, type DayValue, type DeviceData, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw, toKwh } from "../units.ts";
import { arr, call, obj, pool, readJson, str } from "./http.ts";

/** Solplanet Pro API (AISWEI): GET assinado com HMAC-SHA256 (padrão X-Ca-*). */
export const SOLPLANET_BASE = "https://eu-api-genergal.aisweicloud.com";
const ACCEPT = "application/json";
const CTYPE = "application/json; charset=UTF-8";

/** Caminho com a query em ordem alfabética (exigência da assinatura). */
export function sortedPath(path: string, params: Record<string, string>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  return q.length ? `${path}?${q.join("&")}` : path;
}

export function solplanetHeaders(appKey: string, appSecret: string, pathWithQuery: string) {
  const toSign = `GET\n${ACCEPT}\n\n${CTYPE}\n\nX-Ca-Key:${appKey}\n${pathWithQuery}`;
  return {
    Accept: ACCEPT,
    "Content-Type": CTYPE,
    "X-Ca-Key": appKey,
    "X-Ca-Signature-Headers": "X-Ca-Key",
    "X-Ca-Signature": createHmac("sha256", appSecret).update(toSign).digest("base64"),
  };
}

async function get(fetch: Fetch, creds: Credentials, path: string, params: Record<string, string>) {
  const p = sortedPath(path, params);
  const res = await call(fetch, SOLPLANET_BASE + p, { method: "GET", headers: solplanetHeaders(creds.appKey.trim(), creds.appSecret.trim(), p) }, "Solplanet");
  const d = await readJson(res, "Solplanet");
  if (d.success === false || (d.errorCode !== undefined && str(d.errorCode) !== "0")) throw new MonitoringError(`Solplanet: ${str(d.errorMsg) || "erro " + str(d.errorCode)}.`);
  return d;
}

const STATUS: Record<string, PlantStatus> = { "1": "online", "0": "offline", "2": "alarm", "3": "alarm", "4": "offline" };

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const token = creds.token.trim();
  const list = await get(fetch, creds, "/pro/getPlanListPro", { token });
  const data = list.data;
  const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : arr(obj(data).list ?? obj(data).records ?? obj(data).plants);
  return pool(items, 3, async (it) => {
    const apikey = str(it.apikey ?? it.apiKey);
    const id = apikey || str(it.psno ?? it.id ?? it.plantId);
    let ov: Record<string, unknown> = {};
    if (apikey) {
      try {
        ov = obj((await get(fetch, creds, "/pro/getPlantOverviewPro", { apikey, token })).data);
      } catch {
        ov = {};
      }
    }
    const power = toKw(ov.power ?? it.power ?? it.pac, ov.powerUnit ?? "W");
    return {
      externalId: id,
      name: str(it.name ?? it.plantName ?? it.psname) || `Usina ${id}`,
      capacityKwp: num(it.capacity ?? it.installedCapacity ?? it.totalPower),
      powerKw: power,
      todayKwh: toKwh(ov.etoday ?? it.etoday, "kWh"),
      monthKwh: toKwh(ov.emonth ?? it.emonth, "kWh"),
      totalKwh: toKwh(ov.etotal ?? it.etotal, "kWh"),
      status: STATUS[str(ov.status ?? it.status)] ?? (power && power > 0 ? "online" : "unknown"),
      lastUpdate: toIso(ov.lastTime ?? ov.ludt ?? it.ludt ?? null),
      address: str(it.address ?? it.position) || null,
    };
  });
}

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const token = creds.token.trim();
  const list = await get(fetch, creds, "/pro/getDeviceListPro", { apikey: plantId, token });
  const items = Array.isArray(list.data) ? (list.data as Record<string, unknown>[]) : arr(obj(list.data).list ?? obj(list.data).inverters);
  return pool(items, 2, async (inv) => {
    const sn = str(inv.isno ?? inv.sn ?? inv.isn);
    let ts: Record<string, unknown> = {};
    try {
      const d = await get(fetch, creds, "/pro/getLastTsDataPro", { apikey: plantId, token, isnos: sn });
      ts = Array.isArray(d.data) ? obj((d.data as unknown[])[0]) : obj(d.data);
    } catch {
      ts = {};
    }
    // Leituras costumam vir como listas (vac: [V1, V2, V3], vpv: [...], ipv: [...])
    const flat: Record<string, unknown> = { ...ts };
    const spread = (field: string, prefix: string) => {
      const v = ts[field];
      if (Array.isArray(v)) v.forEach((x, i) => (flat[`${prefix}${i + 1}`] = x));
    };
    spread("vac", "uac");
    spread("iac", "iac");
    spread("vpv", "upv");
    spread("ipv", "ipv");
    return deviceFrom(
      {
        sn,
        name: str(inv.name ?? inv.model) || sn,
        model: str(inv.model ?? inv.type) || null,
        status: STATUS[str(inv.status ?? ts.status)] ?? "unknown",
        powerKw: toKw(ts.pac, "W"),
        todayKwh: toKwh(ts.etoday ?? ts.eday, "kWh"),
        totalKwh: toKwh(ts.etotal, "kWh"),
        updatedAt: toIso(ts.ludt ?? ts.time ?? null),
      },
      flat,
    );
  });
}

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch): Promise<DayValue[]> {
  const d = await get(fetch, creds, "/pro/getPlantOutputPro", { apikey: plantId, token: creds.token.trim(), period: "bymonth", date: month });
  const list = Array.isArray(d.data) ? (d.data as Record<string, unknown>[]) : arr(obj(d.data).powersData ?? obj(d.data).list);
  return list
    .map((r, i) => ({ day: str(r.time ?? r.date).length >= 10 ? str(r.time ?? r.date).slice(0, 10) : `${month}-${String(num(r.time ?? r.date) ?? i + 1).padStart(2, "0")}`, kwh: num(r.value ?? r.energy) ?? 0 }))
    .filter((x) => x.day.startsWith(month));
}

export const solplanet: ProviderAdapter = { id: "solplanet", fetchPlants, fetchDays, fetchDevices };
