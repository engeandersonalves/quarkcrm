import { MonitoringError, type Credentials, type DayValue, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso } from "../units.ts";
import { call, obj, str } from "./http.ts";

/**
 * SolarZ (Open API do integrador): reúne num login só as usinas de todos os
 * fabricantes já cadastrados na SolarZ. Autenticação HTTP Basic com o
 * "Usuário de API" gerado em Configurações → Usuário de API.
 */
const BASE = "https://app.solarz.com.br";
const WHO = "SolarZ";

function basic(creds: Credentials) {
  return `Basic ${Buffer.from(`${creds.username.trim()}:${creds.password}`, "utf8").toString("base64")}`;
}

class HttpStatus extends MonitoringError {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function post(creds: Credentials, fetch: Fetch, path: string, body: Record<string, unknown> = {}, query = ""): Promise<unknown> {
  const res = await call(fetch, `${BASE}${path}${query}`, { method: "POST", headers: { Authorization: basic(creds), Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) }, WHO);
  const text = await res.text();
  if (res.status === 401 || res.status === 403)
    throw new HttpStatus("SolarZ: usuário ou senha recusados. Use o Usuário de API (Configurações → Usuário de API), não o e-mail e a senha de entrar na SolarZ.", res.status);
  if (res.status === 429) throw new HttpStatus("SolarZ: muitas consultas seguidas. Tente de novo em alguns minutos.", res.status);
  if (!res.ok) throw new HttpStatus(`SolarZ: o servidor respondeu ${res.status}.`, res.status);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new MonitoringError("SolarZ: resposta inesperada do servidor.");
  }
}

/** Primeira lista de objetos encontrada (a API embrulha em content/data/list conforme a rota). */
export function firstList(v: unknown, keys = ["content", "plants", "data", "list", "records", "items"]): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  const o = obj(v);
  for (const k of keys) {
    const found = firstList(o[k], keys);
    if (found.length || Array.isArray(o[k])) return found;
  }
  for (const val of Object.values(o)) {
    if (val && typeof val === "object") {
      const found = firstList(val, keys);
      if (found.length) return found;
    }
  }
  return [];
}

/** Primeiro valor presente entre vários nomes possíveis (também em objetos aninhados de 1 nível). */
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  for (const val of Object.values(row)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
    }
  }
  return undefined;
}

export function statusOf(v: unknown): PlantStatus {
  const s = str(obj(v).status ?? v).toUpperCase();
  if (!s) return "unknown";
  if (/OFF|SEM.?COMUN|DESCONECT|NO.?COMM|INATIV/.test(s)) return "offline";
  if (/ALERT|ALARM|WARN|FAULT|FALHA|ERRO|CRIT|BAIXA|ATEN/.test(s)) return "alarm";
  if (/ON|OK|NORMAL|GERANDO|ATIV/.test(s)) return "online";
  return "unknown";
}

async function listRows(creds: Credentials, fetch: Fetch, path: string) {
  const rows: Record<string, unknown>[] = [];
  // A rota rejeita page=0; começa em 1
  for (let page = 1; page <= 100; page++) {
    const p = { page: String(page), pageSize: "50" };
    const data = await post(creds, fetch, path, p, `?page=${page}&pageSize=50`);
    const list = firstList(data);
    rows.push(...list);
    const d = obj(data);
    const totalPages = Number(d.totalPages ?? 0);
    if (!list.length || d.last === true || !totalPages || page >= totalPages) break;
  }
  return rows;
}

async function energyMonth(creds: Credentials, fetch: Fetch, plantId: string, month: string): Promise<DayValue[]> {
  const data = await post(creds, fetch, `/openApi/seller/plant/energy/plantId/${encodeURIComponent(plantId)}/month/${month}`);
  return firstList(data)
    .map((r) => ({ day: str(r.date ?? r.day ?? r.data).slice(0, 10), kwh: num(r.total ?? r.energy ?? r.generation ?? r.value) ?? 0 }))
    .filter((d) => d.day.startsWith(month))
    .sort((a, b) => a.day.localeCompare(b.day));
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  let rows: Record<string, unknown>[] = [];
  try {
    rows = await listRows(creds, fetch, "/openApi/seller/plantWithInfos/list");
  } catch (e) {
    if (!(e instanceof HttpStatus) || ![400, 404, 405].includes(e.status)) throw e;
  }
  // Contas sem o plano com informações extras recebem lista vazia na rota detalhada
  if (!rows.length) rows = await listRows(creds, fetch, "/openApi/seller/plant/list");

  // Só a lista (1 chamada por página). A geração dia a dia é baixada aos poucos pelo sincronizador.
  return rows
    .filter((r) => r.id !== undefined && r.id !== null)
    .map((r) => {
      const id = str(r.id);
      const city = str(pick(r, ["city", "cidade", "cityName"]));
      const uf = str(pick(r, ["state", "uf", "estado", "stateAcronym"]));
      return {
        externalId: id,
        name: str(r.name ?? r.nome) || `Usina ${id}`,
        capacityKwp: num(pick(r, ["installedPower", "potenciaInstalada", "power", "capacity"])),
        powerKw: num(pick(r, ["currentPower", "lastPower", "instantPower", "powerNow"])),
        todayKwh: num(pick(r, ["energyToday", "todayEnergy", "geracaoHoje"])),
        monthKwh: num(pick(r, ["energyMonth", "monthEnergy"])),
        totalKwh: num(pick(r, ["energyProducedKwh", "totalEnergy", "energyTotal"])),
        status: statusOf(r.status ?? r.situation),
        lastUpdate: toIso(pick(r, ["lastUpdate", "lastCommunication", "updatedAt", "lastReading"]) ?? null),
        address: str(pick(r, ["address", "endereco"])) || [city, uf].filter(Boolean).join(" - ") || null,
      };
    });
}

async function fetchDays(creds: Credentials, plantId: string, month: string, fetch: Fetch) {
  return energyMonth(creds, fetch, plantId, month);
}

export const solarz: ProviderAdapter = { id: "solarz", fetchPlants, fetchDays };
