import { constants, createCipheriv, createDecipheriv, publicEncrypt, randomBytes } from "node:crypto";
import { deviceFrom } from "../electrical.ts";
import { MonitoringError, type Credentials, type DeviceData, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
import { num, toIso, toKw, toKwh, toKwp, valueUnit } from "../units.ts";
import { arr, call, obj, readJson, str } from "./http.ts";

/**
 * iSolarCloud OpenAPI (Sungrow). Login com usuário/senha + App Key/Access Key.
 * Contas com "RSA Key" usam o envelope criptografado: corpo AES-128-ECB (hex) e a
 * chave AES cifrada com a RSA Key no cabeçalho x-random-secret-key.
 */
export const SUNGROW_HOSTS: Record<string, string> = {
  intl: "https://gateway.isolarcloud.com.hk",
  eu: "https://gateway.isolarcloud.eu",
  au: "https://augateway.isolarcloud.com",
  cn: "https://gateway.isolarcloud.com",
};

/** Aceita a RSA Key em PEM ou em base64 (comum ou "url-safe") e devolve PEM. */
export function toPem(key: string) {
  const k = key.trim();
  if (k.includes("BEGIN")) return k;
  const b64 = k.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return `-----BEGIN PUBLIC KEY-----\n${padded.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----\n`;
}

const rsa = (value: string, pem: string) => publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(value)).toString("base64");

export function aesEncrypt(payload: unknown, key: string) {
  const c = createCipheriv("aes-128-ecb", Buffer.from(key), null);
  return Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]).toString("hex").toUpperCase();
}
export function aesDecrypt(hex: string, key: string) {
  const d = createDecipheriv("aes-128-ecb", Buffer.from(key), null);
  return JSON.parse(Buffer.concat([d.update(Buffer.from(hex.trim(), "hex")), d.final()]).toString("utf8"));
}

const randomKey = () => "web" + randomBytes(16).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 13).padEnd(13, "x");

async function post(fetch: Fetch, host: string, path: string, body: Record<string, unknown>, creds: Credentials, userId = "") {
  const headers: Record<string, string> = { "Content-Type": "application/json;charset=UTF-8", "x-access-key": creds.accessKey.trim(), sys_code: "901" };
  if (creds.rsaKey?.trim()) {
    const pem = toPem(creds.rsaKey);
    const key = randomKey();
    headers["x-random-secret-key"] = rsa(key, pem);
    headers["x-limit-obj"] = rsa(userId, pem);
    const payload = { ...body, api_key_param: { timestamp: Date.now(), nonce: randomBytes(16).toString("hex") } };
    const res = await call(fetch, host + path, { method: "POST", headers, body: aesEncrypt(payload, key) }, "iSolarCloud");
    const text = await res.text();
    if (!res.ok) throw new MonitoringError(`iSolarCloud: o servidor respondeu ${res.status}.`);
    try {
      return /^[0-9A-Fa-f]+$/.test(text.trim()) ? aesDecrypt(text, key) : JSON.parse(text);
    } catch {
      throw new MonitoringError("iSolarCloud: não foi possível ler a resposta. Confira a RSA Key.");
    }
  }
  const res = await call(fetch, host + path, { method: "POST", headers, body: JSON.stringify(body) }, "iSolarCloud");
  return readJson(res, "iSolarCloud");
}

export function mapSungrowStation(s: Record<string, unknown>): PlantData {
  const fault = str(s.ps_fault_status);
  const online = str(s.online_status ?? s.ps_status);
  const status: PlantStatus = fault === "1" || fault === "2" ? "alarm" : online === "0" ? "offline" : online === "" ? "unknown" : "online";
  const [cap, capU] = valueUnit(s.total_capcity ?? s.design_capacity);
  const [pw, pwU] = valueUnit(s.curr_power);
  const [td, tdU] = valueUnit(s.today_energy);
  const [tt, ttU] = valueUnit(s.total_energy);
  return {
    externalId: str(s.ps_id),
    name: str(s.ps_name) || `Usina ${str(s.ps_id)}`,
    capacityKwp: toKwp(cap, capU ?? (s.design_capacity !== undefined && num(cap)! > 1000 ? "Wp" : "kWp")),
    powerKw: toKw(pw, pwU ?? "W"),
    todayKwh: toKwh(td, tdU ?? "kWh"),
    monthKwh: null,
    totalKwh: toKwh(tt, ttU ?? "kWh"),
    status,
    lastUpdate: toIso(s.update_time ?? s.ps_last_update_time ?? null),
    address: str(s.ps_location) || null,
  };
}

async function session(creds: Credentials, fetch: Fetch) {
  const host = SUNGROW_HOSTS[creds.server] ?? SUNGROW_HOSTS.intl;
  const appkey = creds.appKey.trim();
  const login = await post(fetch, host, "/openapi/login", { appkey, user_account: creds.account.trim(), user_password: creds.password, lang: "_en_US" }, creds);
  const rd = obj(login.result_data);
  const token = str(rd.token);
  if (str(login.result_code) !== "1" || !token || str(rd.login_state) === "0") {
    const why = str(rd.msg) || str(login.result_msg) || "login recusado";
    throw new MonitoringError(`iSolarCloud: ${why}. Confira App Key, Access Key, usuário, senha e o servidor escolhido.`);
  }
  const userId = str(rd.user_id);
  return { host, appkey, token, userId };
}

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
  const { host, appkey, token, userId } = await session(creds, fetch);
  const out: PlantData[] = [];
  for (let page = 1; page <= 20; page++) {
    const d = await post(fetch, host, "/openapi/getPowerStationList", { appkey, token, user_id: userId, curPage: page, size: 100, lang: "_en_US" }, creds, userId);
    if (str(d.result_code) !== "1") throw new MonitoringError(`iSolarCloud: ${str(d.result_msg) || "não foi possível listar as usinas"}.`);
    const list = arr(obj(d.result_data).pageList);
    out.push(...list.map(mapSungrowStation));
    if (list.length < 100) break;
  }
  return out;
}

/**
 * Pontos de medição dos inversores na OpenAPI (Wh/W/V/A/°C/Hz):
 * p1 geração do dia, p2 total, p4 temperatura, p5–p8 MPPT1/2 (V, A),
 * p18–p20 tensão das fases, p21–p23 corrente das fases, p24 potência ativa, p27 frequência.
 */
const POINTS = ["p1", "p2", "p4", "p5", "p6", "p7", "p8", "p45", "p46", "p47", "p48", "p18", "p19", "p20", "p21", "p22", "p23", "p24", "p27"];

async function fetchDevices(creds: Credentials, plantId: string, fetch: Fetch): Promise<DeviceData[]> {
  const { host, appkey, token, userId } = await session(creds, fetch);
  const list = await post(fetch, host, "/openapi/getDeviceList", { appkey, token, user_id: userId, ps_id: plantId, curPage: 1, size: 100, lang: "_en_US" }, creds, userId);
  const inverters = arr(obj(list.result_data).pageList).filter((d) => Number(d.device_type) === 1);
  if (!inverters.length) return [];
  const rt = await post(fetch, host, "/openapi/getDeviceRealTimeData", { appkey, token, user_id: userId, device_type: 1, ps_key_list: inverters.map((d) => str(d.ps_key)), point_id_list: POINTS.map((p) => p.slice(1)), lang: "_en_US" }, creds, userId);
  const points = arr(obj(rt.result_data).device_point_list).map((x) => obj(x.device_point ?? x));
  return inverters.map((inv) => {
    const p = points.find((x) => str(x.ps_key) === str(inv.ps_key)) ?? {};
    const raw = {
      upv1: p.p5, ipv1: p.p6, upv2: p.p7, ipv2: p.p8, upv3: p.p45, ipv3: p.p46, upv4: p.p47, ipv4: p.p48,
      uacr: p.p18, uacs: p.p19, uact: p.p20, iacr: p.p21, iacs: p.p22, iact: p.p23,
      fac: p.p27, temperature: p.p4,
    };
    return deviceFrom(
      {
        sn: str(inv.device_sn ?? inv.ps_key),
        name: str(inv.device_name) || str(inv.device_sn),
        model: str(inv.device_model_code ?? inv.type_name) || null,
        status: str(inv.dev_fault_status) === "1" ? "alarm" : str(inv.dev_status) === "0" ? "offline" : "online",
        powerKw: toKw(p.p24, "W"),
        todayKwh: toKwh(p.p1, "Wh"),
        totalKwh: toKwh(p.p2, "Wh"),
        updatedAt: toIso(p.device_time ?? null),
      },
      raw,
    );
  });
}

export const sungrow: ProviderAdapter = { id: "sungrow", fetchPlants, fetchDevices };
