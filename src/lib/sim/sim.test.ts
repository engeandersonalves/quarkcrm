import assert from "node:assert/strict";
import { test } from "node:test";
import { cityById, midMonth } from "./climate.ts";
import { fioBPct, simulate } from "./engine.ts";
import { baseScenario, curtailEvent, PRESETS } from "./presets.ts";
import { clearSkyDaily, createWeather, planeOfArray, sunPosition, clearSkyGHI } from "./solar.ts";
import { createRng } from "./rng.ts";
import { gravityKWh, makeStorage, pumpedKWh } from "./storage.ts";
import { SWEEP_PARAMS, sweep } from "./study.ts";

test("sol a pino ao meio-dia solar no equinócio sobre o equador", () => {
  // 20/mar (doy 79), longitude 0, fuso 0; corrige pela equação do tempo (~ −7,5 min)
  const p = sunPosition(79, 12.12, 0, 0, 0);
  assert.ok(p.elevation > 88, `elevação ${p.elevation}`);
});

test("painel voltado ao norte no hemisfério sul capta mais que voltado ao sul", () => {
  const sun = sunPosition(172, 12, -23.5, -46.6, -3);
  const ghi = clearSkyGHI(sun.cosZ);
  const north = planeOfArray(ghi, sun, 30, 0, 0.2).poa;
  const south = planeOfArray(ghi, sun, 30, 180, 0.2).poa;
  assert.ok(north > ghi && south < ghi && north > south * 1.5);
});

test("clima estocástico reproduz a média mensal do local", () => {
  const city = cityById("saopaulo");
  const w = createWeather(city, city.lat, city.lon, -3, 1, createRng(1));
  const m = 6; // julho
  const clear = clearSkyDaily(midMonth(m), city.lat, city.lon, -3);
  let k = 0;
  const N = 3000;
  for (let d = 0; d < N; d++) k += w.newDay(midMonth(m)).kDay;
  const got = (k / N) * clear;
  assert.ok(Math.abs(got - city.ghi[m]) / city.ghi[m] < 0.06, `GHI médio ${got.toFixed(2)} × ${city.ghi[m]}`);
});

test("produtividade anual realista em Natal (1.400–1.800 kWh/kWp)", () => {
  const r = simulate(baseScenario({ sim: { startDay: 1, days: 365, stepMin: 60, seed: 1, cloudiness: 1 } }));
  assert.ok(r.kpis.specificYield > 1400 && r.kpis.specificYield < 1800, `yield ${r.kpis.specificYield}`);
  assert.ok(r.kpis.performanceRatio > 0.7 && r.kpis.performanceRatio < 0.9, `PR ${r.kpis.performanceRatio}`);
});

test("balanço de energia fecha em todos os cenários prontos", () => {
  for (const p of PRESETS) {
    const r = simulate(p.build());
    const rel = r.kpis.energyBalanceError / Math.max(1, r.kpis.loadKWh + r.kpis.pvAvailKWh);
    assert.ok(rel < 1e-6, `${p.id}: erro ${r.kpis.energyBalanceError}`);
    for (const s of r.series.soc) for (const v of s) assert.ok(v >= -1e-6 && v <= 1 + 1e-6, `${p.id}: SOC ${v}`);
  }
});

test("zero grid não injeta nada e desperdiça sol; on-grid não desperdiça", () => {
  const on = simulate(baseScenario());
  const zero = simulate(baseScenario({ grid: { ...baseScenario().grid, mode: "zero-grid" } }));
  assert.equal(zero.kpis.exportKWh, 0);
  assert.ok(zero.kpis.curtailedKWh > 5);
  assert.ok(on.kpis.curtailedKWh < 0.5);
});

test("bateria recupera energia durante o corte de GD", () => {
  const base = baseScenario({ grid: { ...baseScenario().grid, events: [curtailEvent({ days: "todos" })] } });
  const without = simulate(base);
  const naive = simulate({ ...base, storage: [makeStorage("lfp", 10, { socInitial: 0.1 })] });
  const smart = simulate({ ...base, storage: [makeStorage("lfp", 10, { socInitial: 0.1 })], control: { ...base.control, strategy: "anti-corte" } });
  assert.ok(without.kpis.eventCurtailAvailKWh > 5);
  // a bateria enche de manhã no autoconsumo e chega cheia ao corte; o controle anti-corte guarda espaço
  assert.ok(naive.kpis.curtailedKWh < without.kpis.curtailedKWh);
  assert.ok(smart.kpis.curtailedKWh < naive.kpis.curtailedKWh * 0.7, `${smart.kpis.curtailedKWh} × ${naive.kpis.curtailedKWh}`);
  assert.ok(smart.kpis.eventRecoveredKWh > naive.kpis.eventRecoveredKWh);
});

test("apagão sem inversor híbrido derruba a FV; com híbrido e bateria a casa segue ligada", () => {
  const preset = PRESETS.find((p) => p.id === "apagao")!.build();
  preset.grid.events[0].probability = 1;
  const hybrid = simulate(preset);
  const plain = simulate({ ...preset, inverter: { ...preset.inverter, backup: false }, storage: [] });
  assert.ok(plain.kpis.unservedKWh > hybrid.kpis.unservedKWh * 3);
});

test("boiler com desviador usa sobra solar", () => {
  const p = PRESETS.find((x) => x.id === "zero-grid-flex")!.build();
  const r = simulate(p);
  const boiler = r.kpis.loadEnergy.find((l) => l.kind === "waterheater")!;
  assert.ok(boiler.solarKWh > 0.5 * boiler.kWh, `solar ${boiler.solarKWh} de ${boiler.kWh}`);
  assert.ok(r.kpis.hotWaterShortfallL < 5);
});

test("off-grid: bomba entrega a água do dia", () => {
  const r = simulate(PRESETS.find((x) => x.id === "offgrid")!.build());
  assert.ok(r.kpis.waterM3 >= 12 * 7 * 0.95, `água ${r.kpis.waterM3}`);
  assert.equal(r.kpis.importKWh, 0);
});

test("física do armazenamento gravitacional e hídrico", () => {
  assert.ok(Math.abs(gravityKWh(1000, 100) - 272.5) < 0.1);
  assert.ok(Math.abs(pumpedKWh(1000, 100) - 272.5) < 0.1);
});

test("escalonamento do fio B (Lei 14.300)", () => {
  assert.equal(fioBPct(2022), 0);
  assert.equal(fioBPct(2026), 0.6);
  assert.equal(fioBPct(2030), 1);
});

test("varredura: mais bateria ⇒ menos desperdício no zero grid", () => {
  const s = baseScenario({ grid: { ...baseScenario().grid, mode: "zero-grid" } });
  const p = SWEEP_PARAMS.find((x) => x.id === "storage")!;
  const r = sweep(s, p, [0, 5, 15]);
  assert.ok(r[0].kpis.curtailedKWh > r[1].kpis.curtailedKWh && r[1].kpis.curtailedKWh > r[2].kpis.curtailedKWh);
});
