/**
 * Estado completo do Projeto 3D (telhado + elétrica) e cálculos agregados.
 */

import { layoutPanels, roofPlanes, type Building, type LayoutResult, type ModuleSpec, type Obstacle, type PanelArray, type RoofPlane } from "./geometry.ts";
import { MONTH_DAYS, monthlyGeneration, optimalOrientation, poaIrradiation } from "./irradiance.ts";
import { structureBom, mergeBom, ROOF_TYPES, type BomLine } from "./structures.ts";
import { guessTimezone } from "./sun.ts";
import type { Connection, Grid, InverterSpec } from "./electrical.ts";

export interface Site {
  name: string;
  lat: number;
  lon: number;
  tz: number;
  hsp: number;
  monthlyGhi: number[] | null; // NASA POWER, quando carregado
  hspSource: string;
  albedo: number;
}

export interface EvCharger {
  enabled: boolean;
  brand: string;
  current: number; // A
  connection: Connection;
  rdcdd: boolean; // detecção de 6 mA CC integrada
  x: number;
  y: number;
}

export type DeviceKind = "geral" | "disjuntor" | "dr" | "dps" | "dps-cc" | "seccionadora-cc" | "reserva";

export interface Device {
  id: string;
  kind: DeviceKind;
  label: string;
  poles: number; // módulos DIN ocupados
  current: number; // A (disjuntor/DR) ou kA (DPS: In)
  curve: "B" | "C" | "D";
  breakingKa: number; // capacidade de interrupção
  sens: number; // mA (DR)
  drType: "AC" | "A" | "F" | "B";
  uc: number; // V (DPS)
  circuitId: string | null;
}

export interface ExtraCircuit {
  id: string;
  name: string;
  kind: "chuveiro" | "ar" | "tomadas" | "iluminacao" | "outro";
  powerW: number;
  connection: Connection;
  length: number;
}

export interface Electrical {
  grid: Grid;
  inverter: InverterSpec & { x: number; y: number };
  board: { modules: number; x: number; y: number; kind: "sobrepor" | "embutir" };
  ev: EvCharger;
  routeY: number; // altura do trecho horizontal do eletroduto
  method: "B1" | "C";
  ambient: number;
  dcLength: number; // m de cabo solar (telhado → inversor)
  wallWidth: number;
  extra: ExtraCircuit[];
  devices: Device[];
  autoDevices: boolean;
}

export interface Project {
  version: 1;
  name: string;
  site: Site;
  date: { month: number; day: number; hour: number };
  module: ModuleSpec;
  performanceRatio: number;
  structureBrand: string;
  supportSpacing: number; // espaçamento de terças/caibros
  buildings: Building[];
  arrays: PanelArray[];
  obstacles: Obstacle[];
  electrical: Electrical;
  shading: Record<string, { monthly: number[]; perPanel: Record<string, number> }>; // por array
}

export const MODULE_PRESETS: ModuleSpec[] = [
  { brand: "Genérico 550 W", power: 550, length: 2.279, width: 1.134, voc: 49.9, vmp: 42.1, isc: 14.0, imp: 13.07, tempCoefVoc: -0.27 },
  { brand: "Genérico 585 W (N-type)", power: 585, length: 2.278, width: 1.134, voc: 51.8, vmp: 43.5, isc: 14.3, imp: 13.45, tempCoefVoc: -0.25 },
  { brand: "Genérico 610 W (N-type)", power: 610, length: 2.382, width: 1.134, voc: 53.4, vmp: 44.9, isc: 14.5, imp: 13.6, tempCoefVoc: -0.25 },
  { brand: "Genérico 700 W (210 mm)", power: 700, length: 2.384, width: 1.303, voc: 47.8, vmp: 40.2, isc: 18.5, imp: 17.4, tempCoefVoc: -0.25 },
  { brand: "Genérico 450 W", power: 450, length: 2.094, width: 1.038, voc: 49.5, vmp: 41.3, isc: 11.6, imp: 10.9, tempCoefVoc: -0.28 },
];

let seq = 0;
export const uid = (p = "id") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function newBuilding(partial: Partial<Building> = {}): Building {
  const roofType = partial.roofType ?? "colonial";
  return {
    id: uid("b"),
    name: "Casa",
    x: 0,
    z: 0,
    rotation: 0,
    length: 12,
    width: 8,
    height: 3,
    roofType,
    roofShape: roofType === "laje" || roofType === "solo" ? "plano" : "duas-aguas",
    pitch: ROOF_TYPES[roofType].defaultPitch,
    overhang: roofType === "laje" || roofType === "solo" ? 0 : 0.5,
    parapet: roofType === "laje" ? 0.6 : 0,
    wallColor: "#f3efe6",
    ...partial,
  };
}

export function newArray(planeId: string, plane: RoofPlane | undefined, lat: number): PanelArray {
  return {
    id: uid("a"),
    planeId,
    orientation: plane?.flat ? "paisagem" : "retrato",
    gap: 0.02,
    margin: plane?.roofType === "solo" ? 0.5 : 0.3,
    disabled: [],
    offsetU: 0,
    offsetV: 0,
    rackTilt: plane?.roofType === "solo" ? Math.round(Math.min(30, Math.max(10, Math.abs(lat)))) : 15,
    rackAzimuth: lat >= 0 ? 180 : 0,
    stack: plane?.roofType === "solo" ? 2 : 1,
    rowSpacing: 0,
  };
}

export function defaultElectrical(): Electrical {
  return {
    grid: { system: "bi", vFN: 127, mainBreaker: 63, earthing: "TN-S" },
    inverter: {
      brand: "Growatt",
      model: "Inversor 5 kW",
      powerKw: 5,
      connection: "ff",
      maxCurrent: 0,
      mppts: 2,
      stringsPerMppt: 1,
      vdcMax: 600,
      mpptMin: 80,
      mpptMax: 550,
      iMaxMppt: 16,
      dcSwitch: true,
      dcSpd: true,
      x: -1.4,
      y: 1.5,
    },
    board: { modules: 18, x: 1.6, y: 1.5, kind: "sobrepor" },
    ev: { enabled: true, brand: "Wallbox", current: 32, connection: "ff", rdcdd: true, x: 3.6, y: 1.3 },
    routeY: 0.9,
    method: "B1",
    ambient: 35,
    dcLength: 20,
    wallWidth: 9,
    extra: [],
    devices: [],
    autoDevices: true,
  };
}

export function defaultProject(): Project {
  const lat = -23.55;
  const lon = -46.63;
  const b = newBuilding({ name: "Casa", rotation: 0 });
  return {
    version: 1,
    name: "Novo projeto",
    site: { name: "São Paulo - SP", lat, lon, tz: guessTimezone(lat, lon), hsp: 4.6, monthlyGhi: null, hspSource: "Referência da capital (estimativa)", albedo: 0.2 },
    date: { month: 6, day: 21, hour: 10 },
    module: MODULE_PRESETS[1],
    performanceRatio: 0.8,
    structureBrand: "solar-group",
    supportSpacing: 1.1,
    buildings: [b],
    arrays: [],
    obstacles: [],
    electrical: defaultElectrical(),
    shading: {},
  };
}

/* ------------------------------------------------------------------ análise */

export interface ArrayReport {
  array: PanelArray;
  plane: RoofPlane;
  building: Building;
  layout: LayoutResult;
  modules: number;
  kwp: number;
  tilt: number;
  azimuth: number;
  poaAnnual: number; // HSP no plano, com sombra
  poaNoShade: number;
  shadingLoss: number;
  monthly: number[]; // kWh
  annual: number;
  relative: number; // em relação à orientação ótima (sem sombra)
}

export interface ProjectReport {
  planes: RoofPlane[];
  arrays: ArrayReport[];
  modules: number;
  kwp: number;
  monthly: number[];
  annual: number;
  monthlyAvg: number;
  specificYield: number; // kWh/kWp/ano
  effectiveHsp: number; // HSP equivalente (para o orçamento)
  optimal: { tilt: number; azimuth: number; annual: number };
  bom: BomLine[];
  area: number; // m² de módulos
}

export function allPlanes(p: Project): RoofPlane[] {
  return p.buildings.flatMap(roofPlanes);
}

export function analyze(p: Project): ProjectReport {
  const planes = allPlanes(p);
  const byId = new Map(planes.map((pl) => [pl.id, pl]));
  const optimal = optimalOrientation(p.site.lat, p.site.hsp, p.site.monthlyGhi);
  const arrays: ArrayReport[] = [];
  const boms: BomLine[][] = [];
  for (const arr of p.arrays) {
    const plane = byId.get(arr.planeId);
    const building = plane && p.buildings.find((b) => b.id === plane.buildingId);
    if (!plane || !building) continue;
    const layout = layoutPanels(plane, arr, p.module, p.site.lat);
    const active = layout.panels.filter((x) => x.enabled);
    const modules = active.length;
    const kwp = (modules * p.module.power) / 1000;
    const shade = p.shading[arr.id]?.monthly;
    const poa = poaIrradiation({ lat: p.site.lat, hsp: p.site.hsp, monthlyGhi: p.site.monthlyGhi, tilt: layout.tilt, azimuth: layout.azimuth, albedo: p.site.albedo, beamShading: shade });
    const poaFree = shade ? poaIrradiation({ lat: p.site.lat, hsp: p.site.hsp, monthlyGhi: p.site.monthlyGhi, tilt: layout.tilt, azimuth: layout.azimuth, albedo: p.site.albedo }) : poa;
    const monthly = monthlyGeneration({ kwp, poa: poa.monthly, performanceRatio: p.performanceRatio });
    arrays.push({
      array: arr,
      plane,
      building,
      layout,
      modules,
      kwp,
      tilt: layout.tilt,
      azimuth: layout.azimuth,
      poaAnnual: poa.annual,
      poaNoShade: poaFree.annual,
      shadingLoss: poa.shadingLoss,
      monthly,
      annual: monthly.reduce((a, v) => a + v, 0),
      relative: optimal.annual > 0 ? poaFree.annual / optimal.annual : 0,
    });
    boms.push(
      structureBom({
        roofType: plane.roofType,
        panels: layout.panels,
        brandId: p.structureBrand,
        supportSpacing: p.supportSpacing,
        moduleAlongRow: arr.orientation === "retrato" ? p.module.width : p.module.length,
        gap: arr.gap,
        stack: arr.stack,
      }),
    );
  }
  const monthly = Array.from({ length: 12 }, (_, m) => arrays.reduce((a, r) => a + r.monthly[m], 0));
  const annual = monthly.reduce((a, v) => a + v, 0);
  const modules = arrays.reduce((a, r) => a + r.modules, 0);
  const kwp = arrays.reduce((a, r) => a + r.kwp, 0);
  const specificYield = kwp > 0 ? annual / kwp : 0;
  return {
    planes,
    arrays,
    modules,
    kwp,
    monthly,
    annual,
    monthlyAvg: annual / 12,
    specificYield,
    effectiveHsp: kwp > 0 ? annual / (kwp * 365 * p.performanceRatio) : 0,
    optimal,
    bom: mergeBom(boms),
    area: modules * p.module.length * p.module.width,
  };
}

export const daysInYear = MONTH_DAYS.reduce((a, b) => a + b, 0);

const STORAGE_KEY = "quark.projeto3d.v1";

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveProject(p: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

/** Completa campos faltantes (projetos importados ou de versões antigas). */
export function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const base = defaultProject();
  const r = raw as Partial<Project>;
  if (!Array.isArray(r.buildings)) return null;
  return {
    ...base,
    ...r,
    version: 1,
    site: { ...base.site, ...(r.site ?? {}) },
    date: { ...base.date, ...(r.date ?? {}) },
    module: { ...base.module, ...(r.module ?? {}) },
    buildings: r.buildings.map((b) => ({ ...newBuilding(), ...b })),
    arrays: (r.arrays ?? []).map((a) => ({ ...newArray(a.planeId, undefined, base.site.lat), ...a })),
    obstacles: r.obstacles ?? [],
    electrical: {
      ...base.electrical,
      ...(r.electrical ?? {}),
      grid: { ...base.electrical.grid, ...(r.electrical?.grid ?? {}) },
      inverter: { ...base.electrical.inverter, ...(r.electrical?.inverter ?? {}) },
      board: { ...base.electrical.board, ...(r.electrical?.board ?? {}) },
      ev: { ...base.electrical.ev, ...(r.electrical?.ev ?? {}) },
    },
    shading: r.shading ?? {},
  };
}
