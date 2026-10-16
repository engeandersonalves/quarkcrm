import { deviceFrom } from "../electrical.ts";
import { MonitoringError, type Credentials, type DayValue, type DeviceData, type Fetch, type MonthValue, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw, toKwh } from "../units.ts";
import { arr, call, obj, readJson, sleep, str } from "./http.ts";

/** Huawei FusionSolar Northbound API (login → XSRF-TOKEN). */
export const HUAWEI_HOSTS: Record<string, string> = {
  la5: "https://la5.fusionsolar.huawei.com",
  intl: "https://intl.fusionsolar.huawei.com",
  eu5: "https://eu5.fusionsolar.huawei.com",
  region01eu5: "https://region01eu5.fusionsolar.huawei.com",
};

const HEALTH: Record<string, PlantStatus> = { "1": "offline", "2": "alarm", "3": "online" };

function check(d: Record<string, unknown>, what: string) {
  if (d.success === true) return;
  const code = Number(d.failCode ?? -1);
  if (code === 305) throw new MonitoringError("FusionSolar: sessão expirada. Tente sincronizar de novo.");
  if (code === 407) throw new MonitoringError("FusionSolar: limite de consultas atingido. A Huawei libera de novo em alguns minutos.");
  if (code === 20001 || code === 20003) throw new MonitoringError("FusionSolar: usuário ou senha da API inválidos.");
  throw new MonitoringError(`FusionSolar: não foi possível ${what}${d.message ? ` (${str(d.message)})` : ""}.`);
}

async function login(creds: Credentials, fetch: Fetch) {
  const base = HUAWEI_HOSTS[creds.host] ?? HUAWEI_HOSTS.la5;
  const res = await call(fetch, `${base}/thirdData/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: creds.userName.trim(), systemCode: creds.systemCode }),
  }, "FusionSolar");
  const token = res.headers.get("xsrf-token") ?? /XSRF-TOKEN=([^;]+)/i.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
  check(await readJson(res, "FusionSolar"), "entrar");
  if (!token) throw new MonitoringError("FusionSolar: o servidor não devolveu a sessão. Confira o servidor escolhido.");
  const headers = { "Content-Type": "application/json", "XSRF-TOKEN": token };
  const post = async (path: string, body: unknown, what: string) => {
    const d = await readJson(await call(fetch, `${base}/thirdData/${path}`, { method: "POST", headers, body: JSON.stringify(body) }, "FusionSolar"), "FusionSolar");
    check(d, what);
    return d;
  };
  return { base, headers, post };
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const { base, headers } = await login(creds, fetch);

  // Lista de usinas (API nova /stations; se indisponível, a antiga /getStationList)
  let plants: { code: string; name: string; address: string | null; capacityKwp: number | null }[] = [];
  const first = await readJson(await call(fetch, `${base}/thirdData/stations`, { method: "POST", headers, body: JSON.stringify({ pageNo: 1 }) }, "FusionSolar"), "FusionSolar");
  if (first.success === true) {
    const pages = Number(obj(first.data).pageCount ?? 1);
    const add = (d: Record<string, unknown>) =>
      arr(obj(d.data).list).forEach((p) => plants.push({ code: str(p.plantCode), name: str(p.plantName), address: str(p.plantAddress) || null, capacityKwp: num(p.capacity) }));
    add(first);
    for (let page = 2; page <= Math.min(pages, 20); page++) {
      await sleep(400);
      const d = await readJson(await call(fetch, `${base}/thirdData/stations`, { method: "POST", headers, body: JSON.stringify({ pageNo: page }) }, "FusionSolar"), "FusionSolar");
      check(d, "listar as usinas");
      add(d);
    }
  } else {
    const old = await readJson(await call(fetch, `${base}/thirdData/getStationList`, { method: "POST", headers, body: "{}" }, "FusionSolar"), "FusionSolar");
    check(old, "listar as usinas");
    plants = arr(old.data).map((p) => ({ code: str(p.stationCode), name: str(p.stationName), address: str(p.stationAddr) || null, capacityKwp: num(p.capacity) === null ? null : num(p.capacity)! * 1000 }));
  }

  // Indicadores em tempo real, até 100 usinas por chamada
  const kpi = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < plants.length; i += 100) {
    const codes = plants.slice(i, i + 100).map((p) => p.code).join(",");
    const d = await readJson(await call(fetch, `${base}/thirdData/getStationRealKpi`, { method: "POST", headers, body: JSON.stringify({ stationCodes: codes }) }, "FusionSolar"), "FusionSolar");
    check(d, "ler a geração");
    arr(d.data).forEach((k) => kpi.set(str(k.stationCode), obj(k.dataItemMap)));
    if (i + 100 < plants.length) await sleep(400);
  }

  return plants.map((p) => {
    const k = kpi.get(p.code) ?? {};
    return {
      externalId: p.code,
      name: p.name || p.code,
      capacityKwp: p.capacityKwp,
      powerKw: null,
      todayKwh: toKwh(k.day_power, "kWh"),
      monthKwh: toKwh(k.month_power, "kWh"),
      totalKwh: toKwh(k.total_power, "kWh"),
      status: HEALTH[str(k.real_health_state)] ?? "unknown",
      lastUpdate: null,
      address: p.address,
    };
  });
}

/** Meio-dia (horário de Brasília) do primeiro dia do mês/ano, em ms. */
const collect = (iso: string) => new Date(`${iso}T12:00:00-03:00`).getTime();
const localDay = (ms: unknown) => new Date(Number(ms) - 3 * 3600_000).toISOString().slice(0, 10);

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch): Promise<DayValue[]> {
  const { post } = await login(creds, fetch);
  const d = await post("getKpiStationDay", { stationCodes: plantId, collectTime: collect(`${month}-01`) }, "ler a geração diária");
  return arr(d.data)
    .map((r) => {
      const m = obj(r.dataItemMap);
      return { day: localDay(r.collectTime), kwh: toKwh(m.inverter_power ?? m.PVYield ?? m.product_power, "kWh") ?? 0 };
    })
    .filter((x) => x.day.startsWith(month));
}

async function fetchMonths(creds: Credentials, plantId: string, year: string, fetch: Fetch): Promise<MonthValue[]> {
  const { post } = await login(creds, fetch);
  const d = await post("getKpiStationMonth", { stationCodes: plantId, collectTime: collect(`${year}-01-01`) }, "ler a geração mensal");
  return arr(d.data)
    .map((r) => {
      const m = obj(r.dataItemMap);
      return { month: localDay(r.collectTime).slice(0, 7), kwh: toKwh(m.inverter_power ?? m.PVYield ?? m.product_power, "kWh") ?? 0 };
    })
    .filter((x) => x.month.startsWith(year));
}

const RUN: Record<string, PlantStatus> = { "0": "offline", "1": "online", "2": "offline" };

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const { post } = await login(creds, fetch);
  const devs = arr((await post("getDevList", { stationCodes: plantId }, "listar os inversores")).data).filter((d) => [1, 38].includes(Number(d.devTypeId)));
  const out: DeviceData[] = [];
  for (const type of [1, 38]) {
    const group = devs.filter((d) => Number(d.devTypeId) === type);
    if (!group.length) continue;
    await sleep(400);
    const kpi = arr((await post("getDevRealKpi", { devIds: group.map((d) => str(d.id)).join(","), devTypeId: type }, "ler os inversores")).data);
    for (const k of kpi) {
      const dev = group.find((d) => str(d.id) === str(k.devId)) ?? {};
      const m = obj(k.dataItemMap);
      out.push(
        deviceFrom(
          {
            sn: str(dev.esnCode ?? k.sn ?? k.devId),
            name: str(dev.devName) || str(dev.esnCode),
            model: str(dev.model ?? dev.invType) || null,
            status: RUN[str(m.run_state)] ?? "unknown",
            powerKw: toKw(m.active_power, "kW"),
            todayKwh: toKwh(m.day_cap, "kWh"),
            totalKwh: toKwh(m.total_cap, "kWh"),
            updatedAt: toIso(m.collectTime ?? null),
          },
          m,
        ),
      );
    }
  }
  return out;
}

export const huawei: ProviderAdapter = { id: "huawei", fetchPlants, fetchDays, fetchMonths, fetchDevices };
