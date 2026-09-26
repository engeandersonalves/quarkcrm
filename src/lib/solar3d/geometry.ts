/**
 * Geometria do Projeto 3D: edificações, águas do telhado e encaixe dos módulos.
 * Tudo em metros, no sistema da cena (+X Leste, −Z Norte, +Y para cima).
 */

import { DEG, RAD, azimuthOf, sunFromHourAngle, type Vec3 } from "./sun.ts";

/* ------------------------------------------------------------------ vetores */

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};
const UP = v3(0, 1, 0);

/* ------------------------------------------------------------------ modelo */

export type RoofType = "fibrocimento" | "metalico" | "colonial" | "laje" | "solo";
export type RoofShape = "uma-agua" | "duas-aguas" | "quatro-aguas" | "plano";

export interface Building {
  id: string;
  name: string;
  x: number; // centro
  z: number;
  rotation: number; // graus, giro em torno do eixo vertical (anti-horário visto de cima)
  length: number; // ao longo do eixo local X (direção da cumeeira)
  width: number; // ao longo do eixo local Z
  height: number; // pé-direito (altura das paredes)
  roofType: RoofType;
  roofShape: RoofShape;
  pitch: number; // inclinação do telhado (graus)
  overhang: number; // beiral (m)
  parapet: number; // platibanda da laje (m)
  wallColor: string;
}

export interface ModuleSpec {
  brand: string;
  power: number; // Wp
  length: number; // m (lado maior)
  width: number; // m
  voc: number; // V
  vmp: number;
  isc: number; // A
  imp: number;
  tempCoefVoc: number; // %/°C (negativo)
}

export interface PanelArray {
  id: string;
  planeId: string;
  orientation: "retrato" | "paisagem";
  gap: number; // folga entre módulos (m)
  margin: number; // afastamento das bordas (m)
  disabled: string[]; // células removidas pelo usuário
  offsetU: number; // deslocamento da grade (m)
  offsetV: number;
  // Somente para superfícies planas (laje/solo): estrutura inclinada
  rackTilt: number;
  rackAzimuth: number; // para onde as placas “olham”
  stack: number; // módulos por mesa na profundidade (1–4)
  rowSpacing: number; // 0 = automático (sem sombra entre fileiras às 9h e 15h no inverno)
}

export interface Obstacle {
  id: string;
  kind: "arvore" | "caixa" | "chamine" | "predio" | "poste";
  x: number;
  z: number;
  height: number;
  size: number; // raio/largura
  baseY: number; // apoio (ex.: caixa d'água sobre a laje)
  rotation: number;
}

/* ------------------------------------------------------------------ águas */

export interface RoofPlane {
  id: string;
  buildingId: string;
  label: string;
  roofType: RoofType;
  flat: boolean;
  verts: Vec3[]; // polígono no mundo (sentido qualquer)
  origin: Vec3;
  u: Vec3; // horizontal, ao longo do beiral
  v: Vec3; // subindo a água
  n: Vec3; // normal para cima
  poly: [number, number][]; // polígono em (u, v)
  tilt: number;
  azimuth: number; // para onde a água “olha” (caimento)
  area: number;
}

/** Transforma ponto local da edificação para o mundo. */
export function toWorld(b: Building, p: Vec3): Vec3 {
  const r = b.rotation * RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // rotação em torno de Y no mesmo sentido do three.js
  return v3(b.x + p.x * c + p.z * s, p.y, b.z - p.x * s + p.z * c);
}

export function toLocal(b: Building, p: Vec3): Vec3 {
  const r = b.rotation * RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - b.x;
  const dz = p.z - b.z;
  return v3(dx * c - dz * s, p.y, dx * s + dz * c);
}

/** Altura da cumeeira acima do beiral e alturas úteis. */
export function roofHeights(b: Building) {
  const t = Math.tan(b.pitch * RAD);
  const We = b.width + 2 * b.overhang;
  const eave = b.height - b.overhang * t;
  if (b.roofShape === "plano" || b.roofType === "laje" || b.roofType === "solo") return { eave: b.height, ridge: b.height, t: 0 };
  if (b.roofShape === "uma-agua") return { eave, ridge: eave + We * t, t };
  return { eave, ridge: eave + (We / 2) * t, t };
}

export function effectiveShape(b: Building): RoofShape {
  if (b.roofType === "laje" || b.roofType === "solo") return "plano";
  return b.roofShape === "plano" ? "duas-aguas" : b.roofShape;
}

function planeFrom(id: string, b: Building, label: string, local: Vec3[], flat = false): RoofPlane {
  const verts = local.map((p) => toWorld(b, p));
  // Normal de Newell, orientada para cima
  let n = v3(0, 0, 0);
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const c = verts[(i + 1) % verts.length];
    n = add(n, v3((a.y - c.y) * (a.z + c.z), (a.z - c.z) * (a.x + c.x), (a.x - c.x) * (a.y + c.y)));
  }
  n = unit(n);
  if (n.y < 0) n = mul(n, -1);
  let v: Vec3;
  if (flat || n.y > 0.9999) {
    n = UP;
    const r = b.rotation * RAD;
    v = v3(-Math.sin(r), 0, -Math.cos(r)); // eixo local −Z
  } else {
    v = unit(sub(UP, mul(n, dot(UP, n))));
  }
  const u = unit(cross(v, n));
  // origem no canto de menor (u, v)
  const raw = verts.map((p) => [dot(p, u), dot(p, v)] as [number, number]);
  const minU = Math.min(...raw.map((p) => p[0]));
  const minV = Math.min(...raw.map((p) => p[1]));
  const base = verts[0];
  const origin = add(add(base, mul(u, minU - raw[0][0])), mul(v, minV - raw[0][1]));
  const poly = verts.map((p) => [dot(sub(p, origin), u), dot(sub(p, origin), v)] as [number, number]);
  const tilt = Math.acos(Math.max(-1, Math.min(1, n.y))) * DEG;
  const azimuth = flat ? 0 : azimuthOf(n);
  return { id, buildingId: b.id, label, roofType: b.roofType, flat, verts, origin, u, v, n, poly, tilt, azimuth, area: polygonArea(poly) };
}

/** Águas do telhado (ou superfície da laje/solo) de uma edificação. */
export function roofPlanes(b: Building): RoofPlane[] {
  const { eave, ridge } = roofHeights(b);
  const L = b.length / 2;
  const W = b.width / 2;
  const o = b.overhang;
  const Le = L + o;
  const We = W + o;
  const shape = effectiveShape(b);
  const id = (i: number) => `${b.id}:${i}`;

  if (b.roofType === "solo") {
    return [planeFrom(id(0), b, "Solo", [v3(-L, 0.02, W), v3(L, 0.02, W), v3(L, 0.02, -W), v3(-L, 0.02, -W)], true)];
  }
  if (b.roofType === "laje") {
    const p = b.parapet > 0 ? 0.15 : 0;
    const y = b.height + 0.15;
    return [planeFrom(id(0), b, "Laje", [v3(-L + p, y, W - p), v3(L - p, y, W - p), v3(L - p, y, -W + p), v3(-L + p, y, -W + p)], true)];
  }
  if (shape === "uma-agua") {
    return [planeFrom(id(0), b, "Água única", [v3(-Le, eave, We), v3(Le, eave, We), v3(Le, ridge, -We), v3(-Le, ridge, -We)])];
  }
  if (shape === "duas-aguas") {
    return [
      planeFrom(id(0), b, "Água frontal", [v3(-Le, eave, We), v3(Le, eave, We), v3(Le, ridge, 0), v3(-Le, ridge, 0)]),
      planeFrom(id(1), b, "Água dos fundos", [v3(Le, eave, -We), v3(-Le, eave, -We), v3(-Le, ridge, 0), v3(Le, ridge, 0)]),
    ];
  }
  // quatro águas
  const r = Math.max(Le - We, 0);
  const hr = r > 0 ? ridge : eave + Le * roofHeights(b).t; // pirâmide quando comprimento ≤ largura
  const rz = r > 0 ? 0 : 0;
  if (r === 0) {
    const top = v3(0, Math.min(hr, ridge), rz);
    return [
      planeFrom(id(0), b, "Água frontal", [v3(-Le, eave, We), v3(Le, eave, We), top]),
      planeFrom(id(1), b, "Água dos fundos", [v3(Le, eave, -We), v3(-Le, eave, -We), top]),
      planeFrom(id(2), b, "Água leste", [v3(Le, eave, We), v3(Le, eave, -We), top]),
      planeFrom(id(3), b, "Água oeste", [v3(-Le, eave, -We), v3(-Le, eave, We), top]),
    ];
  }
  return [
    planeFrom(id(0), b, "Água frontal", [v3(-Le, eave, We), v3(Le, eave, We), v3(r, ridge, 0), v3(-r, ridge, 0)]),
    planeFrom(id(1), b, "Água dos fundos", [v3(Le, eave, -We), v3(-Le, eave, -We), v3(-r, ridge, 0), v3(r, ridge, 0)]),
    planeFrom(id(2), b, "Oitão leste", [v3(Le, eave, We), v3(Le, eave, -We), v3(r, ridge, 0)]),
    planeFrom(id(3), b, "Oitão oeste", [v3(-Le, eave, -We), v3(-Le, eave, We), v3(-r, ridge, 0)]),
  ];
}

/* ------------------------------------------------------------------ polígonos */

export function polygonArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function pointInPolygon(p: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Ponto dentro do polígono e a pelo menos `margin` de todas as bordas. */
export function insideWithMargin(p: [number, number], poly: [number, number][], margin: number): boolean {
  if (!pointInPolygon(p, poly)) return false;
  for (let i = 0; i < poly.length; i++) if (distToSegment(p, poly[i], poly[(i + 1) % poly.length]) < margin - 1e-9) return false;
  return true;
}

/* ------------------------------------------------------------------ layout dos módulos */

export interface PanelPlacement {
  key: string;
  row: number; // fileira (ao longo de v / profundidade)
  col: number; // posição na fileira (ao longo de u)
  rack: number; // mesa (superfícies planas)
  center: Vec3; // centro do módulo no mundo
  xAxis: Vec3; // lado ao longo da fileira
  yAxis: Vec3; // normal do módulo
  zAxis: Vec3; // xAxis × yAxis (desce a água)
  sizeX: number;
  sizeZ: number;
  enabled: boolean;
  tilt: number;
  azimuth: number;
  /** Para estruturas de laje/solo: base da mesa no plano (altura da borda baixa e alta). */
  lowEdge?: Vec3;
  highEdge?: Vec3;
}

export interface LayoutResult {
  panels: PanelPlacement[];
  rowPitch: number; // distância entre fileiras (planos) ou entre módulos na água
  tilt: number;
  azimuth: number;
}

export const STRUCTURE_HEIGHT = 0.12; // afastamento módulo–telhado (trilho + gancho)
export const RACK_LOW = 0.3; // altura da borda baixa nas estruturas de laje/solo

/**
 * Distância mínima entre fileiras em superfície plana para não haver sombra
 * entre 9h e 15h (hora solar) no solstício de inverno.
 */
export function minRowPitch(lat: number, depth: number, tilt: number, facingAz: number): number {
  const decl = lat >= 0 ? -23.45 : 23.45; // inverno local
  const f = v3(Math.sin(facingAz * RAD), 0, -Math.cos(facingAz * RAD));
  const h = depth * Math.sin(tilt * RAD);
  let shadow = 0;
  for (const w of [-45, -30, 0, 30, 45]) {
    const s = sunFromHourAngle(lat, decl, w).vector;
    if (s.y <= 0.05) continue;
    const toward = s.x * f.x + s.z * f.z; // sol à frente das placas
    shadow = Math.max(shadow, (h * toward) / s.y);
  }
  return depth * Math.cos(tilt * RAD) + Math.max(0, shadow);
}

export function layoutPanels(plane: RoofPlane, arr: PanelArray, mod: ModuleSpec, lat: number): LayoutResult {
  const portrait = arr.orientation === "retrato";
  const a = portrait ? mod.width : mod.length; // ao longo da fileira
  const b = portrait ? mod.length : mod.width; // na profundidade / subindo a água
  const gap = Math.max(0, arr.gap);
  const disabled = new Set(arr.disabled);
  const panels: PanelPlacement[] = [];

  if (!plane.flat) {
    // Módulos rente ao telhado
    const us = plane.poly.map((p) => p[0]);
    const vs = plane.poly.map((p) => p[1]);
    const w = Math.max(...us) - Math.min(...us);
    const h = Math.max(...vs) - Math.min(...vs);
    const cols = Math.max(0, Math.floor((w - 2 * arr.margin + gap) / (a + gap)));
    const rows = Math.max(0, Math.floor((h - 2 * arr.margin + gap) / (b + gap)));
    const u0 = Math.min(...us) + (w - (cols * (a + gap) - gap)) / 2 + arr.offsetU;
    const v0 = Math.min(...vs) + (h - (rows * (b + gap) - gap)) / 2 + arr.offsetV;
    const z = mul(plane.v, -1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cu = u0 + c * (a + gap) + a / 2;
        const cv = v0 + r * (b + gap) + b / 2;
        const corners: [number, number][] = [
          [cu - a / 2, cv - b / 2],
          [cu + a / 2, cv - b / 2],
          [cu + a / 2, cv + b / 2],
          [cu - a / 2, cv + b / 2],
        ];
        if (!corners.every((p) => insideWithMargin(p, plane.poly, arr.margin))) continue;
        const key = `${r}:${c}`;
        const center = add(add(add(plane.origin, mul(plane.u, cu)), mul(plane.v, cv)), mul(plane.n, STRUCTURE_HEIGHT));
        panels.push({ key, row: r, col: c, rack: r, center, xAxis: plane.u, yAxis: plane.n, zAxis: z, sizeX: a, sizeZ: b, enabled: !disabled.has(key), tilt: plane.tilt, azimuth: plane.azimuth });
      }
    }
    return { panels, rowPitch: b + gap, tilt: plane.tilt, azimuth: plane.azimuth };
  }

  // Superfície plana: mesas inclinadas voltadas para rackAzimuth
  const tilt = Math.max(0, Math.min(60, arr.rackTilt));
  const az = arr.rackAzimuth;
  const f = v3(Math.sin(az * RAD), 0, -Math.cos(az * RAD)); // para onde olham
  const side = unit(cross(f, UP)); // ao longo da fileira
  const stack = Math.max(1, Math.min(4, Math.round(arr.stack)));
  const depth = stack * b + (stack - 1) * gap; // comprimento inclinado da mesa
  const plan = depth * Math.cos(tilt * RAD);
  const pitch = arr.rowSpacing > 0 ? Math.max(arr.rowSpacing, plan) : minRowPitch(lat, depth, tilt, az);
  // coordenadas no plano: s ao longo de side, t ao longo de −f (fileiras para trás)
  const pts = plane.verts.map((p) => [dot(p, side), dot(p, mul(f, -1))] as [number, number]);
  const polyST = pts;
  const ss = pts.map((p) => p[0]);
  const ts = pts.map((p) => p[1]);
  const w = Math.max(...ss) - Math.min(...ss);
  const h = Math.max(...ts) - Math.min(...ts);
  const cols = Math.max(0, Math.floor((w - 2 * arr.margin + gap) / (a + gap)));
  const racks = Math.max(0, Math.floor((h - 2 * arr.margin - plan) / pitch) + 1);
  const s0 = Math.min(...ss) + (w - (cols * (a + gap) - gap)) / 2 + arr.offsetU;
  const t0 = Math.min(...ts) + (h - ((racks - 1) * pitch + plan)) / 2 + arr.offsetV;
  const y0 = plane.verts[0].y;
  const upSlope = unit(add(mul(f, -Math.cos(tilt * RAD)), mul(UP, Math.sin(tilt * RAD))));
  const normal = unit(add(mul(f, Math.sin(tilt * RAD)), mul(UP, Math.cos(tilt * RAD))));
  const zAxis = mul(upSlope, -1);
  const xAxis = unit(cross(normal, zAxis));
  for (let k = 0; k < racks; k++) {
    const tFront = t0 + k * pitch; // borda baixa (frente)
    for (let c = 0; c < cols; c++) {
      const sc = s0 + c * (a + gap) + a / 2;
      const foot: [number, number][] = [
        [sc - a / 2, tFront],
        [sc + a / 2, tFront],
        [sc + a / 2, tFront + plan],
        [sc - a / 2, tFront + plan],
      ];
      if (!foot.every((p) => insideWithMargin(p, polyST, arr.margin))) continue;
      const base = add(add(mul(side, sc), mul(f, -tFront)), v3(0, 0, 0));
      const lowEdge = v3(base.x, y0 + RACK_LOW, base.z);
      const highEdge = add(lowEdge, mul(upSlope, depth));
      for (let s = 0; s < stack; s++) {
        const r = k * stack + s;
        const key = `${r}:${c}`;
        const center = add(lowEdge, mul(upSlope, s * (b + gap) + b / 2));
        panels.push({ key, row: r, col: c, rack: k, center, xAxis, yAxis: normal, zAxis, sizeX: a, sizeZ: b, enabled: !disabled.has(key), tilt, azimuth: az, lowEdge, highEdge });
      }
    }
  }
  return { panels, rowPitch: pitch, tilt, azimuth: az };
}

/** Sequências contínuas de módulos ativos por fileira (base do levantamento de trilhos). */
export function panelRuns(panels: PanelPlacement[]): { row: number; count: number }[] {
  const byRow = new Map<number, number[]>();
  for (const p of panels) {
    if (!p.enabled) continue;
    const list = byRow.get(p.row) ?? [];
    list.push(p.col);
    byRow.set(p.row, list);
  }
  const runs: { row: number; count: number }[] = [];
  for (const [row, cols] of byRow) {
    cols.sort((x, y) => x - y);
    let n = 1;
    for (let i = 1; i <= cols.length; i++) {
      if (i < cols.length && cols[i] === cols[i - 1] + 1) n++;
      else {
        runs.push({ row, count: n });
        n = 1;
      }
    }
  }
  return runs;
}
