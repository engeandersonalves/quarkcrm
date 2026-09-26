/**
 * Motor de simulação no tempo (passo fixo) com balanço de energia no barramento AC.
 *
 * A cada passo:
 *  1. Sol → irradiância no plano → temperatura da célula → potência DC → inversor (curva + clipping).
 *  2. Eventos da rede: corte de injeção (curtailment), desligamento remoto da GD, apagão.
 *  3. Cargas fixas + cargas flexíveis "obrigatórias" (prazo vencendo) formam a demanda.
 *  4. O controlador (EMS) distribui a sobra solar (baterias, cargas flexíveis, rede) e
 *     cobre o déficit (baterias, gerador, rede) segundo a estratégia escolhida.
 *  5. O que não cabe em lugar nenhum é FV cortada (curtailment) — a energia "jogada fora".
 */
import { cityById, dateLabel, monthOf } from "./climate.ts";
import { dayMatches, dayOfWeek, crosses, HOT_WATER_DRAW, hoursUntil, inWindow, shapeAt } from "./loads.ts";
import { createRng } from "./rng.ts";
import { airTemperature, cellTemperature, clearSkyGHI, createWeather, inverterEfficiency, planeOfArray, sunPosition } from "./solar.ts";
import type { DailyRow, Load, Scenario, SimKPIs, SimResult, SimSeries, StorageResult, StorageUnit } from "./types.ts";

/** % do fio B cobrado sobre a energia compensada (Lei 14.300/2022, GD II). */
export function fioBPct(year: number) {
  if (year <= 2022) return 0;
  const table: Record<number, number> = { 2023: 0.15, 2024: 0.3, 2025: 0.45, 2026: 0.6, 2027: 0.75, 2028: 0.9 };
  return table[year] ?? 1;
}

/** Preço da energia importada no instante (tarifa convencional ou branca). */
export function priceAt(s: Scenario, doy: number, hour: number) {
  const t = s.tariff;
  if (!t.branca) return t.price;
  const w = dayOfWeek(doy);
  if (w === 0 || w === 6) return t.price * t.offMult;
  if (inWindow(hour, t.peakStart, t.peakEnd)) return t.price * t.peakMult;
  if (inWindow(hour, t.peakStart - 1, t.peakStart) || inWindow(hour, t.peakEnd, t.peakEnd + 1)) return t.price * t.midMult;
  return t.price * t.offMult;
}

interface StoreState {
  u: StorageUnit;
  e: number; // kWh armazenados (referidos à saída)
  cap: number;
  charged: number;
  discharged: number;
  lost: number;
}

interface FlexState {
  load: Load;
  need: number; // kWh restantes no ciclo atual
  active: boolean;
  energy: number;
  solar: number;
  shortfall: number;
  thermal: number; // boiler: kWh térmicos acima da água fria
  heating: boolean;
  running: boolean; // motores: estava ligado no passo anterior
}

export function simulate(scenario: Scenario): SimResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const s = scenario;
  const warnings: string[] = [];
  const dt = s.sim.stepMin / 60;
  const days = Math.max(1, Math.min(366, Math.round(s.sim.days)));
  const n = Math.round((days * 24) / dt);
  const city = cityById(s.site.cityId);
  const rng = createRng(s.sim.seed);
  const rngLoad = createRng(s.sim.seed * 31 + 7);
  const rngEvent = createRng(s.sim.seed * 131 + 17);
  const weather = createWeather(city, s.site.lat, s.site.lon, s.site.tz, s.sim.cloudiness, rng);

  const nSt = s.storage.length;
  const series: SimSeries = {
    t: new Float64Array(n),
    doy: new Int16Array(n),
    hour: new Float32Array(n),
    ghi: new Float32Array(n),
    poa: new Float32Array(n),
    tAmb: new Float32Array(n),
    tCell: new Float32Array(n),
    pvAvail: new Float32Array(n),
    pvUsed: new Float32Array(n),
    curtailed: new Float32Array(n),
    loadFixed: new Float32Array(n),
    loadFlex: new Float32Array(n),
    unserved: new Float32Array(n),
    gridImport: new Float32Array(n),
    gridExport: new Float32Array(n),
    gen: new Float32Array(n),
    storagePower: s.storage.map(() => new Float32Array(n)),
    soc: s.storage.map(() => new Float32Array(n)),
    waterTemp: new Float32Array(n).fill(Number.NaN),
    price: new Float32Array(n),
    flags: new Uint8Array(n),
  };

  const stores: StoreState[] = [...s.storage]
    .sort((a, b) => a.priority - b.priority)
    .map((u) => ({ u, e: u.capacityKWh * clamp(u.socInitial, u.socMin, u.socMax), cap: u.capacityKWh, charged: 0, discharged: 0, lost: 0 }));
  const storeIndex = stores.map((st) => s.storage.indexOf(st.u));

  const loads = s.loads.filter((l) => l.enabled);
  const fixedLoads = loads.filter((l) => l.kind === "profile" || l.kind === "appliance" || (l.kind === "motor" && !l.solarOnly));
  const flex: FlexState[] = loads
    .filter((l) => !fixedLoads.includes(l))
    .map((load) => ({ load, need: 0, active: false, energy: 0, solar: 0, shortfall: 0, thermal: 0, heating: false, running: false }));
  const fixedEnergy = new Map<string, number>(fixedLoads.map((l) => [l.id, 0]));
  const motorRunning = new Map<string, boolean>();

  // boiler: estado inicial a 70% da capacidade térmica
  for (const f of flex) {
    if (f.load.kind === "waterheater") f.thermal = 0.7 * boilerCap(f.load);
  }

  const pdc0 = s.pv.kWp * Math.pow(1 - s.pv.degradationPctYear / 100, s.pv.ageYears) * (1 - s.pv.lossesPct / 100) * (s.pv.bifacial ? 1 + 0.7 * s.site.albedo * 0.3 : 1);
  const acMax = s.inverter.acKW;
  const baseExport = s.grid.mode === "on-grid" ? Infinity : s.grid.mode === "export-limit" ? Math.max(0, s.grid.exportLimitKW) : 0;
  const gridExists = s.grid.mode !== "off-grid";

  // KPIs acumulados
  let loadNoise = 0;
  let eventAvail = 0;
  let eventCurtailed = 0;
  let lolSteps = 0;
  let surgeViolations = 0;
  let hotShort = 0;
  let evShort = 0;
  let waterM3 = 0;
  let fuelL = 0;
  let importCost = 0;
  let baselineCost = 0;
  let balanceErr = 0;
  let peakImport = 0;
  let peakExport = 0;
  let poaSum = 0;
  let genOn = false;

  let dayState = { kDay: 1, tMean: 25, amp: 8 };
  let activeEvents: { curtail: number; trip: boolean; outage: boolean }[] = [];
  let weekend = false;
  const daily: DailyRow[] = [];
  let row: DailyRow | null = null;

  const steps24 = Math.round(24 / dt);

  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const d = Math.floor(i / steps24);
    const hour = t - d * 24;
    const doy = ((s.sim.startDay - 1 + d) % 365) + 1;

    if (i % steps24 === 0) {
      dayState = weather.newDay(doy);
      const w = dayOfWeek(doy);
      weekend = w === 0 || w === 6;
      activeEvents = s.grid.events.map((ev) => {
        const monthOk = !ev.months?.length || ev.months.includes(monthOf(doy) + 1);
        const on = monthOk && dayMatches(doy, ev.days) && rngEvent.next() < ev.probability;
        return { curtail: on && ev.kind === "curtailment" ? ev.exportFraction : -1, trip: on && ev.kind === "gd-trip", outage: on && ev.kind === "outage" };
      });
      row = { day: d, doy, label: dateLabel(doy), pvAvail: 0, pvUsed: 0, curtailed: 0, load: 0, import: 0, export: 0, unserved: 0, gen: 0, events: 0 };
      daily.push(row);
    }

    // ---------------------------------------------------------------- sol
    const hm = hour + dt / 2;
    const sun = sunPosition(doy, hm, s.site.lat, s.site.lon, s.site.tz);
    const k = weather.kStep(dt);
    const ghi = clearSkyGHI(sun.cosZ) * k;
    const { poa } = planeOfArray(ghi, sun, s.pv.tilt, s.pv.azimuth, s.site.albedo);
    const tAmb = airTemperature(hm, dayState.tMean, dayState.amp);
    const tCell = cellTemperature(tAmb, poa, s.pv.noct);
    const pdc = Math.max(0, pdc0 * (poa / 1000) * (1 + (s.pv.tempCoeff / 100) * (tCell - 25)));
    let pac = pdc * inverterEfficiency(pdc, acMax, s.inverter.etaMax);
    if (pac > 0) pac = Math.max(0, pac - s.inverter.tareW / 1000);
    const pvAvail = Math.min(pac, acMax);
    poaSum += (poa / 1000) * dt;

    // ---------------------------------------------------------------- eventos
    let curtailFrac = 1;
    let curtailOn = false;
    let trip = false;
    let outage = false;
    for (let e = 0; e < s.grid.events.length; e++) {
      const ev = s.grid.events[e];
      const a = activeEvents[e];
      if (!inWindow(hm, ev.start, ev.end)) continue;
      if (a.curtail >= 0) {
        curtailOn = true;
        curtailFrac = Math.min(curtailFrac, a.curtail);
      }
      if (a.trip) trip = true;
      if (a.outage) outage = true;
    }
    // Evento de corte ainda por vir hoje (anunciado pelo operador na véspera)?
    let cutAhead = false;
    for (let e = 0; e < s.grid.events.length; e++) {
      const ev = s.grid.events[e];
      const a = activeEvents[e];
      if ((a.curtail >= 0 || a.trip) && !inWindow(hm, ev.start, ev.end) && hm < ev.start && ev.start < ev.end) cutAhead = true;
    }
    const gridUp = gridExists && !outage;
    const island = !gridUp; // casa funcionando isolada
    let expLim = gridUp && !trip ? baseExport : 0;
    if (curtailOn) expLim = Math.min(expLim, curtailFrac * acMax);
    const impLim = gridUp ? Math.max(0, s.grid.importLimitKW) : 0;
    // Sem inversor híbrido: apagão ou desligamento remoto derrubam a FV (anti-ilhamento, NBR 16149).
    const pvAllowed = (outage || trip) && !s.inverter.backup ? 0 : pvAvail;

    // ---------------------------------------------------------------- tarifa
    const price = priceAt(s, doy, hour);

    // ---------------------------------------------------------------- cargas fixas
    loadNoise = 0.9 * loadNoise + Math.sqrt(1 - 0.81) * rngLoad.normal();
    let fixed = 0;
    let surgeKVA = 0;
    for (const l of fixedLoads) {
      let p = 0;
      if (l.kind === "profile") {
        p = (l.dailyKWh / 24) * shapeAt(l.shape, hm) * (weekend ? l.weekendFactor : 1) * Math.max(0.2, 1 + l.noise * loadNoise);
      } else if (l.kind === "appliance") {
        if (inWindow(hm, l.start, l.end) && dayMatches(doy, l.days)) p = l.powerKW * l.duty;
      } else if (l.kind === "motor") {
        const on = inWindow(hm, l.start, l.end) && dayMatches(doy, l.days);
        if (on) {
          p = (l.shaftKW * l.loadFactor) / Math.max(0.3, l.efficiency);
          if (!motorRunning.get(l.id)) surgeKVA += (p / Math.max(0.3, l.powerFactor)) * l.startMultiplier;
        }
        motorRunning.set(l.id, on);
      }
      fixed += p;
      fixedEnergy.set(l.id, (fixedEnergy.get(l.id) ?? 0) + p * dt);
    }

    // ---------------------------------------------------------------- cargas flexíveis: obrigatórias × opcionais
    const must: number[] = new Array(flex.length).fill(0);
    const opt: number[] = new Array(flex.length).fill(0);
    for (let f = 0; f < flex.length; f++) {
      const st = flex[f];
      const l = st.load;
      if (l.kind === "pump") {
        const energyPerM3 = l.powerKW / Math.max(0.01, l.flowM3h);
        if ((i === 0 && inWindow(hm, l.start, l.end)) || crosses(hour, dt, l.start)) {
          st.need = l.dailyM3 * energyPerM3;
          st.active = true;
        }
        if (st.active && !inWindow(hm, l.start, l.end)) {
          st.shortfall += st.need / energyPerM3;
          st.active = false;
          st.need = 0;
        }
        if (st.active && st.need > 0) splitNeed(st, l.powerKW, hoursUntil(hour, l.end), dt, true, must, opt, f);
      } else if (l.kind === "deferrable") {
        if ((i === 0 && inWindow(hm, l.start, l.end)) || crosses(hour, dt, l.start)) {
          st.need = l.dailyKWh;
          st.active = true;
        }
        if (st.active && !inWindow(hm, l.start, l.end)) {
          st.shortfall += st.need;
          st.active = false;
          st.need = 0;
        }
        if (st.active && st.need > 0) splitNeed(st, l.powerKW, hoursUntil(hour, l.end), dt, l.mustComplete, must, opt, f);
      } else if (l.kind === "ev") {
        if ((i === 0 && inWindow(hm, l.plugIn, l.plugOut)) || crosses(hour, dt, l.plugIn)) {
          if (dayMatches(doy, l.daysHome)) {
            st.need = l.dailyKWh;
            st.active = true;
          }
        }
        if (st.active && crosses(hour, dt, l.plugOut)) {
          st.shortfall += st.need;
          st.active = false;
          st.need = 0;
        }
        if (st.active && st.need > 0) {
          if (l.smart) splitNeed(st, l.chargerKW, hoursUntil(hour, l.plugOut), dt, true, must, opt, f);
          else must[f] = Math.min(l.chargerKW, st.need / dt);
        }
      } else if (l.kind === "waterheater") {
        const cap = boilerCap(l);
        const perDeg = cap / Math.max(1, l.maxC - l.coldC);
        const minE = perDeg * (l.minC - l.coldC);
        // consumo de água quente e perdas do tanque
        const drawL = l.dailyLiters * HOT_WATER_DRAW[Math.floor(hm) % 24] * dt;
        const drawE = (drawL * 4.186 * (40 - l.coldC)) / 3600;
        const loss = (l.lossKWhDay / 24) * dt * (st.thermal / Math.max(cap, 1e-6));
        st.thermal -= drawE + loss;
        if (st.thermal < 0) {
          hotShort += (-st.thermal * 3600) / (4.186 * Math.max(1, 40 - l.coldC));
          st.thermal = 0;
        }
        const room = Math.max(0, cap - st.thermal) / dt;
        const band = perDeg * 4;
        if (l.diverter) {
          if (st.thermal < minE) st.heating = true;
          else if (st.thermal >= minE + band) st.heating = false;
          must[f] = st.heating ? Math.min(l.heaterKW, room) : 0;
          opt[f] = Math.max(0, Math.min(l.heaterKW, room) - must[f]);
        } else {
          if (st.thermal < cap - band) st.heating = true;
          else if (st.thermal >= cap) st.heating = false;
          must[f] = st.heating ? Math.min(l.heaterKW, room) : 0;
        }
        series.waterTemp[i] = l.coldC + st.thermal / Math.max(perDeg, 1e-9);
      } else if (l.kind === "motor") {
        // motor "solar": roda inteiro ou não roda, só com sobra
        if (inWindow(hm, l.start, l.end) && dayMatches(doy, l.days)) opt[f] = (l.shaftKW * l.loadFactor) / Math.max(0.3, l.efficiency);
      }
    }

    const mustSum = must.reduce((a, b) => a + b, 0);
    const demand = fixed + mustSum;

    // ---------------------------------------------------------------- EMS
    const strategy = s.control.strategy;
    const floorFor = (st: StoreState) => {
      if (strategy === "reserva-backup" && !island) return Math.max(st.u.socMin, s.control.backupReserve);
      return st.u.socMin;
    };
    const tbPrice = s.tariff.branca ? price > s.tariff.price * s.tariff.offMult + 1e-9 : inWindow(hm, 17, 22);
    const dischargeAllowed = island || strategy !== "tarifa-branca" || tbPrice;

    const stP = new Float64Array(nSt); // + carga / − descarga (barramento)
    const charge = (avail: number, src: "pv" | "grid" | "gen") => {
      let used = 0;
      for (let j = 0; j < stores.length && avail - used > 1e-9; j++) {
        const st = stores[j];
        if (src === "grid" && st.u.tech === "hydrogen") continue;
        const headroom = (st.u.socMax * st.cap - st.e) / (st.u.etaCharge * dt);
        const p = Math.max(0, Math.min(st.u.chargeKW - Math.max(0, stP[storeIndex[j]]), headroom, avail - used));
        if (p <= 0) continue;
        st.e += p * st.u.etaCharge * dt;
        st.charged += p * dt;
        st.lost += p * (1 - st.u.etaCharge) * dt;
        stP[storeIndex[j]] += p;
        used += p;
      }
      return used;
    };
    const discharge = (need: number) => {
      if (!dischargeAllowed) return 0;
      let got = 0;
      for (let j = 0; j < stores.length && need - got > 1e-9; j++) {
        const st = stores[j];
        const avail = ((st.e - floorFor(st) * st.cap) * st.u.etaDischarge) / dt;
        const p = Math.max(0, Math.min(st.u.dischargeKW, avail, need - got));
        if (p <= 0) continue;
        st.e -= (p / st.u.etaDischarge) * dt;
        st.discharged += p * dt;
        st.lost += (p / st.u.etaDischarge - p) * dt;
        stP[storeIndex[j]] -= p;
        got += p;
      }
      return got;
    };
    const serveOptional = (avail: number) => {
      let used = 0;
      for (let f = 0; f < flex.length; f++) {
        if (opt[f] <= 0) continue;
        const l = flex[f].load;
        const left = avail - used;
        if (left <= 1e-9) break;
        if (l.kind === "motor") {
          if (left + 1e-9 >= opt[f]) {
            used += opt[f];
            flex[f].energy += opt[f] * dt;
            flex[f].solar += opt[f] * dt;
            if (!prevRun[f] && island) surgeKVA += (opt[f] / Math.max(0.3, l.powerFactor)) * l.startMultiplier;
            flex[f].running = true;
          }
          continue;
        }
        const p = Math.min(opt[f], left);
        used += p;
        consumeFlex(flex[f], p, dt);
        flex[f].solar += p * dt;
      }
      return used;
    };
    const prevRun = flex.map((x) => x.running);
    for (const x of flex) x.running = false;

    const pvToLoad = Math.min(pvAllowed, demand);
    let surplus = pvAllowed - pvToLoad;
    let deficit = demand - pvToLoad;
    let exportP = 0;
    let importP = 0;
    let genP = 0;
    let flexOpt = 0;

    // --- sobra solar
    const doExport = () => {
      const e = Math.min(surplus, expLim);
      exportP += e;
      surplus -= e;
    };
    const doStore = () => {
      surplus -= charge(surplus, "pv");
    };
    const doFlex = () => {
      const u = serveOptional(surplus);
      flexOpt += u;
      surplus -= u;
    };
    if (surplus > 0) {
      if (strategy === "cargas-primeiro") [doFlex, doStore, doExport].forEach((fn) => fn());
      else if (strategy === "injetar-primeiro") [doExport, doStore, doFlex].forEach((fn) => fn());
      // anti-corte: antes da janela de corte, injeta e guarda espaço na bateria para a sobra que viria a ser cortada
      else if (strategy === "anti-corte" && cutAhead) [doFlex, doExport, doStore].forEach((fn) => fn());
      else [doStore, doFlex, doExport].forEach((fn) => fn());
    }
    // cortado = o que o inversor não pôde gerar (desligado) + a sobra que não coube em lugar nenhum
    const curtailedP = pvAvail - pvAllowed + surplus;

    // --- déficit
    const socAvg = stores.length ? stores.reduce((a, st) => a + st.e / st.cap, 0) / stores.length : 0;
    if (!(s.generator.enabled && island)) genOn = false;
    else if (!stores.length) genOn = deficit > 0;
    else if (socAvg <= s.generator.startSoc) genOn = true;
    else if (socAvg >= Math.min(0.95, s.generator.startSoc + 0.4)) genOn = false;

    if (deficit > 0) {
      if (strategy === "peak-shaving" && !island) {
        const g = Math.min(deficit, impLim, Math.max(0, s.control.peakLimitKW));
        importP += g;
        deficit -= g;
      }
      if (genOn) {
        const g = Math.min(deficit, s.generator.kW);
        genP += g;
        deficit -= g;
      }
      deficit -= discharge(deficit);
      if (!genOn && island && s.generator.enabled && deficit > 1e-9) {
        genOn = true;
        const g = Math.min(deficit, s.generator.kW);
        genP += g;
        deficit -= g;
      }
      const g = Math.min(deficit, impLim - importP);
      importP += Math.max(0, g);
      deficit -= Math.max(0, g);
    }
    // gerador com folga carrega as baterias
    if (genOn && genP < s.generator.kW) genP += charge(s.generator.kW - genP, "gen");
    // arbitragem: carga pela rede no horário barato
    if (s.grid.gridCharge && gridUp && inWindow(hm, s.grid.gridChargeStart, s.grid.gridChargeEnd)) {
      importP += charge(Math.max(0, impLim - importP), "grid");
    }

    // carga não atendida: primeiro corta flexíveis obrigatórias, depois as fixas
    let unserved = Math.max(0, deficit);
    let mustServed = mustSum;
    if (unserved > 1e-9) {
      const cut = Math.min(unserved, mustSum);
      mustServed -= cut;
      lolSteps++;
    }
    const scale = mustSum > 0 ? mustServed / mustSum : 0;
    for (let f = 0; f < flex.length; f++) if (must[f] > 0) consumeFlex(flex[f], must[f] * scale, dt);

    // ilha: surto de partida de motores × capacidade de surto do inversor
    if (island && surgeKVA > 0 && fixed + surgeKVA > Math.max(s.inverter.surgeKW, s.generator.enabled && genOn ? s.generator.kW * 1.5 : 0)) surgeViolations++;

    // autodescarga
    for (const st of stores) {
      const sd = st.e * (st.u.selfDischargePctDay / 100) * (dt / 24);
      st.e -= sd;
      st.lost += sd;
    }

    // ---------------------------------------------------------------- registro
    const flexServed = mustServed + flexOpt;
    series.t[i] = t;
    series.doy[i] = doy;
    series.hour[i] = hour;
    series.ghi[i] = ghi;
    series.poa[i] = poa;
    series.tAmb[i] = tAmb;
    series.tCell[i] = tCell;
    series.pvAvail[i] = pvAvail;
    series.pvUsed[i] = pvAvail - curtailedP;
    series.curtailed[i] = curtailedP;
    series.loadFixed[i] = fixed;
    series.loadFlex[i] = flexServed;
    series.unserved[i] = unserved;
    series.gridImport[i] = importP;
    series.gridExport[i] = exportP;
    series.gen[i] = genP;
    series.price[i] = price;
    series.flags[i] = (curtailOn ? 1 : 0) | (trip ? 2 : 0) | (outage ? 4 : 0) | (genP > 0 ? 8 : 0);
    for (let j = 0; j < stores.length; j++) {
      const idx = storeIndex[j];
      series.storagePower[idx][i] = stP[idx];
      series.soc[idx][i] = stores[j].e / stores[j].cap;
    }

    // balanço: fontes = usos
    const stNet = stP.reduce((a, b) => a + b, 0);
    const sources = pvAvail - curtailedP + importP + genP;
    const uses = fixed - Math.max(0, unserved - mustSum) + flexServed + exportP + stNet;
    balanceErr += Math.abs(sources - uses) * dt;

    if (curtailOn || trip) {
      eventAvail += Math.max(0, pvAvail - fixed - expLim) * dt;
      eventCurtailed += curtailedP * dt;
    }
    peakImport = Math.max(peakImport, importP);
    peakExport = Math.max(peakExport, exportP);
    importCost += importP * price * dt;
    baselineCost += (fixed + flexServed) * price * dt;
    fuelL += genP * dt * s.generator.litersPerKWh;

    if (row) {
      row.pvAvail += pvAvail * dt;
      row.pvUsed += (pvAvail - curtailedP) * dt;
      row.curtailed += curtailedP * dt;
      row.load += (fixed + flexServed - Math.max(0, unserved - mustSum)) * dt;
      row.import += importP * dt;
      row.export += exportP * dt;
      row.unserved += unserved * dt;
      row.gen += genP * dt;
      if (series.flags[i] & 7) row.events += dt;
    }
  }

  for (const f of flex) {
    if (f.load.kind === "pump") waterM3 += f.energy / (f.load.powerKW / Math.max(0.01, f.load.flowM3h));
    if (f.load.kind === "ev") evShort += f.shortfall;
  }

  // ---------------------------------------------------------------- KPIs
  const sum = (a: Float32Array) => {
    let x = 0;
    for (let i = 0; i < a.length; i++) x += a[i];
    return x * dt;
  };
  const hours = n * dt;
  const years = hours / 8760;
  const pvAvailKWh = sum(series.pvAvail);
  const pvUsedKWh = sum(series.pvUsed);
  const curtailedKWh = sum(series.curtailed);
  const importKWh = sum(series.gridImport);
  const exportKWh = sum(series.gridExport);
  const genKWh = sum(series.gen);
  const unservedKWh = sum(series.unserved);
  const loadKWh = sum(series.loadFixed) + sum(series.loadFlex);
  const loadServedKWh = daily.reduce((a, r) => a + r.load, 0);

  const storageResults: StorageResult[] = s.storage.map((u) => {
    const st = stores.find((x) => x.u === u)!;
    const cycles = st.discharged / Math.max(u.capacityKWh * (u.socMax - u.socMin), 1e-9);
    const cyclesYear = years > 0 ? cycles / years : 0;
    const lifeCycle = cyclesYear > 0 ? u.cycleLife / cyclesYear : Infinity;
    const lifeCal = u.calendarFadePctYear > 0 ? 20 / u.calendarFadePctYear : Infinity;
    const lifeYears = Math.min(30, lifeCycle, lifeCal);
    const fadePct = (cycles / Math.max(1, u.cycleLife)) * 20 + u.calendarFadePctYear * years;
    const perYear = years > 0 ? st.discharged / years : 0;
    const lcos = perYear > 0 ? u.capex / (perYear * lifeYears) : 0;
    return {
      id: u.id,
      name: u.name,
      tech: u.tech,
      chargedKWh: st.charged,
      dischargedKWh: st.discharged,
      lossesKWh: st.lost,
      cycles,
      roundTrip: st.charged > 0 ? st.discharged / st.charged : 0,
      fadePct,
      lifeYears,
      lcos,
    };
  });

  const pct = fioBPct(s.tariff.year);
  const avgImportPrice = importKWh > 0 ? importCost / importKWh : s.tariff.price;
  const compensated = Math.min(exportKWh, importKWh);
  const creditValue = compensated * (avgImportPrice - s.tariff.fioB * pct);
  const fuelCost = fuelL * s.generator.fuelPrice;
  const costWith = importCost - creditValue + fuelCost;
  const savings = baselineCost - costWith;
  const selfUsed = pvUsedKWh - exportKWh;

  const loadEnergy: SimKPIs["loadEnergy"] = [
    ...fixedLoads.map((l) => ({ id: l.id, name: l.name, kind: l.kind, kWh: fixedEnergy.get(l.id) ?? 0, solarKWh: 0 })),
    ...flex.map((f) => ({ id: f.load.id, name: f.load.name, kind: f.load.kind, kWh: f.energy, solarKWh: f.solar })),
  ];

  const kpis: SimKPIs = {
    hours,
    pvAvailKWh,
    pvUsedKWh,
    curtailedKWh,
    curtailedPct: pvAvailKWh > 0 ? curtailedKWh / pvAvailKWh : 0,
    eventCurtailAvailKWh: eventAvail,
    eventRecoveredKWh: Math.max(0, eventAvail - eventCurtailed),
    loadKWh,
    loadServedKWh,
    unservedKWh,
    lossOfLoadHours: lolSteps * dt,
    importKWh,
    exportKWh,
    genKWh,
    fuelL,
    selfConsumption: pvUsedKWh > 0 ? selfUsed / pvUsedKWh : 0,
    selfSufficiency: loadServedKWh > 0 ? clamp(1 - importKWh / Math.max(loadServedKWh, 1e-9) - genKWh / Math.max(loadServedKWh, 1e-9), 0, 1) : 0,
    peakImportKW: peakImport,
    peakExportKW: peakExport,
    specificYield: s.pv.kWp > 0 ? pvAvailKWh / s.pv.kWp : 0,
    performanceRatio: s.pv.kWp > 0 && poaSum > 0 ? pvAvailKWh / (s.pv.kWp * poaSum) : 0,
    storage: storageResults,
    waterM3,
    loadEnergy,
    motorSurgeViolations: surgeViolations,
    hotWaterShortfallL: hotShort,
    evShortfallKWh: evShort,
    costBaseline: baselineCost,
    costWith,
    savings,
    savingsYear: years > 0 ? savings / years : 0,
    creditsLeftKWh: exportKWh - compensated,
    co2AvoidedKg: pvUsedKWh * s.tariff.co2 - fuelL * 2.68,
    energyBalanceError: balanceErr,
  };

  // ---------------------------------------------------------------- avisos
  const ratio = s.inverter.acKW > 0 ? s.pv.kWp / s.inverter.acKW : 0;
  if (ratio > 1.5) warnings.push(`Relação DC/AC de ${ratio.toFixed(2)}: o inversor vai ceifar (clipping) boa parte do pico.`);
  if (kpis.curtailedPct > 0.1) warnings.push(`${(kpis.curtailedPct * 100).toFixed(0)}% da energia solar disponível foi desperdiçada (curtailment). Considere armazenamento ou cargas flexíveis.`);
  if (unservedKWh > 0.01) warnings.push(`${unservedKWh.toFixed(1)} kWh de consumo não atendidos (${kpis.lossOfLoadHours.toFixed(1)} h com falta de energia).`);
  if (surgeViolations > 0) warnings.push(`${surgeViolations} partidas de motor excederam a potência de surto do inversor em modo ilha — use soft-starter/inversor de frequência ou inversor maior.`);
  if (hotShort > 1) warnings.push(`Faltaram ~${hotShort.toFixed(0)} L de água quente — aumente o tanque ou a resistência.`);
  if (evShort > 0.1) warnings.push(`O carro saiu com ${evShort.toFixed(1)} kWh a menos que o necessário.`);
  const shortPump = flex.filter((f) => f.load.kind === "pump").reduce((a, f) => a + f.shortfall, 0);
  if (shortPump > 0.1) warnings.push(`Faltou bombear ${shortPump.toFixed(1)} m³ de água.`);
  if ((s.grid.mode === "zero-grid" || s.grid.mode === "off-grid") && !s.storage.length && !flex.length) warnings.push("Sistema sem armazenamento nem cargas flexíveis: toda sobra solar é cortada.");
  if (s.storage.some((u) => u.tech === "lead" && u.socMin < 0.4)) warnings.push("Chumbo-ácido com descarga abaixo de 60% reduz muito a vida útil.");
  if (s.grid.events.some((e) => e.kind === "outage") && !s.inverter.backup) warnings.push("Inversor sem backup (EPS): durante apagões a geração solar para por segurança (anti-ilhamento).");

  const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { scenario: s, series, kpis, daily, warnings, ms };
}

function splitNeed(st: FlexState, powerKW: number, hoursLeft: number, dt: number, mustComplete: boolean, must: number[], opt: number[], f: number) {
  const maxNow = Math.min(powerKW, st.need / dt);
  const canLater = powerKW * Math.max(0, hoursLeft - dt);
  const m = mustComplete ? Math.min(maxNow, Math.max(0, st.need - canLater) / dt) : 0;
  must[f] = m;
  opt[f] = Math.max(0, maxNow - m);
}

function consumeFlex(st: FlexState, p: number, dt: number) {
  if (p <= 0) return;
  if (st.load.kind === "waterheater") st.thermal += p * dt * 0.98;
  else st.need = Math.max(0, st.need - p * dt);
  st.energy += p * dt;
}

function boilerCap(l: Extract<Load, { kind: "waterheater" }>) {
  return (l.tankLiters * 4.186 * Math.max(1, l.maxC - l.coldC)) / 3600;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
