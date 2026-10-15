import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { test } from "node:test";
import { missingCredentials, PROVIDERS } from "./monitoring/catalog.ts";
import { openCredentials, sealCredentials } from "./monitoring/crypto.ts";
import { ADAPTERS } from "./monitoring/providers/index.ts";
import { solisHeaders } from "./monitoring/providers/solis.ts";
import { aesDecrypt, aesEncrypt } from "./monitoring/providers/sungrow.ts";
import { sortedPath } from "./monitoring/providers/solplanet.ts";
import { toIso, toKw, toKwh, toKwp } from "./monitoring/units.ts";

type Call = { url: string; init: RequestInit };
function fakeFetch(routes: (c: Call) => { status?: number; body: unknown; headers?: Record<string, string> } | string) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const c = { url, init };
    calls.push(c);
    const r = routes(c);
    if (typeof r === "string") return new Response(r, { status: 200 });
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers });
  };
  return { fetch, calls };
}
const hdr = (c: Call, k: string) => (c.init.headers as Record<string, string>)[k];
const body = (c: Call) => JSON.parse(String(c.init.body ?? "{}"));

test("unidades", () => {
  assert.equal(toKw(2548, "W"), 2.548);
  assert.equal(toKw(1.2, "MW"), 1200);
  assert.equal(toKwh(5, "MWh"), 5000);
  assert.equal(toKwp(8.5, "kWp"), 8.5);
  assert.equal(toKwp(1.2, "MWp"), 1200);
  assert.equal(toIso(1685592000000), "2023-06-01T04:00:00.000Z");
  assert.equal(toIso(1685592000), "2023-06-01T04:00:00.000Z");
});

test("credenciais criptografadas", () => {
  const sealed = sealCredentials({ token: "abc", senha: "x" }, "segredo");
  assert.ok(!sealed.includes("abc"));
  assert.deepEqual(openCredentials(sealed, "segredo"), { token: "abc", senha: "x" });
  assert.throws(() => openCredentials(sealed, "outro"));
  assert.deepEqual(missingCredentials("growatt", { server: "global" }), ["Token da API"]);
  assert.deepEqual(missingCredentials("sungrow", { server: "intl", appKey: "a", accessKey: "b", account: "c", password: "d" }), []);
  assert.equal(PROVIDERS.length, 7);
});

test("Solis: Content-MD5 e assinatura como no documento oficial", async () => {
  // Exemplo do SolisCloud API v2.0: corpo {"pageNo":1,"pageSize":10,"nmiCode":""}
  const h = solisHeaders("1300386381676565707", "segredo", { pageNo: 1, pageSize: 10, nmiCode: "" }, "/v1/api/userStationList", new Date("2023-05-31T09:12:23Z"));
  assert.equal(h.headers["Content-MD5"], createHash("md5").update('{"pageNo":1,"pageSize":10,"nmiCode":""}').digest("base64"));
  assert.equal(h.headers.Date, "Wed, 31 May 2023 09:12:23 GMT");
  const expected = createHmac("sha1", "segredo").update(`POST\n${h.headers["Content-MD5"]}\napplication/json\nWed, 31 May 2023 09:12:23 GMT\n/v1/api/userStationList`).digest("base64");
  assert.equal(h.headers.Authorization, `API 1300386381676565707:${expected}`);

  const { fetch, calls } = fakeFetch(() => ({
    body: { code: "0", msg: "success", data: { page: { pages: 1, records: [{ id: "130", stationName: "Padaria", capacity: 7.26, capacityStr: "kWp", power: 3420, powerStr: "W", dayEnergy: 21.5, dayEnergyStr: "kWh", monthEnergy: 0.41, monthEnergyStr: "MWh", allEnergy: 12.3, allEnergyStr: "MWh", state: 1, dataTimestamp: "1687846773000", addr: "Maceió" }] } } },
  }));
  const plants = await ADAPTERS.solis.fetchPlants({ keyId: "k", keySecret: "s" }, fetch);
  assert.equal(calls[0].url, "https://www.soliscloud.com:13333/v1/api/userStationList");
  assert.match(hdr(calls[0], "Authorization"), /^API k:/);
  assert.deepEqual(plants[0], { externalId: "130", name: "Padaria", capacityKwp: 7.26, powerKw: 3.42, todayKwh: 21.5, monthKwh: 410, totalKwh: 12300, status: "online", lastUpdate: "2023-06-27T06:19:33.000Z", address: "Maceió" });
});

test("Deye: token com senha SHA-256, lista e histórico do mês", async () => {
  const { fetch, calls } = fakeFetch((c) => {
    if (c.url.includes("/account/token")) return { body: { code: "1000000", success: true, accessToken: "TK" } };
    if (c.url.includes("/station/list")) return { body: { code: "1000000", success: true, total: 1, stationList: [{ id: 61521934, name: "Sítio", installedCapacity: 10.8, generationPower: 2548, connectionStatus: "NORMAL", lastUpdateTime: 1787624055 }] } };
    const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10).split("-").map(Number);
    return { body: { code: "1000000", success: true, stationDataItems: [{ year: today[0], month: today[1], day: today[2], generationValue: 30.2 }, { year: today[0], month: today[1], day: 1, generationValue: 40 }] } };
  });
  const plants = await ADAPTERS.deye.fetchPlants({ region: "eu1", appId: "202", appSecret: "sec", account: "a@b.com", password: "123" }, fetch);
  assert.equal(calls[0].url, "https://eu1-developer.deyecloud.com/v1.0/account/token?appId=202");
  assert.deepEqual(body(calls[0]), { appSecret: "sec", password: createHash("sha256").update("123").digest("hex"), email: "a@b.com" });
  assert.equal(hdr(calls[1], "Authorization"), "Bearer TK");
  assert.equal(body(calls[2]).granularity, 2);
  assert.equal(plants[0].powerKw, 2.548);
  assert.equal(plants[0].status, "online");
  assert.equal(plants[0].todayKwh, 30.2);
  assert.equal(plants[0].monthKwh, 70.2);
  assert.equal(plants[0].daily?.length, 2);
});

test("Deye: login recusado vira mensagem clara", async () => {
  const { fetch } = fakeFetch(() => ({ body: { code: "2101006", success: false, msg: "password error" } }));
  await assert.rejects(ADAPTERS.deye.fetchPlants({ region: "eu1", appId: "1", appSecret: "2", account: "u", password: "p" }, fetch), /login recusado \(password error\)/);
});

test("Sungrow: login e lista (com e sem RSA Key)", async () => {
  const station = { ps_id: 1173, ps_name: "Casa Ana", total_capcity: { value: "6.6", unit: "kWp" }, curr_power: { value: "4100", unit: "W" }, today_energy: { value: "18.4", unit: "kWh" }, total_energy: { value: "9.8", unit: "MWh" }, ps_fault_status: 3, online_status: 1 };
  const plain = fakeFetch((c) =>
    c.url.endsWith("/openapi/login") ? { body: { result_code: "1", result_data: { token: "T", user_id: "9", login_state: "1" } } } : { body: { result_code: "1", result_data: { pageList: [station] } } },
  );
  const p1 = await ADAPTERS.sungrow.fetchPlants({ server: "intl", appKey: "AK", accessKey: "SK", account: "u", password: "p" }, plain.fetch);
  assert.equal(plain.calls[0].url, "https://gateway.isolarcloud.com.hk/openapi/login");
  assert.equal(hdr(plain.calls[0], "x-access-key"), "SK");
  assert.deepEqual(body(plain.calls[0]), { appkey: "AK", user_account: "u", user_password: "p", lang: "_en_US" });
  assert.equal(body(plain.calls[1]).token, "T");
  assert.deepEqual([p1[0].capacityKwp, p1[0].powerKw, p1[0].todayKwh, p1[0].totalKwh, p1[0].status], [6.6, 4.1, 18.4, 9800, "online"]);

  // Envelope com RSA Key: corpo AES e chave AES cifrada com a chave pública
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const der = publicKey.export({ type: "spki", format: "der" }).toString("base64url");
  const enc = fakeFetch((c) => {
    const aes = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(hdr(c, "x-random-secret-key"), "base64")).toString();
    const req = aesDecrypt(String(c.init.body), aes);
    assert.ok(req.api_key_param.nonce);
    const res = c.url.endsWith("/openapi/login") ? { result_code: "1", result_data: { token: "T2", user_id: "9", login_state: "1" } } : { result_code: "1", result_data: { pageList: [station] } };
    return aesEncrypt(res, aes);
  });
  const p2 = await ADAPTERS.sungrow.fetchPlants({ server: "eu", appKey: "AK", accessKey: "SK", rsaKey: der, account: "u", password: "p" }, enc.fetch);
  assert.equal(p2[0].name, "Casa Ana");
  assert.ok(pem.includes("BEGIN"));
});

test("Growatt: token no cabeçalho e dados do dia", async () => {
  const { fetch, calls } = fakeFetch((c) =>
    c.url.includes("/plant/list")
      ? { body: { error_code: 0, data: { count: 1, plants: [{ plant_id: 1, name: "Loja", peak_power: 15, current_power: 9.2, total_energy: 8800, status: 1, city: "Arapiraca", country: "Brazil" }] } } }
      : { body: { error_code: 0, data: { today_energy: "55.1", monthly_energy: "830", total_energy: "8812", current_power: 9.3, last_update_time: "2026-10-15 14:05:00" } } },
  );
  const plants = await ADAPTERS.growatt.fetchPlants({ server: "global", token: "TOK" }, fetch);
  assert.equal(calls[0].url, "https://openapi.growatt.com/v1/plant/list?page=1&perpage=100");
  assert.equal(hdr(calls[0], "token"), "TOK");
  assert.deepEqual([plants[0].todayKwh, plants[0].monthKwh, plants[0].powerKw, plants[0].status, plants[0].address], [55.1, 830, 9.3, "online", "Arapiraca - Brazil"]);
});

test("Huawei: login com XSRF-TOKEN e indicadores", async () => {
  const { fetch, calls } = fakeFetch((c) => {
    if (c.url.endsWith("/login")) return { body: { success: true, failCode: 0 }, headers: { "xsrf-token": "X1" } };
    if (c.url.endsWith("/stations")) return { body: { success: true, data: { pageCount: 1, list: [{ plantCode: "NE=1", plantName: "Galpão", capacity: 75, plantAddress: "Maceió" }] } } };
    return { body: { success: true, data: [{ stationCode: "NE=1", dataItemMap: { day_power: 310.5, month_power: 5100, total_power: 98000, real_health_state: 3 } }] } };
  });
  const plants = await ADAPTERS.huawei.fetchPlants({ host: "la5", userName: "api", systemCode: "s" }, fetch);
  assert.equal(calls[0].url, "https://la5.fusionsolar.huawei.com/thirdData/login");
  assert.equal(hdr(calls[1], "XSRF-TOKEN"), "X1");
  assert.deepEqual([plants[0].name, plants[0].todayKwh, plants[0].status, plants[0].capacityKwp], ["Galpão", 310.5, "online", 75]);
});

test("Solplanet: assinatura X-Ca e query ordenada", async () => {
  assert.equal(sortedPath("/pro/getPlantOverviewPro", { token: "t", apikey: "a" }), "/pro/getPlantOverviewPro?apikey=a&token=t");
  const { fetch, calls } = fakeFetch((c) =>
    c.url.includes("getPlanListPro")
      ? { body: { success: true, errorCode: "0", data: [{ apikey: "PK1", name: "Clínica", capacity: 12 }] } }
      : { body: { success: true, errorCode: "0", data: { power: 5300, etoday: 33.2, etotal: 15400, status: 1 } } },
  );
  const plants = await ADAPTERS.solplanet.fetchPlants({ appKey: "123456789", appSecret: "sec", token: "TT" }, fetch);
  const path = "/pro/getPlanListPro?token=TT";
  const toSign = `GET\napplication/json\n\napplication/json; charset=UTF-8\n\nX-Ca-Key:123456789\n${path}`;
  assert.equal(hdr(calls[0], "X-Ca-Signature"), createHmac("sha256", "sec").update(toSign).digest("base64"));
  assert.deepEqual([plants[0].name, plants[0].powerKw, plants[0].todayKwh, plants[0].status], ["Clínica", 5.3, 33.2, "online"]);
});

test("resumo da frota e produtividade", async () => {
  const { summarize, yieldOf, yieldBand, loadOf, fmtKwh, fmtKw, lastDays } = await import("./monitoring/view.ts");
  const base = { connection_id: "c", provider: "solis" as const, external_id: "1", name: "A", month_kwh: null, total_kwh: null, last_update_at: null, address: null, lead_id: null, synced_at: "" };
  const rows = [
    { ...base, id: "1", capacity_kwp: 10, power_kw: 6, today_kwh: 45, status: "online" as const },
    { ...base, id: "2", capacity_kwp: 5, power_kw: 0, today_kwh: 3, status: "offline" as const },
    { ...base, id: "3", capacity_kwp: 8, power_kw: 2, today_kwh: 12, status: "alarm" as const },
  ];
  const s = summarize(rows);
  assert.deepEqual([s.total, s.powerKw, s.todayKwh, s.capacityKwp, s.online, s.offline, s.alarm], [3, 8, 60, 23, 1, 1, 1]);
  assert.equal(yieldOf(rows[0]), 4.5);
  assert.equal(yieldBand(4.5), "high");
  assert.equal(yieldBand(1.5), "low");
  assert.equal(loadOf(rows[0]), 0.6);
  assert.equal(fmtKwh(12345), "12,3 MWh");
  assert.equal(fmtKw(0.85), "0,85 kW");
  assert.deepEqual(lastDays(3, new Date("2026-10-15T12:00:00Z")), ["2026-10-13", "2026-10-14", "2026-10-15"]);
});
