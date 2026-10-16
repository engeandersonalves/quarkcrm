import { createHash, createHmac } from "node:crypto";
import { deviceFrom } from "../electrical.ts";
import { MonitoringError, type Credentials, type DayValue, type DeviceData, type Fetch, type MonthValue, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { toIso, toKw, toKwh, toKwp } from "../units.ts";
import { arr, call, obj, pool, readJson, sleep, str } from "./http.ts";

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

/** Chamada assinada genérica; devolve o campo data. */
async function post(creds: Credentials, path: string, body: Record<string, unknown>, fetch: Fetch) {
  const { json, headers } = solisHeaders(creds.keyId.trim(), creds.keySecret.trim(), body, path);
  const res = await call(fetch, SOLIS_BASE + path, { method: "POST", headers, body: json }, "SolisCloud");
  const data = await readJson(res, "SolisCloud");
  if (str(data.code) !== "0") throw new MonitoringError(`SolisCloud: ${str(data.msg) || "erro " + str(data.code)}.`);
  return data.data;
}

const dayOf = (r: Record<string, unknown>) => str(r.dateStr).slice(0, 10) || toIso(r.date)?.slice(0, 10) || "";

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch): Promise<DayValue[]> {
  const data = await post(creds, "/v1/api/stationMonth", { id: plantId, money: "BRL", month, timeZone: -3 }, fetch);
  return arr(data)
    .map((r) => ({ day: dayOf(r), kwh: toKwh(r.energy, r.energyStr ?? "kWh") ?? 0 }))
    .filter((d) => d.day.startsWith(month));
}

async function fetchMonths(creds: Credentials, plantId: string, year: string, fetch: Fetch): Promise<MonthValue[]> {
  const data = await post(creds, "/v1/api/stationYear", { id: plantId, money: "BRL", year, timeZone: -3 }, fetch);
  return arr(data)
    .map((r) => ({ month: str(r.dateStr).slice(0, 7), kwh: toKwh(r.energy, r.energyStr ?? "kWh") ?? 0 }))
    .filter((m) => m.month.startsWith(year));
}

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const page = obj(await post(creds, "/v1/api/inverterList", { pageNo: 1, pageSize: 100, stationId: plantId }, fetch)).page;
  const list = arr(obj(page).records);
  return pool(list, 2, async (inv) => {
    await sleep(600);
    const d = obj(await post(creds, "/v1/api/inverterDetail", { id: inv.id, sn: inv.sn }, fetch).catch(() => ({})));
    const channels = Number(d.dcInputType ?? 31) + 1;
    const raw: Record<string, unknown> = { ...d };
    for (let i = channels + 1; i <= 32; i++) delete raw[`uPv${i}`], delete raw[`iPv${i}`], delete raw[`pow${i}`];
    return deviceFrom(
      {
        sn: str(inv.sn),
        name: str(d.model ?? inv.sn) || str(inv.sn),
        model: str(d.model) || null,
        status: STATE[str(d.state ?? inv.state)] ?? "unknown",
        powerKw: toKw(d.pac ?? inv.pac, d.pacStr ?? inv.pacStr ?? "kW"),
        todayKwh: toKwh(d.eToday ?? inv.etoday, d.eTodayStr ?? inv.etodayStr ?? "kWh"),
        totalKwh: toKwh(d.eTotal ?? inv.etotal, d.eTotalStr ?? inv.etotalStr ?? "kWh"),
        updatedAt: toIso(d.dataTimestamp ?? inv.dataTimestamp),
      },
      raw,
    );
  });
}

export const solis: ProviderAdapter = { id: "solis", fetchPlants, fetchDays, fetchMonths, fetchDevices };
