import { createHmac, randomUUID } from "node:crypto";
import { MonitoringError, type Credentials, type DayValue, type Fetch, type MonthValue, type PlantData, type ProviderAdapter } from "../types.ts";
import { num, toKwh } from "../units.ts";
import { arr, call, obj, pool, readJson, str } from "./http.ts";

/**
 * APsystems OpenAPI (EMA): assinatura HMAC-SHA256 de
 * "timestamp/nonce/appId/<último trecho do caminho>/MÉTODO/HmacSHA256".
 */
export const APS_BASE = "https://api.apsystemsema.com:9282";

export function apsHeaders(appId: string, appSecret: string, path: string, method = "GET", ts = Date.now(), nonce = randomUUID().replace(/-/g, "")) {
  const last = path.split("?")[0].split("/").filter(Boolean).pop() ?? "";
  const toSign = `${ts}/${nonce}/${appId}/${last}/${method}/HmacSHA256`;
  return {
    "X-CA-AppId": appId,
    "X-CA-Timestamp": String(ts),
    "X-CA-Nonce": nonce,
    "X-CA-Signature-Method": "HmacSHA256",
    "X-CA-Signature": createHmac("sha256", appSecret).update(toSign).digest("base64"),
  };
}

async function get(creds: Credentials, path: string, fetch: Fetch) {
  const res = await call(fetch, APS_BASE + path, { method: "GET", headers: apsHeaders(creds.appId.trim(), creds.appSecret.trim(), path) }, "APsystems");
  const d = await readJson(res, "APsystems");
  const code = Number(d.code ?? 0);
  if (code === 4000 || code === 4001 || code === 4002) throw new MonitoringError("APsystems: App ID ou App Secret inválidos.");
  if (code === 7002 || code === 7003) throw new MonitoringError("APsystems: limite de consultas do mês atingido.");
  if (code !== 0) throw new MonitoringError(`APsystems: erro ${code}${d.message ? ` (${str(d.message)})` : ""}.`);
  return d.data;
}

const sids = (creds: Credentials) =>
  creds.sids
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const list = sids(creds);
  if (!list.length) throw new MonitoringError("APsystems: informe pelo menos um ID de sistema (SID).");
  return pool(list, 2, async (sid) => {
    const details = obj(await get(creds, `/user/api/v2/systems/details/${encodeURIComponent(sid)}`, fetch));
    let sum: Record<string, unknown> = {};
    try {
      sum = obj(await get(creds, `/user/api/v2/systems/summary/${encodeURIComponent(sid)}`, fetch));
    } catch {
      sum = {};
    }
    const light = Number(details.light ?? 0);
    return {
      externalId: sid,
      name: str(details.name ?? details.sid) || `Sistema ${sid}`,
      capacityKwp: num(details.capacity),
      powerKw: null,
      todayKwh: toKwh(sum.today, "kWh"),
      monthKwh: toKwh(sum.month, "kWh"),
      totalKwh: toKwh(sum.lifetime, "kWh"),
      status: light === 1 ? "online" : light === 2 ? "alarm" : light === 3 ? "alarm" : light === 4 ? "offline" : "unknown",
      lastUpdate: null,
      address: null,
    };
  });
}

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch): Promise<DayValue[]> {
  const data = await get(creds, `/user/api/v2/systems/energy/${encodeURIComponent(plantId)}?energy_level=daily&date_range=${month}`, fetch);
  return (Array.isArray(data) ? data : arr(obj(data).energy)).map((v, i) => ({ day: `${month}-${String(i + 1).padStart(2, "0")}`, kwh: num(v) ?? 0 }));
}

async function fetchMonths(creds: Credentials, plantId: string, year: string, fetch: Fetch): Promise<MonthValue[]> {
  const data = await get(creds, `/user/api/v2/systems/energy/${encodeURIComponent(plantId)}?energy_level=monthly&date_range=${year}`, fetch);
  return (Array.isArray(data) ? data : arr(obj(data).energy)).map((v, i) => ({ month: `${year}-${String(i + 1).padStart(2, "0")}`, kwh: num(v) ?? 0 }));
}

export const apsystems: ProviderAdapter = { id: "apsystems", fetchPlants, fetchDays, fetchMonths };
