import { createHmac } from "node:crypto";
import { MonitoringError, type Credentials, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
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

export const solplanet: ProviderAdapter = { id: "solplanet", fetchPlants };
