import { createHash } from "node:crypto";
import { deviceFrom, flatten } from "../electrical.ts";
import { MonitoringError, type Credentials, type DayValue, type DeviceData, type Fetch, type MonthValue, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw } from "../units.ts";
import { arr, call, obj, pool, readJson, sleep, str } from "./http.ts";

/**
 * FoxESS Cloud OpenAPI: chave de API no cabeçalho Token e assinatura
 * md5(caminho + "\r\n" + token + "\r\n" + timestamp) — com "\r\n" literais.
 */
export const FOX_BASE = "https://www.foxesscloud.com";

export function foxHeaders(path: string, token: string, ts = Date.now()) {
  const timestamp = String(ts);
  return {
    Token: token,
    Timestamp: timestamp,
    Lang: "en",
    Timezone: "America/Sao_Paulo",
    "Content-Type": "application/json",
    Signature: createHash("md5").update(`${path}\\r\\n${token}\\r\\n${timestamp}`).digest("hex"),
  };
}

function client(creds: Credentials, fetch: Fetch) {
  const token = creds.apiKey.trim();
  const req = async (method: "GET" | "POST", path: string, body?: unknown, query = "") => {
    const res = await call(fetch, `${FOX_BASE}${path}${query}`, { method, headers: foxHeaders(path, token), body: body ? JSON.stringify(body) : undefined }, "FoxESS");
    const d = await readJson(res, "FoxESS");
    const errno = Number(d.errno ?? 0);
    if (errno === 40256 || errno === 40257) throw new MonitoringError("FoxESS: chave de API inválida.");
    if (errno === 40400 || errno === 41203) throw new MonitoringError("FoxESS: limite de consultas atingido. Tente de novo em alguns minutos.");
    if (errno !== 0) throw new MonitoringError(`FoxESS: ${str(d.msg) || "erro " + errno}.`);
    return d.result;
  };
  return req;
}

const STATUS: Record<string, PlantStatus> = { "1": "online", "2": "alarm", "3": "offline" };
const VARS = ["generationPower", "pvPower", "todayYield", "pv1Volt", "pv1Current", "pv1Power", "pv2Volt", "pv2Current", "pv2Power", "pv3Volt", "pv3Current", "pv4Volt", "pv4Current", "RVolt", "RCurrent", "RFreq", "SVolt", "SCurrent", "TVolt", "TCurrent", "invTemperation"];

async function devicesOf(req: ReturnType<typeof client>) {
  return arr(obj(await req("POST", "/op/v0/device/list", { currentPage: 1, pageSize: 100 })).data);
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const req = client(creds, fetch);
  const plants = arr(obj(await req("POST", "/op/v0/plant/list", { currentPage: 1, pageSize: 100 })).data);
  const devices = await devicesOf(req);
  return pool(plants, 2, async (p) => {
    const id = str(p.stationID);
    let detail: Record<string, unknown> = {};
    try {
      detail = obj(await req("GET", "/op/v0/plant/detail", undefined, `?id=${encodeURIComponent(id)}`));
    } catch {
      detail = {};
    }
    const mine = devices.filter((d) => str(d.stationID) === id);
    let today = 0, month = 0, total = 0, power = 0, any = false;
    for (const d of mine) {
      await sleep(300);
      try {
        const g = obj(await req("GET", "/op/v0/device/generation", undefined, `?sn=${encodeURIComponent(str(d.deviceSN))}`));
        today += num(g.today) ?? 0;
        month += num(g.month) ?? 0;
        total += num(g.cumulative) ?? 0;
        any = true;
      } catch {
        /* segue sem os números deste inversor */
      }
    }
    try {
      if (mine.length) {
        const rt = arr(await req("POST", "/op/v1/device/real/query", { sns: mine.map((d) => str(d.deviceSN)), variables: ["generationPower"] }));
        for (const r of rt) power += num(flatten(r.datas, "variable").generationPower) ?? 0;
      }
    } catch {
      /* sem potência agora */
    }
    const statuses = mine.map((d) => STATUS[str(d.status)] ?? "unknown");
    return {
      externalId: id,
      name: str(p.name ?? detail.stationName) || `Usina ${id}`,
      capacityKwp: num(detail.capacity),
      powerKw: mine.length ? power : null,
      todayKwh: any ? today : null,
      monthKwh: any ? month : null,
      totalKwh: any ? total : null,
      status: statuses.includes("alarm") ? "alarm" : statuses.includes("online") ? "online" : statuses.includes("offline") ? "offline" : "unknown",
      lastUpdate: null,
      address: [str(detail.address), str(detail.city)].filter(Boolean).join(", ") || null,
    };
  });
}

async function report(creds: Credentials, plantId: string, fetch: Fetch, dimension: "month" | "year", year: number, month?: number) {
  const req = client(creds, fetch);
  const mine = (await devicesOf(req)).filter((d) => str(d.stationID) === plantId);
  const totals: number[] = [];
  for (const d of mine) {
    await sleep(300);
    const body: Record<string, unknown> = { sn: str(d.deviceSN), year, dimension, variables: ["generation"] };
    if (month) body.month = month;
    const r = arr(await req("POST", "/op/v0/device/report/query", body));
    const gen = r.find((x) => str(x.variable) === "generation") ?? r[0];
    const values = Array.isArray(gen?.values) ? (gen.values as unknown[]) : [];
    values.forEach((v, i) => (totals[i] = (totals[i] ?? 0) + (num(v) ?? 0)));
  }
  return totals;
}

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch): Promise<DayValue[]> {
  const [y, m] = month.split("-").map(Number);
  const values = await report(creds, plantId, fetch, "month", y, m);
  return values.map((kwh, i) => ({ day: `${month}-${String(i + 1).padStart(2, "0")}`, kwh }));
}

async function fetchMonths(creds: Credentials, plantId: string, year: string, fetch: Fetch): Promise<MonthValue[]> {
  const values = await report(creds, plantId, fetch, "year", Number(year));
  return values.map((kwh, i) => ({ month: `${year}-${String(i + 1).padStart(2, "0")}`, kwh }));
}

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const req = client(creds, fetch);
  const mine = (await devicesOf(req)).filter((d) => str(d.stationID) === plantId);
  if (!mine.length) return [];
  const rt = arr(await req("POST", "/op/v1/device/real/query", { sns: mine.map((d) => str(d.deviceSN)), variables: VARS }));
  return mine.map((d) => {
    const r = rt.find((x) => str(x.deviceSN) === str(d.deviceSN)) ?? {};
    const v = flatten(r.datas, "variable");
    return deviceFrom(
      {
        sn: str(d.deviceSN),
        name: str(d.deviceType ?? d.productType) || str(d.deviceSN),
        model: str(d.deviceType) || null,
        status: STATUS[str(d.status)] ?? "unknown",
        powerKw: toKw(v.generationPower, "kW"),
        todayKwh: num(v.todayYield),
        totalKwh: null,
        updatedAt: toIso(r.time ?? null),
      },
      v,
    );
  });
}

export const foxess: ProviderAdapter = { id: "foxess", fetchPlants, fetchDays, fetchMonths, fetchDevices };
