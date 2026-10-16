import { MonitoringError, type Credentials, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso } from "../units.ts";
import { arr, call, obj, pool, readJson, str } from "./http.ts";

/** Livoltek (API oficial do portal): login com Security ID + chave, token na query. */
const BASE = "https://api.livoltek-portal.com:8081";

const okCode = (d: Record<string, unknown>) => d.code === undefined || ["0", "200", "operate.success", "SUCCESS"].includes(str(d.code)) || Number(d.code) === 0 || Number(d.code) === 200;

const STATUS: Record<string, PlantStatus> = { "1": "online", "0": "offline", "2": "alarm", "3": "offline", NORMAL: "online", OFFLINE: "offline", FAULT: "alarm" };

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const login = await readJson(await call(fetch, `${BASE}/hess/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secuid: creds.secuid.trim(), key: creds.key.trim() }) }, "Livoltek"), "Livoltek");
  const token = typeof login.data === "string" ? login.data : str(obj(login.data).token ?? obj(login.data).userToken);
  if (!okCode(login) || !token) throw new MonitoringError(`Livoltek: ${str(login.message) || "login recusado"}. Confira o Security ID e a chave.`);
  const q = `userToken=${encodeURIComponent(token)}`;
  const get = async (path: string) => {
    const d = await readJson(await call(fetch, `${BASE}${path}${path.includes("?") ? "&" : "?"}${q}`, { method: "GET", headers: { Accept: "application/json" } }, "Livoltek"), "Livoltek");
    if (!okCode(d)) throw new MonitoringError(`Livoltek: ${str(d.message) || "consulta recusada"}.`);
    return d;
  };
  const sites = arr(obj((await get("/hess/api/userSites/list?page=1&size=100")).data).list);
  return pool(sites, 3, async (s) => {
    const id = str(s.powerStationId);
    let ov: Record<string, unknown> = {};
    try {
      ov = obj((await get(`/hess/api/site/${encodeURIComponent(id)}/overview`)).data);
    } catch {
      ov = {};
    }
    return {
      externalId: id,
      name: str(s.powerStationName ?? ov.name) || `Usina ${id}`,
      capacityKwp: num(s.pvCapacity),
      powerKw: num(ov.currentPower),
      todayKwh: num(ov.eoutDaily),
      monthKwh: num(ov.eoutMonth),
      totalKwh: num(ov.eTotalToGrid),
      status: STATUS[str(s.powerStationStatus).toUpperCase()] ?? "unknown",
      lastUpdate: toIso(ov.updateTime ?? s.updateTime ?? null),
      address: [str(s.administrativeRegion), str(s.country)].filter(Boolean).join(" - ") || null,
    };
  });
}

export const livoltek: ProviderAdapter = { id: "livoltek", fetchPlants };
