import assert from "node:assert/strict";
import { test } from "node:test";
import { sunPosition, localToUtc, guessTimezone, sunriseSunset } from "./sun.ts";
import { poaIrradiation, optimalOrientation, monthlyGhi } from "./irradiance.ts";
import { roofPlanes, layoutPanels, minRowPitch } from "./geometry.ts";
import { defaultProject, analyze, newArray, newBuilding } from "./project.ts";
import { sizeCircuit, designStrings, wallRoute, conduitFor, peSection, inverterPreset } from "./electrical.ts";
import { electricalReport } from "./board.ts";
import { structureBom } from "./structures.ts";

test("sol ao meio-dia em São Paulo no inverno fica ao norte, baixo", () => {
  const tz = guessTimezone(-23.55, -46.63);
  assert.equal(tz, -3);
  const s = sunPosition(localToUtc(2026, 6, 21, 12, tz), -23.55, -46.63);
  assert.ok(s.elevation > 40 && s.elevation < 45, `elev ${s.elevation}`);
  assert.ok(s.azimuth < 15 || s.azimuth > 345, `az ${s.azimuth}`);
  const m = sunPosition(localToUtc(2026, 3, 20, 8, tz), -23.55, -46.63);
  assert.ok(m.azimuth > 60 && m.azimuth < 120, "de manhã o sol está a leste");
  const d = sunriseSunset(-23.55, -46.63, tz, 2026, 12, 21)!;
  assert.ok(d.sunset - d.sunrise > 13 && d.sunset - d.sunrise < 14);
});

test("fusos do Brasil", () => {
  assert.equal(guessTimezone(-3.12, -60.02), -4); // Manaus
  assert.equal(guessTimezone(-9.97, -67.81), -5); // Rio Branco
  assert.equal(guessTimezone(-8.05, -34.88), -3); // Recife
  assert.equal(guessTimezone(-29.75, -57.08), -3); // Uruguaiana
  assert.equal(guessTimezone(-20.47, -54.62), -4); // Campo Grande
});

test("irradiação: norte inclinado ganha do horizontal; sul perde; média horizontal = HSP", () => {
  const lat = -23.55;
  const h = poaIrradiation({ lat, hsp: 4.6, tilt: 0, azimuth: 0 });
  assert.ok(Math.abs(h.annual - 4.6) < 0.02, `horizontal ${h.annual}`);
  const n = poaIrradiation({ lat, hsp: 4.6, tilt: 23, azimuth: 0 });
  const s = poaIrradiation({ lat, hsp: 4.6, tilt: 23, azimuth: 180 });
  const l = poaIrradiation({ lat, hsp: 4.6, tilt: 23, azimuth: 90 });
  assert.ok(n.annual > h.annual * 1.03, `norte ${n.annual}`);
  assert.ok(s.annual < h.annual * 0.92, `sul ${s.annual}`);
  assert.ok(l.annual < n.annual && l.annual > s.annual);
  const opt = optimalOrientation(lat, 4.6);
  assert.ok(opt.tilt >= 15 && opt.tilt <= 28, `ótimo ${opt.tilt}`);
  // inverno é mais fraco que verão no horizontal
  const g = monthlyGhi(lat, 4.6);
  assert.ok(g[5] < g[11]);
  // sombra no feixe reduz a irradiação
  const sh = poaIrradiation({ lat, hsp: 4.6, tilt: 23, azimuth: 0, beamShading: Array(12).fill(0.5) });
  assert.ok(sh.shadingLoss > 0.2 && sh.shadingLoss < 0.5);
});

test("telhado de duas águas: água frontal voltada para o sul quando a casa não gira", () => {
  const b = newBuilding({ roofType: "colonial", pitch: 20, length: 10, width: 8, overhang: 0.5 });
  const planes = roofPlanes(b);
  assert.equal(planes.length, 2);
  assert.ok(Math.abs(planes[0].tilt - 20) < 0.01);
  assert.ok(Math.abs(planes[0].azimuth - 180) < 0.01, `front ${planes[0].azimuth}`);
  assert.ok(Math.abs(planes[1].azimuth - 0) < 0.01 || Math.abs(planes[1].azimuth - 360) < 0.01);
  // girando 90° a frente passa a olhar para leste
  const r = roofPlanes({ ...b, rotation: 90 });
  assert.ok(Math.abs(r[0].azimuth - 90) < 0.01, `rot ${r[0].azimuth}`);
  const hip = roofPlanes({ ...b, roofShape: "quatro-aguas" });
  assert.equal(hip.length, 4);
});

test("encaixe dos módulos respeita bordas e remove células desativadas", () => {
  const p = defaultProject();
  const b = p.buildings[0];
  const plane = roofPlanes(b)[1];
  const arr = newArray(plane.id, plane, -23.5);
  const lay = layoutPanels(plane, arr, p.module, -23.5);
  assert.equal(lay.panels.length, 10); // 13 m de beiral ÷ 1,154 m; 1 fileira em 4,8 m de água
  arr.disabled = [lay.panels[0].key];
  const lay2 = layoutPanels(plane, arr, p.module, -23.5);
  assert.equal(lay2.panels.filter((x) => x.enabled).length, lay.panels.length - 1);
  const bom = structureBom({ roofType: "colonial", panels: lay.panels, brandId: "romagnole", supportSpacing: 0.6, moduleAlongRow: p.module.width, gap: 0.02, stack: 1 });
  assert.ok(bom.find((l) => l.item.startsWith("Gancho"))!.qty > 0);
  assert.ok(bom.find((l) => l.item === "Grampo final")!.qty % 4 === 0);
});

test("laje: fileiras espaçadas contra sombra de inverno", () => {
  const pitch = minRowPitch(-23.5, 1.134, 15, 0);
  assert.ok(pitch > 1.134 * Math.cos((15 * Math.PI) / 180) + 0.2 && pitch < 2.5, `pitch ${pitch}`);
  const b = newBuilding({ roofType: "laje", length: 14, width: 10 });
  const plane = roofPlanes(b)[0];
  assert.ok(plane.flat);
  const arr = newArray(plane.id, plane, -23.5);
  const lay = layoutPanels(plane, arr, defaultProject().module, -23.5);
  assert.ok(lay.panels.length > 10);
  assert.ok(Math.abs(lay.tilt - 15) < 1e-9 && lay.azimuth === 0);
});

test("projeto completo gera kWh coerente", () => {
  const p = defaultProject();
  const plane = roofPlanes(p.buildings[0])[1]; // água norte
  p.arrays.push(newArray(plane.id, plane, p.site.lat));
  const r = analyze(p);
  assert.ok(r.modules > 0);
  const yieldKwh = r.specificYield;
  assert.ok(yieldKwh > 1200 && yieldKwh < 1500, `kWh/kWp ${yieldKwh}`);
  assert.ok(r.arrays[0].relative > 0.95);
  assert.ok(r.bom.length > 3);
});

test("circuito do inversor 5 kW 220 V", () => {
  const s = sizeCircuit({ kind: "inversor", powerW: 5000, connection: "ff", length: 10, method: "B1", ambient: 30, grouped: 1 }, { vFN: 127 });
  assert.ok(Math.abs(s.ib - 22.73) < 0.01);
  assert.equal(s.breaker, 32); // 22,7 × 1,25 = 28,4 → 32 A
  assert.equal(s.section, 4); // B1 2 condutores: 4 mm² = 32 A ≥ 32 A, queda ≈ 1,1%
  assert.ok(s.drop <= 2);
  assert.equal(s.pe, s.section);
  assert.equal(s.poles, 2);
});

test("carregador VE 32 A monofásico", () => {
  const s = sizeCircuit({ kind: "ve", powerW: 7040, current: 32, connection: "ff", length: 15, method: "B1", ambient: 30, grouped: 1 }, { vFN: 127 });
  assert.equal(s.breaker, 40);
  assert.equal(s.section, 6); // B1: 6 mm² = 41 A ≥ 40 A
  assert.ok(s.ok);
});

test("tabelas auxiliares", () => {
  assert.equal(peSection(25), 16);
  assert.equal(peSection(70), 35);
  assert.equal(conduitFor([{ section: 2.5 }, { section: 2.5 }, { section: 2.5 }]).label, '3/4"');
  assert.ok(conduitFor(Array(4).fill({ section: 25 })).dn >= 40);
});

test("strings: limites de tensão no frio", () => {
  const inv = { brand: "X", model: "Y", ...inverterPreset(5, "ff") };
  const d = designStrings({ voc: 51.8, vmp: 43.5, isc: 14.3, imp: 13.45, tempCoefVoc: -0.25 }, inv, 12, 20);
  assert.ok(d.maxPerString === 10 || d.maxPerString === 11);
  assert.equal(d.used, 12);
  assert.ok(d.stringVocMax <= 600);
});

test("rota de eletroduto tem conduletes nas curvas e caixa em trecho longo", () => {
  const r = wallRoute({ x: 0, y: 1.2 }, { x: 4, y: 1.3 }, 0.9);
  assert.equal(r.conduletes.filter((c) => c.type !== "C").length, 2);
  assert.ok(Math.abs(r.length - (0.3 + 4 + 0.4)) < 1e-9);
  const long = wallRoute({ x: 0, y: 1.2 }, { x: 30, y: 1.3 }, 0.9);
  assert.ok(long.conduletes.some((c) => c.type === "C"));
});

test("relatório elétrico padrão fecha sem erros graves", () => {
  const p = defaultProject();
  const r = electricalReport(p, 12);
  assert.ok(r.devices.some((d) => d.kind === "dr" && d.circuitId === "ve"));
  assert.ok(r.devices.some((d) => d.kind === "dps"));
  const errors = r.checks.filter((c) => c.level === "error");
  assert.deepEqual(errors.map((e) => e.text), []);
});

import { fitRectangle, groundWidth, hfovFrom35, parseDroneMeta } from "./drone.ts";
import { toWorld } from "./geometry.ts";

/** JPEG mínimo com EXIF (Make, GPS em ref. S/W, focal 35 mm) e XMP do DJI. */
function fakeDroneJpeg() {
  const bytes: number[] = [];
  const u16 = (v: number) => bytes.push((v >> 8) & 255, v & 255);
  const u32 = (v: number) => bytes.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  // TIFF big-endian
  const tiff: number[] = [];
  const t16 = (v: number) => tiff.push((v >> 8) & 255, v & 255);
  const t32 = (v: number) => tiff.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  const entry = (tag: number, type: number, count: number, value: number) => (t16(tag), t16(type), t32(count), t32(value));
  tiff.push(0x4d, 0x4d);
  t16(42);
  t32(8);
  // IFD0 em 8: 3 entradas
  const ifd0 = 8;
  const exifIfd = ifd0 + 2 + 3 * 12 + 4; // 50
  const gpsIfd = exifIfd + 2 + 12 + 4; // 68
  const gpsData = gpsIfd + 2 + 4 * 12 + 4; // 122
  t16(3);
  entry(0x010f, 2, 4, 0x444a4900); // "DJI\0" cabe na própria entrada
  entry(0x8769, 4, 1, exifIfd);
  entry(0x8825, 4, 1, gpsIfd);
  t32(0);
  t16(1);
  entry(0xa405, 3, 1, 24 << 16);
  t32(0);
  t16(4);
  entry(1, 2, 2, 0x53000000); // "S"
  entry(2, 5, 3, gpsData);
  entry(3, 2, 2, 0x57000000); // "W"
  entry(4, 5, 3, gpsData + 24);
  t32(0);
  for (const [n, d] of [[23, 1], [30, 1], [0, 1], [46, 1], [36, 1], [0, 1]]) (t32(n), t32(d));
  const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta drone-dji:RelativeAltitude="+50.00" drone-dji:GimbalPitchDegree="-90.0" drone-dji:GimbalYawDegree="+30.5"/>');
  u16(0xffd8);
  u16(0xffe1);
  u16(2 + 6 + tiff.length);
  bytes.push(...Buffer.from("Exif\0\0"), ...tiff);
  u16(0xffe1);
  u16(2 + xmp.length);
  bytes.push(...xmp);
  u16(0xffda);
  u32(0);
  return new Uint8Array(bytes).buffer;
}

test("foto de drone: GPS, altura, lente e rumo", () => {
  const m = parseDroneMeta(fakeDroneJpeg());
  assert.ok(Math.abs(m.lat! - -23.5) < 1e-9, `lat ${m.lat}`);
  assert.ok(Math.abs(m.lon! - -46.6) < 1e-9, `lon ${m.lon}`);
  assert.equal(m.focal35, 24);
  assert.equal(m.relAltitude, 50);
  assert.equal(m.gimbalPitch, -90);
  assert.equal(m.yaw, 30.5);
  assert.equal(m.make, "DJI");
  // 24 mm eq. ≈ 73,7° → a 50 m cobre ≈ 75 m
  assert.ok(Math.abs(hfovFrom35(24) - 73.74) < 0.05);
  assert.ok(Math.abs(groundWidth(50, hfovFrom35(24)) - 75) < 0.1);
  assert.deepEqual(parseDroneMeta(new ArrayBuffer(10)).lat, null);
});

test("contorno de 4 cantos vira edificação com medida e rotação certas", () => {
  const b = newBuilding({ x: 3, z: -2, length: 12, width: 7, rotation: 32 });
  const corners = [[-6, 3.5], [6, 3.5], [6, -3.5], [-6, -3.5]].map(([x, z]) => toWorld(b, { x, y: 0, z }));
  const f = fitRectangle(corners);
  assert.ok(Math.abs(f.length - 12) < 1e-9 && Math.abs(f.width - 7) < 1e-9);
  assert.ok(Math.abs(f.rotation - 32) < 1e-9, `rot ${f.rotation}`);
  assert.ok(Math.abs(f.x - 3) < 1e-9 && Math.abs(f.z + 2) < 1e-9);
});
