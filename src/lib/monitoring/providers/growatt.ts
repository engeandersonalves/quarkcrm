import { deviceFrom } from "../electrical.ts";
import { MonitoringError, type Credentials, type DayValue, type DeviceData, type Fetch, type MonthValue, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw } from "../units.ts";
import { arr, call, obj, pool, readJson, str } from "./http.ts";

/** Growatt OpenAPI v1 (token no cabeçalho). */
export const GROWATT_HOSTS: Record<string, string> = {
  global: "https://openapi.growatt.com",
  us: "https://openapi-us.growatt.com",
  cn: "https://openapi-cn.growatt.com",
  au: "https://openapi-au.growatt.com",
};

const STATUS: Record<string, PlantStatus> = { "0": "offline", "1": "online", "2": "alarm", "3": "offline", "4": "alarm" };

function check(d: Record<string, unknown>) {
  const code = Number(d.error_code ?? 0);
  if (code === 10011 || code === 10012) throw new MonitoringError("Growatt: token inválido ou sem permissão.");
  if (code === 10006 || code === 10007) throw new MonitoringError("Growatt: muitas consultas seguidas. Tente de novo em alguns minutos.");
  if (code !== 0) throw new MonitoringError(`Growatt: ${str(d.error_msg) || "erro " + code}.`);
}

export function mapGrowattPlant(p: Record<string, unknown>, data: Record<string, unknown> = {}): PlantData {
  const power = num(data.current_power ?? p.current_power);
  return {
    externalId: str(p.plant_id),
    name: str(p.name) || `Usina ${str(p.plant_id)}`,
    capacityKwp: num(p.peak_power),
    powerKw: power,
    todayKwh: num(data.today_energy),
    monthKwh: num(data.monthly_energy),
    totalKwh: num(data.total_energy ?? p.total_energy),
    status: STATUS[str(p.status)] ?? (power && power > 0 ? "online" : "unknown"),
    lastUpdate: toIso(data.last_update_time ?? null),
    address: [str(p.city), str(p.country)].filter(Boolean).join(" - ") || null,
  };
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const base = GROWATT_HOSTS[creds.server] ?? GROWATT_HOSTS.global;
  const headers = { token: creds.token.trim() };
  const plants: Record<string, unknown>[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await call(fetch, `${base}/v1/plant/list?page=${page}&perpage=100`, { method: "GET", headers }, "Growatt");
    const d = await readJson(res, "Growatt");
    check(d);
    const list = arr(obj(d.data).plants);
    plants.push(...list);
    if (list.length < 100) break;
  }
  return pool(plants, 3, async (p) => {
    try {
      const res = await call(fetch, `${base}/v1/plant/data?plant_id=${encodeURIComponent(str(p.plant_id))}`, { method: "GET", headers }, "Growatt");
      const d = await readJson(res, "Growatt");
      check(d);
      return mapGrowattPlant(p, obj(d.data));
    } catch {
      return mapGrowattPlant(p);
    }
  });
}

async function get(creds: Credentials, path: string, fetch: Fetch) {
  const base = GROWATT_HOSTS[creds.server] ?? GROWATT_HOSTS.global;
  const d = await readJson(await call(fetch, `${base}/v1/${path}`, { method: "GET", headers: { token: creds.token.trim() } }, "Growatt"), "Growatt");
  check(d);
  return obj(d.data);
}
async function postForm(creds: Credentials, path: string, form: Record<string, string>, fetch: Fetch) {
  const base = GROWATT_HOSTS[creds.server] ?? GROWATT_HOSTS.global;
  const d = await readJson(
    await call(fetch, `${base}/v1/${path}`, { method: "POST", headers: { token: creds.token.trim(), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() }, "Growatt"),
    "Growatt",
  );
  check(d);
  return obj(d.data);
}

const energys = (d: Record<string, unknown>) => arr(d.energys ?? d.energys_list ?? d.datas);

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch): Promise<DayValue[]> {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: DayValue[] = [];
  // No modo "day" a Growatt aceita no máximo 7 dias por consulta
  for (let start = 1; start <= last; start += 7) {
    const end = Math.min(last, start + 6);
    const d = await get(creds, `plant/energy?plant_id=${encodeURIComponent(plantId)}&start_date=${month}-${String(start).padStart(2, "0")}&end_date=${month}-${String(end).padStart(2, "0")}&time_unit=day`, fetch);
    for (const e of energys(d)) out.push({ day: str(e.date).slice(0, 10), kwh: num(e.energy) ?? 0 });
  }
  return out.filter((x) => x.day.startsWith(month));
}

async function fetchMonths(creds: Credentials, plantId: string, year: string, fetch: Fetch): Promise<MonthValue[]> {
  const d = await get(creds, `plant/energy?plant_id=${encodeURIComponent(plantId)}&start_date=${year}-01-01&end_date=${year}-12-31&time_unit=month`, fetch);
  return energys(d)
    .map((e) => ({ month: str(e.date).slice(0, 7), kwh: num(e.energy) ?? 0 }))
    .filter((x) => x.month.startsWith(year));
}

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const list = arr((await get(creds, `device/list?plant_id=${encodeURIComponent(plantId)}&page=1&perpage=100`, fetch)).devices);
  const inverters = list.filter((d) => [1, 4, 5, 6, 7].includes(Number(d.type ?? d.device_type)));
  return pool(inverters, 2, async (dev) => {
    const sn = str(dev.device_sn);
    const type = Number(dev.type ?? dev.device_type);
    let raw: Record<string, unknown> = {};
    try {
      raw =
        type === 7
          ? await postForm(creds, "device/tlx/tlx_last_data", { tlx_sn: sn }, fetch)
          : type === 5
            ? await postForm(creds, "device/mix/mix_last_data", { mix_sn: sn }, fetch)
            : await postForm(creds, "device/inverter/last_new_data", { device_sn: sn }, fetch);
    } catch {
      raw = {};
    }
    const r = obj(raw.data ?? raw);
    return deviceFrom(
      {
        sn,
        name: str(dev.alias ?? dev.device_sn) || sn,
        model: str(dev.model) || null,
        status: dev.lost === true ? "offline" : STATUS[str(dev.status)] ?? "unknown",
        powerKw: toKw(r.pac ?? r.ppv, "W"),
        todayKwh: num(r.eToday ?? r.e_today ?? r.epvToday ?? r.eacToday),
        totalKwh: num(r.eTotal ?? r.e_total ?? r.epvTotal ?? r.eacTotal),
        updatedAt: toIso(r.time ?? dev.last_update_time ?? null),
      },
      r,
    );
  });
}

export const growatt: ProviderAdapter = { id: "growatt", fetchPlants, fetchDays, fetchMonths, fetchDevices };
