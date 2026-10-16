import { deviceFrom } from "../electrical.ts";
import { MonitoringError, type Credentials, type DeviceData, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw, toKwh } from "../units.ts";
import { arr, call, obj, pool, readJson, str } from "./http.ts";

/**
 * GoodWe SEMS Portal (API do portal/app): login CrossLogin devolve o token e o
 * servidor regional; as chamadas seguintes levam o token no cabeçalho "Token".
 */
const LOGIN = "https://www.semsportal.com/api/v2/Common/CrossLogin";
const BASE_TOKEN = { version: "v2.1.0", client: "ios", language: "pt" };

async function session(creds: Credentials, fetch: Fetch) {
  const res = await call(fetch, LOGIN, { method: "POST", headers: { "Content-Type": "application/json", Token: JSON.stringify(BASE_TOKEN) }, body: JSON.stringify({ account: creds.account.trim(), pwd: creds.password }) }, "SEMS Portal");
  const d = await readJson(res, "SEMS Portal");
  const data = obj(d.data);
  if (Number(d.code ?? -1) !== 0 || !data.token) throw new MonitoringError(`SEMS Portal: ${str(d.msg) || "login recusado"}. Confira o e-mail e a senha do SEMS.`);
  const api = str(d.api ?? obj(d.components).api).replace(/\/$/, "") || "https://semsportal.com/api";
  if (!/^https:\/\/([a-z0-9-]+\.)?semsportal\.com\/api$/i.test(api)) throw new MonitoringError("SEMS Portal: servidor regional inesperado.");
  const headers = { "Content-Type": "application/json", Token: JSON.stringify({ ...BASE_TOKEN, ...data }) };
  const post = async (path: string, body: unknown) => {
    const r = await readJson(await call(fetch, `${api}/${path}`, { method: "POST", headers, body: JSON.stringify(body) }, "SEMS Portal"), "SEMS Portal");
    if (Number(r.code ?? 0) !== 0) throw new MonitoringError(`SEMS Portal: ${str(r.msg) || "consulta recusada"}.`);
    return r;
  };
  return { post };
}

const STATUS: Record<string, PlantStatus> = { "1": "online", "0": "unknown", "-1": "offline", "2": "alarm", "3": "alarm" };

async function detail(post: (p: string, b: unknown) => Promise<Record<string, unknown>>, id: string) {
  return obj((await post("v2/PowerStation/GetMonitorDetailByPowerstationId", { powerStationId: id })).data);
}

function mapPlant(id: string, d: Record<string, unknown>, listItem: Record<string, unknown> = {}): PlantData {
  const info = obj(d.info);
  const kpi = obj(d.kpi);
  return {
    externalId: id,
    name: str(info.stationname ?? listItem.stationname ?? listItem.pw_name ?? listItem.name) || `Usina ${id}`,
    capacityKwp: num(info.capacity ?? listItem.capacity),
    powerKw: toKw(kpi.pac ?? listItem.pac, "W"),
    todayKwh: num(kpi.power ?? listItem.eday),
    monthKwh: num(kpi.month_generation),
    totalKwh: num(kpi.total_power ?? listItem.etotal),
    status: STATUS[str(info.status ?? listItem.status)] ?? "unknown",
    lastUpdate: toIso(info.time ?? null),
    address: str(info.address ?? listItem.location ?? listItem.address) || null,
  };
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const { post } = await session(creds, fetch);
  // Conta de instalador: lista paginada; conta de cliente: usina do proprietário
  let items: Record<string, unknown>[] = [];
  try {
    const r = await post("v2/HistoryData/QueryPowerStationByHistory", {});
    items = arr(obj(r.data).list ?? r.data);
  } catch {
    items = [];
  }
  if (!items.length) {
    const r = await post("v1/PowerStation/GetPowerStationIdByOwner", {}).catch(() => ({ data: null }));
    const id = str(r.data);
    if (id) items = [{ id }];
  }
  if (!items.length) return [];
  return pool(items, 3, async (it) => {
    const id = str(it.id ?? it.powerstation_id ?? it.stationId);
    try {
      return mapPlant(id, await detail(post, id), it);
    } catch {
      return mapPlant(id, {}, it);
    }
  });
}

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const { post } = await session(creds, fetch);
  const d = await detail(post, plantId);
  return arr(d.inverter).map((inv) => {
    const full = obj(inv.invert_full);
    return deviceFrom(
      {
        sn: str(inv.sn ?? full.sn),
        name: str(inv.name ?? full.name) || str(inv.sn),
        model: str(full.model_type ?? inv.type) || null,
        status: STATUS[str(inv.status ?? full.status)] ?? "unknown",
        powerKw: toKw(inv.out_pac ?? full.pac, "W"),
        todayKwh: toKwh(inv.eday ?? full.eday, "kWh"),
        totalKwh: toKwh(inv.etotal ?? full.etotal, "kWh"),
        updatedAt: toIso(full.last_time ?? inv.last_refresh_time ?? null),
      },
      full,
    );
  });
}

export const goodwe: ProviderAdapter = { id: "goodwe", fetchPlants, fetchDevices };
