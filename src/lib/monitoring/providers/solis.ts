import { createHash, createHmac } from "node:crypto";
import { MonitoringError, type Credentials, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { toIso, toKw, toKwh, toKwp } from "../units.ts";
import { arr, call, obj, readJson, sleep, str } from "./http.ts";

/** SolisCloud Platform API v2.0 (assinatura HMAC-SHA1 com Content-MD5). */
export const SOLIS_BASE = "https://www.soliscloud.com:13333";

export function solisHeaders(keyId: string, secret: string, body: unknown, path: string, now = new Date()) {
  const json = JSON.stringify(body);
  const contentMd5 = createHash("md5").update(json).digest("base64");
  const date = now.toUTCString();
  const toSign = `POST\n${contentMd5}\napplication/json\n${date}\n${path}`;
  const sign = createHmac("sha1", secret).update(toSign).digest("base64");
  return {
    json,
    headers: { "Content-MD5": contentMd5, "Content-Type": "application/json", Date: date, Authorization: `API ${keyId}:${sign}` },
  };
}

const STATE: Record<string, PlantStatus> = { "1": "online", "2": "offline", "3": "alarm" };

export function mapSolisStation(r: Record<string, unknown>): PlantData {
  return {
    externalId: str(r.id),
    name: str(r.stationName) || `Usina ${str(r.id)}`,
    capacityKwp: toKwp(r.capacity, r.capacityStr ?? "kWp"),
    powerKw: toKw(r.power, r.powerStr ?? "kW"),
    todayKwh: toKwh(r.dayEnergy, r.dayEnergyStr ?? "kWh"),
    monthKwh: toKwh(r.monthEnergy, r.monthEnergyStr ?? "kWh"),
    totalKwh: toKwh(r.allEnergy, r.allEnergyStr ?? "kWh"),
    status: STATE[str(r.state)] ?? "unknown",
    lastUpdate: toIso(r.dataTimestamp),
    address: str(r.addr) || null,
  };
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const path = "/v1/api/userStationList";
  const out: PlantData[] = [];
  for (let page = 1; page <= 20; page++) {
    const { json, headers } = solisHeaders(creds.keyId.trim(), creds.keySecret.trim(), { pageNo: page, pageSize: 100 }, path);
    const res = await call(fetch, SOLIS_BASE + path, { method: "POST", headers, body: json }, "SolisCloud");
    const data = await readJson(res, "SolisCloud");
    if (str(data.code) !== "0") throw new MonitoringError(`SolisCloud: ${str(data.msg) || "erro " + str(data.code)}.`);
    const pg = obj(obj(data.data).page);
    const records = arr(pg.records);
    out.push(...records.map(mapSolisStation));
    if (page >= Number(pg.pages ?? 1) || !records.length) break;
    await sleep(600); // limite: 2 chamadas por segundo
  }
  return out;
}

export const solis: ProviderAdapter = { id: "solis", fetchPlants };
