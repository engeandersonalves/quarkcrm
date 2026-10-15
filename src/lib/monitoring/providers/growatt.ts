import { MonitoringError, type Credentials, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso } from "../units.ts";
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

export const growatt: ProviderAdapter = { id: "growatt", fetchPlants };
