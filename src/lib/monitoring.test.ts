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
  assert.equal(PROVIDERS.length, 12);
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

test("planilha de geração: colunas, datas e unidades", async () => {
  const { parseGenerationRows, parseDateLoose, parseNumberLoose } = await import("./monitoring/sheet.ts");
  assert.equal(parseDateLoose("05/10/2026"), "2026-10-05");
  assert.equal(parseDateLoose("2026-10-05 00:00:00"), "2026-10-05");
  assert.equal(parseDateLoose(46300), "2026-10-05");
  assert.equal(parseNumberLoose("1.234,5"), 1234.5);
  assert.equal(parseNumberLoose("1,234.5"), 1234.5);
  assert.equal(parseNumberLoose("12,3"), 12.3);
  const r = parseGenerationRows([
    ["Relatório de geração — Usina Clínica"],
    ["Data", "Receita (R$)", "Geração (kWh)"],
    ["01/10/2026", "40,10", "42,2"],
    ["02/10/2026", "35,00", "36,8"],
    ["Total", "", "79"],
  ]);
  assert.deepEqual(r.rows, [{ day: "2026-10-01", kwh: 42.2 }, { day: "2026-10-02", kwh: 36.8 }]);
  assert.equal(r.valueHeader, "Geração (kWh)");
  assert.equal(r.skipped, 1);
  const wh = parseGenerationRows([["Time", "PV Yield(Wh)"], ["2026-10-01", "42100"]]);
  assert.deepEqual(wh.rows, [{ day: "2026-10-01", kwh: 42.1 }]);
  const noHeader = parseGenerationRows([["2026-10-01", 10], ["2026-10-02", 11], ["2026-10-03", 12]]);
  assert.equal(noHeader.rows.length, 3);
});

test("leituras elétricas: padrões de cada fabricante", async () => {
  const { parseElectrical, flatten } = await import("./monitoring/electrical.ts");
  // Solis
  const solis = parseElectrical({ uPv1: 412.3, iPv1: 9.8, uPv2: 398, iPv2: 9.6, uPv3: 0, iPv3: 0, uAc1: 221.4, iAc1: 14.2, uAc2: 0, fac: 60.01, inverterTemperature: 41.5 });
  assert.deepEqual(solis.dc.map((d) => [d.label, d.voltage, d.current]), [["PV1", 412.3, 9.8], ["PV2", 398, 9.6]]);
  assert.equal(Math.round(solis.dc[0].powerKw! * 1000), 4041);
  assert.deepEqual(solis.ac, [{ label: "Fase R", voltage: 221.4, current: 14.2 }]);
  assert.deepEqual([solis.frequencyHz, solis.temperatureC], [60.01, 41.5]);
  // Huawei
  const hw = parseElectrical({ pv1_u: 600, pv1_i: 8, a_u: 220, b_u: 221, c_u: 219, a_i: 30, b_i: 31, c_i: 29, elec_freq: 59.98, temperature: 45 });
  assert.equal(hw.ac.length, 3);
  assert.deepEqual(hw.ac[1], { label: "Fase S", voltage: 221, current: 31 });
  // Solarman/Deye (lista com nomes)
  const sm = parseElectrical(flatten([{ key: "DV1", value: "380", unit: "V", name: "DC Voltage PV1" }, { key: "DC1", value: "7.5", unit: "A", name: "DC Current PV1" }, { key: "AV1", value: "220.5", unit: "V", name: "AC Voltage R/U/A" }, { key: "AC_T", value: "38", unit: "℃", name: "AC Radiator Temp" }, { key: "A_Fo1", value: "60", unit: "Hz", name: "AC Output Frequency R" }]));
  assert.deepEqual([sm.dc[0].voltage, sm.dc[0].current, sm.ac[0].voltage, sm.temperatureC, sm.frequencyHz], [380, 7.5, 220.5, 38, 60]);
  // GoodWe
  const gw = parseElectrical({ vpv1: 350, ipv1: 6.1, vac1: 220, iac1: 9, fac1: 60, tempperature: 39 });
  assert.deepEqual([gw.dc[0].voltage, gw.ac[0].current, gw.temperatureC], [350, 9, 39]);
});

test("Solis: geração do mês e inversores com tensão e corrente", async () => {
  const { fetch, calls } = fakeFetch((c) => {
    if (c.url.endsWith("/stationMonth")) return { body: { code: "0", data: [{ dateStr: "2026-10-01", energy: 41.2, energyStr: "kWh" }, { dateStr: "2026-10-02", energy: 0.0388, energyStr: "MWh" }] } };
    if (c.url.endsWith("/inverterList")) return { body: { code: "0", data: { page: { records: [{ id: "9", sn: "1031", state: 1, pac: 3.2, pacStr: "kW", etoday: 12, etodayStr: "kWh" }] } } } };
    return { body: { code: "0", data: { model: "S6-GR1P5K", dcInputType: 1, uPv1: 300, iPv1: 5, uPv2: 290, iPv2: 5, uPv3: 10, iPv3: 1, uAc1: 220, iAc1: 14, fac: 60, inverterTemperature: 40, pac: 3200, pacStr: "W", eToday: 12, eTodayStr: "kWh", state: 1 } } };
  });
  const days = await ADAPTERS.solis.fetchDays!({ keyId: "k", keySecret: "s" }, "130", "2026-10", fetch);
  assert.deepEqual(days, [{ day: "2026-10-01", kwh: 41.2 }, { day: "2026-10-02", kwh: 38.8 }]);
  assert.deepEqual(body(calls[0]), { id: "130", money: "BRL", month: "2026-10", timeZone: -3 });
  const devs = await ADAPTERS.solis.fetchDevices!({ keyId: "k", keySecret: "s" }, "130", fetch);
  assert.equal(devs[0].model, "S6-GR1P5K");
  assert.equal(devs[0].dc.length, 2); // dcInputType 1 → 2 entradas
  assert.deepEqual([devs[0].powerKw, devs[0].ac[0].voltage, devs[0].frequencyHz, devs[0].temperatureC], [3.2, 220, 60, 40]);
});

test("Huawei: inversores com leituras por fase", async () => {
  const { fetch } = fakeFetch((c) => {
    if (c.url.endsWith("/login")) return { body: { success: true }, headers: { "xsrf-token": "X" } };
    if (c.url.endsWith("/getDevList")) return { body: { success: true, data: [{ id: 101, devName: "INV-1", devTypeId: 1, esnCode: "ES1" }, { id: 102, devTypeId: 62 }] } };
    return { body: { success: true, data: [{ devId: 101, dataItemMap: { active_power: 18.5, day_cap: 77, total_cap: 9000, run_state: 1, a_u: 220, a_i: 28, pv1_u: 610, pv1_i: 10, elec_freq: 60, temperature: 44 } }] } };
  });
  const devs = await ADAPTERS.huawei.fetchDevices!({ host: "la5", userName: "u", systemCode: "s" }, "NE=1", fetch);
  assert.equal(devs.length, 1);
  assert.deepEqual([devs[0].name, devs[0].powerKw, devs[0].status, devs[0].dc[0].voltage, devs[0].ac[0].current], ["INV-1", 18.5, "online", 610, 28]);
});

test("FoxESS: assinatura com \\r\\n literais e geração somada por usina", async () => {
  const { foxHeaders } = await import("./monitoring/providers/foxess.ts");
  const h = foxHeaders("/op/v0/plant/list", "KEY", 1700000000000);
  assert.equal(h.Signature, createHash("md5").update("/op/v0/plant/list\\r\\nKEY\\r\\n1700000000000").digest("hex"));
  const { fetch } = fakeFetch((c) => {
    if (c.url.includes("/plant/list")) return { body: { errno: 0, result: { total: 1, data: [{ stationID: "S1", name: "Casa" }] } } };
    if (c.url.includes("/plant/detail")) return { body: { errno: 0, result: { capacity: 8.2, address: "Rua A", city: "Maceió" } } };
    if (c.url.includes("/device/list")) return { body: { errno: 0, result: { total: 2, data: [{ deviceSN: "A", stationID: "S1", status: 1 }, { deviceSN: "B", stationID: "S1", status: 1 }] } } };
    if (c.url.includes("/device/generation")) return { body: { errno: 0, result: { today: 10, month: 200, cumulative: 5000 } } };
    return { body: { errno: 0, result: [{ deviceSN: "A", datas: [{ variable: "generationPower", value: 2.5 }] }, { deviceSN: "B", datas: [{ variable: "generationPower", value: 1.5 }] }] } };
  });
  const plants = await ADAPTERS.foxess.fetchPlants({ apiKey: "KEY" }, fetch);
  assert.deepEqual([plants[0].todayKwh, plants[0].monthKwh, plants[0].totalKwh, plants[0].powerKw, plants[0].capacityKwp], [20, 400, 10000, 4, 8.2]);
});

test("APsystems: assinatura e resumo por sistema", async () => {
  const { apsHeaders } = await import("./monitoring/providers/apsystems.ts");
  const h = apsHeaders("APP", "SEC", "/user/api/v2/systems/details/ABC", "GET", 1700000000000, "n0nce");
  assert.equal(h["X-CA-Signature"], createHmac("sha256", "SEC").update("1700000000000/n0nce/APP/ABC/GET/HmacSHA256").digest("base64"));
  const { fetch } = fakeFetch((c) =>
    c.url.includes("/details/") ? { body: { code: 0, data: { sid: "ABC", capacity: "4.4", light: 1 } } } : { body: { code: 0, data: { today: "18.2", month: "301", year: "2400", lifetime: "9100" } } },
  );
  const plants = await ADAPTERS.apsystems.fetchPlants({ appId: "APP", appSecret: "SEC", sids: "ABC" }, fetch);
  assert.deepEqual([plants[0].capacityKwp, plants[0].todayKwh, plants[0].totalKwh, plants[0].status], [4.4, 18.2, 9100, "online"]);
});

test("GoodWe e Livoltek: login e usinas", async () => {
  const gw = fakeFetch((c) => {
    if (c.url.includes("CrossLogin")) return { body: { code: 0, data: { uid: "u", timestamp: 1, token: "T" }, api: "https://eu.semsportal.com/api/" } };
    if (c.url.includes("QueryPowerStationByHistory")) return { body: { code: 0, data: { list: [{ id: "PS1", pw_name: "Galpão" }] } } };
    return { body: { code: 0, data: { info: { stationname: "Galpão Norte", capacity: 30, status: 1 }, kpi: { pac: 12500, power: 88.1, month_generation: 1500, total_power: 40000 }, inverter: [{ sn: "GW1", out_pac: 12500, invert_full: { vpv1: 500, ipv1: 12, vac1: 220, iac1: 19 } }] } } };
  });
  const plants = await ADAPTERS.goodwe.fetchPlants({ account: "a@b.com", password: "p" }, gw.fetch);
  assert.equal(gw.calls[1].url, "https://eu.semsportal.com/api/v2/HistoryData/QueryPowerStationByHistory");
  assert.ok(String(hdr(gw.calls[1], "Token")).includes('"token":"T"'));
  assert.deepEqual([plants[0].name, plants[0].powerKw, plants[0].todayKwh, plants[0].status], ["Galpão Norte", 12.5, 88.1, "online"]);
  const lv = fakeFetch((c) =>
    c.url.endsWith("/hess/api/login")
      ? { body: { code: "operate.success", data: "TOK" } }
      : c.url.includes("userSites")
        ? { body: { code: "operate.success", data: { count: 1, list: [{ powerStationId: 7, powerStationName: "Sítio", pvCapacity: 12, powerStationStatus: 1 }] } } }
        : { body: { code: "operate.success", data: { currentPower: 6.1, eoutDaily: 40, eoutMonth: 700 } } },
  );
  const lp = await ADAPTERS.livoltek.fetchPlants({ secuid: "S", key: "K" }, lv.fetch);
  assert.ok(lv.calls[1].url.includes("userToken=TOK"));
  assert.deepEqual([lp[0].name, lp[0].powerKw, lp[0].todayKwh, lp[0].status], ["Sítio", 6.1, 40, "online"]);
});

test("relatório: totais, expectativa, economia e CO₂", async () => {
  const { reportStats, shiftMonth, monthLabel, daysInMonth } = await import("./monitoring/report.ts");
  const days = [{ day: "2026-09-01", kwh: 30 }, { day: "2026-09-02", kwh: 40 }, { day: "2026-09-03", kwh: 0 }];
  const s = reportStats({ month: "2026-09", days, capacityKwp: 10, tariff: 1, sunHours: 5, performanceRatio: 0.8 });
  assert.deepEqual([s.total, s.avg, s.best?.day, s.worst?.kwh, s.daysInMonth, s.expected, s.specific, s.savings], [70, 35, "2026-09-02", 30, 30, 1200, 7, 70]);
  assert.equal(Math.round(s.co2Kg * 100) / 100, 2.7);
  const cur = reportStats({ month: "2026-10", days: [], capacityKwp: 10, tariff: 1, sunHours: 5, performanceRatio: 0.8, today: "2026-10-16" });
  assert.equal(cur.expected, 640);
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(monthLabel("2026-10"), "outubro de 2026");
  assert.equal(daysInMonth("2028-02"), 29);
});
