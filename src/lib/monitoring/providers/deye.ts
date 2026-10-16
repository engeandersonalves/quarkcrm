import { createHash } from "node:crypto";
import { deviceFrom, flatten } from "../electrical.ts";
import { MonitoringError, type Credentials, type DayValue, type DeviceData, type Fetch, type MonthValue, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw, toKwh, todayIso } from "../units.ts";
import { arr, call, monthRange, pool, readJson, str } from "./http.ts";

/**
 * Deye Cloud (developer API) e Solarman OpenAPI usam o mesmo desenho:
 * token com appId/appSecret + senha SHA-256, lista de usinas e histórico diário.
 */
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const STATUS: Record<string, PlantStatus> = { NORMAL: "online", ALL_OFFLINE: "offline", PARTIAL_OFFLINE: "alarm", NO_DEVICE: "unknown", OFFLINE: "offline", ALARM: "alarm", FAULT: "alarm" };

interface Flavor {
  who: string;
  base: string;
  tokenPath: string;
  listPath: string;
  historyPath: string;
  historyBody: (stationId: unknown, start: string, end: string) => Record<string, unknown>;
  monthsBody: (stationId: unknown, year: string) => Record<string, unknown>;
  query: string; // extra na URL
  devices: (stationId: string, post: Post) => Promise<DeviceData[]>;
}

type Post = (path: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;

const DEVICE_STATUS: Record<string, PlantStatus> = { "1": "online", "0": "offline", "2": "alarm", NORMAL: "online", ONLINE: "online", OFFLINE: "offline", ALARM: "alarm", FAULT: "alarm" };

function deviceOf(sn: string, info: Record<string, unknown>, raw: Record<string, unknown>, updated: unknown): DeviceData {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (raw[k] !== undefined) return raw[k];
    return null;
  };
  const powerW = pick("TotalSolarPower", "TotalActiveProductionPower", "APo_t1", "ActivePower", "Total AC Output Power(Active)", "Total AC Output Power (Active)");
  return deviceFrom(
    {
      sn,
      name: str(info.deviceName ?? info.name) || sn,
      model: str(info.productId ?? info.deviceModel ?? info.model) || null,
      status: DEVICE_STATUS[str(info.connectStatus ?? info.deviceState ?? info.connectionStatus).toUpperCase()] ?? "unknown",
      powerKw: toKw(powerW, "W"),
      todayKwh: toKwh(pick("DailyActiveProduction", "Etdy_ge0", "Daily Production (Active)", "DailyProductionActive"), "kWh"),
      totalKwh: toKwh(pick("TotalActiveProduction", "Et_ge0", "Total Production (Active)", "TotalProductionActive"), "kWh"),
      updatedAt: toIso(updated),
    },
    raw,
  );
}

function deyeFlavor(creds: Credentials): Flavor {
  const region = creds.region === "us1" ? "us1" : "eu1";
  return {
    who: "Deye Cloud",
    base: `https://${region}-developer.deyecloud.com`,
    tokenPath: "/v1.0/account/token",
    listPath: "/v1.0/station/list",
    historyPath: "/v1.0/station/history",
    historyBody: (stationId, start, end) => ({ stationId, granularity: 2, startDate: start, endDate: end }),
    monthsBody: (stationId, year) => ({ stationId, granularity: 3, startDate: `${year}-01`, endDate: `${year}-12` }),
    query: "",
    devices: async (stationId, post) => {
      const d = await post("/v1.0/station/device", { stationIds: [Number(stationId) || stationId], page: 1, size: 50 });
      const items = arr(d.deviceListItems).filter((x) => !x.deviceType || /INVERTER/i.test(str(x.deviceType)));
      if (!items.length) return [];
      const latest = await post("/v1.0/device/latest", { deviceList: items.map((x) => str(x.deviceSn)) });
      const info = new Map(items.map((x) => [str(x.deviceSn), x]));
      return arr(latest.deviceDataList).map((x) => deviceOf(str(x.deviceSn), { ...info.get(str(x.deviceSn)), ...x }, flatten(x.dataList), x.collectionTime));
    },
  };
}

const solarmanFlavor: Flavor = {
  who: "Solarman",
  base: "https://globalapi.solarmanpv.com",
  tokenPath: "/account/v1.0/token",
  listPath: "/station/v1.0/list",
  historyPath: "/station/v1.0/history",
  historyBody: (stationId, start, end) => ({ stationId, timeType: 2, startTime: start, endTime: end }),
  monthsBody: (stationId, year) => ({ stationId, timeType: 3, startTime: `${year}-01`, endTime: `${year}-12` }),
  query: "&language=en",
  devices: async (stationId, post) => {
    const d = await post("/station/v1.0/device", { stationId: Number(stationId) || stationId, deviceType: "INVERTER" });
    const items = arr(d.deviceListItems);
    return pool(items, 2, async (x) => {
      const cur = await post("/device/v1.0/currentData", { deviceSn: str(x.deviceSn) }).catch(() => ({}) as Record<string, unknown>);
      return deviceOf(str(x.deviceSn), x, flatten(cur.dataList), cur.collectionTime);
    });
  },
};

export function tokenBody(creds: Credentials) {
  const account = creds.account.trim();
  const body: Record<string, string> = { appSecret: creds.appSecret.trim(), password: sha256(creds.password) };
  if (account.includes("@")) body.email = account;
  else if (/^\+?\d{8,}$/.test(account)) body.mobile = account.replace(/^\+/, "");
  else body.username = account;
  return body;
}

const ok = (d: Record<string, unknown>) => d.success !== false && (d.code === undefined || ["1000000", "0", 0].includes(d.code as string));

export function mapDeyeStation(s: Record<string, unknown>): PlantData {
  return {
    externalId: str(s.id),
    name: str(s.name) || `Usina ${str(s.id)}`,
    capacityKwp: num(s.installedCapacity),
    powerKw: toKw(s.generationPower, "W"),
    todayKwh: null,
    monthKwh: null,
    totalKwh: toKwh(s.generationTotal ?? null, "kWh"),
    status: STATUS[str(s.connectionStatus ?? s.networkStatus).toUpperCase()] ?? "unknown",
    lastUpdate: toIso(s.lastUpdateTime),
    address: str(s.locationAddress) || null,
  };
}

/** Itens diários do histórico → [{day, kwh}]. */
export function dailyFromItems(items: Record<string, unknown>[]) {
  return items
    .map((i) => {
      const y = num(i.year), m = num(i.month), d = num(i.day);
      const day = y && m && d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : toIso(i.timeStamp ?? i.dateTime)?.slice(0, 10) ?? null;
      const kwh = toKwh(i.generationValue, "kWh");
      return day && kwh !== null ? { day, kwh } : null;
    })
    .filter((x): x is { day: string; kwh: number } => !!x);
}

async function session(flavor: Flavor, creds: Credentials, fetch: Fetch) {
  const { who, base } = flavor;
  const tokenRes = await call(fetch, `${base}${flavor.tokenPath}?appId=${encodeURIComponent(creds.appId.trim())}${flavor.query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokenBody(creds)),
  }, who);
  const tk = await readJson(tokenRes, who);
  const token = str(tk.accessToken ?? tk.access_token);
  if (!ok(tk) || !token) throw new MonitoringError(`${who}: login recusado${tk.msg ? ` (${str(tk.msg)})` : ""}. Confira App ID, App Secret, usuário e senha.`);
  const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const qs = flavor.query ? "?" + flavor.query.slice(1) : "";
  const post: Post = async (path, body) => {
    const d = await readJson(await call(fetch, `${base}${path}${qs}`, { method: "POST", headers: auth, body: JSON.stringify(body) }, who), who);
    if (!ok(d)) throw new MonitoringError(`${who}: ${str(d.msg) || "consulta recusada"}.`);
    return d;
  };
  return { auth, post };
}

async function run(flavor: Flavor, creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const { who, base } = flavor;
  const { auth } = await session(flavor, creds, fetch);

  const stations: Record<string, unknown>[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await call(fetch, `${base}${flavor.listPath}${flavor.query ? "?" + flavor.query.slice(1) : ""}`, { method: "POST", headers: auth, body: JSON.stringify({ page, size: 100 }) }, who);
    const d = await readJson(res, who);
    if (!ok(d)) throw new MonitoringError(`${who}: ${str(d.msg) || "não foi possível listar as usinas"}.`);
    const list = arr(d.stationList);
    stations.push(...list);
    if (list.length < 100 || stations.length >= Number(d.total ?? 0)) break;
  }

  const { start, end } = monthRange();
  const today = todayIso();
  return pool(stations, 4, async (s) => {
    const plant = mapDeyeStation(s);
    try {
      const res = await call(fetch, `${base}${flavor.historyPath}${flavor.query ? "?" + flavor.query.slice(1) : ""}`, { method: "POST", headers: auth, body: JSON.stringify(flavor.historyBody(s.id, start, end)) }, who);
      const d = await readJson(res, who);
      const daily = dailyFromItems(arr(d.stationDataItems));
      if (daily.length) {
        plant.daily = daily;
        plant.todayKwh = daily.find((x) => x.day === today)?.kwh ?? 0;
        plant.monthKwh = daily.reduce((t, x) => t + x.kwh, 0);
      }
    } catch {
      // sem histórico: a usina entra com os dados da lista
    }
    return plant;
  });
}

function adapter(id: "deye" | "solarman", flavorOf: (c: Credentials) => Flavor): ProviderAdapter {
  return {
    id,
    fetchPlants: (c, f) => run(flavorOf(c), c, f),
    fetchDays: async (c, plantId, month, f): Promise<DayValue[]> => {
      const fl = flavorOf(c);
      const { post } = await session(fl, c, f);
      const [y, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const d = await post(fl.historyPath, fl.historyBody(Number(plantId) || plantId, `${month}-01`, `${month}-${String(last).padStart(2, "0")}`));
      return dailyFromItems(arr(d.stationDataItems)).filter((x) => x.day.startsWith(month));
    },
    fetchMonths: async (c, plantId, year, f): Promise<MonthValue[]> => {
      const fl = flavorOf(c);
      const { post } = await session(fl, c, f);
      const d = await post(fl.historyPath, fl.monthsBody(Number(plantId) || plantId, year));
      return arr(d.stationDataItems)
        .map((i) => ({ month: `${num(i.year) ?? year}-${String(num(i.month) ?? 0).padStart(2, "0")}`, kwh: toKwh(i.generationValue, "kWh") ?? 0 }))
        .filter((x) => x.month.startsWith(year) && !x.month.endsWith("-00"));
    },
    fetchDevices: async (c, plantId, f) => {
      const fl = flavorOf(c);
      const { post } = await session(fl, c, f);
      return fl.devices(plantId, post);
    },
  };
}

export const deye = adapter("deye", deyeFlavor);
export const solarman = adapter("solarman", () => solarmanFlavor);
