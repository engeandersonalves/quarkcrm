import { constants, createCipheriv, createDecipheriv, publicEncrypt, randomBytes } from "node:crypto";
import { MonitoringError, type Credentials, type Fetch, type PlantData, type PlantStatus, type ProviderAdapter } from "../types.ts";
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

async function fetchPlants(creds: Credentials, fetch: Fetch): Promise<PlantData[]> {
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

export const sungrow: ProviderAdapter = { id: "sungrow", fetchPlants };
