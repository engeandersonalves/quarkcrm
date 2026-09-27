/**
 * Peças realistas do quadro de distribuição: trilho DIN, disjuntor/DR/DPS modulares
 * (perfil escalonado de 90 × 45 mm, alavanca, bornes com parafuso), pente de fases,
 * barramentos de neutro/terra e cabos com curvas, ponteiras e isolação verde-amarela.
 */
import * as THREE from "three";
import type { Device } from "@/lib/solar3d/project";
import { canvasTexture, keep } from "./three-utils";

/* ---------------------------------------------------------------- medidas (m) */

export const MOD = 0.018; // 1 módulo DIN
export const RAIL_Z = 0.02; // fundo do trilho (placa de montagem)
export const Z0 = RAIL_Z + 0.0075; // costas do dispositivo (frente do trilho)
export const SHOULDER = Z0 + 0.047; // frente dos “ombros” (onde ficam os parafusos)
export const NOSE = SHOULDER + 0.022; // frente do espelho do disjuntor
export const ZT = Z0 + 0.03; // profundidade de entrada do cabo no borne
export const BODY_H = 0.09;
export const NOSE_H = 0.045;
export const TERM_Y = BODY_H / 2; // face de cima/baixo

const M = keep({
  body: new THREE.MeshStandardMaterial({ color: "#f1f1ed", roughness: 0.55 }),
  bodyDps: new THREE.MeshStandardMaterial({ color: "#dfe2e5", roughness: 0.55 }),
  recess: new THREE.MeshStandardMaterial({ color: "#1b1c1f", roughness: 0.7 }),
  lever: new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.35 }),
  hole: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 1 }),
  screw: new THREE.MeshStandardMaterial({ color: "#c9ccd0", metalness: 0.9, roughness: 0.25 }),
  slot: new THREE.MeshStandardMaterial({ color: "#3a3d42", metalness: 0.6, roughness: 0.5 }),
  rail: new THREE.MeshStandardMaterial({ color: "#c3c8cc", metalness: 0.85, roughness: 0.32 }),
  brass: new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.28 }),
  copper: new THREE.MeshStandardMaterial({ color: "#c67a44", metalness: 0.9, roughness: 0.3 }),
  comb: new THREE.MeshStandardMaterial({ color: "#a3a7ad", roughness: 0.5 }),
  isoN: new THREE.MeshStandardMaterial({ color: "#2563eb", roughness: 0.45 }),
  isoT: new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 0.45 }),
  test: new THREE.MeshStandardMaterial({ color: "#f3c316", roughness: 0.4 }),
  sleeve: new THREE.MeshStandardMaterial({ color: "#d9dde2", metalness: 0.9, roughness: 0.25 }),
});

const wireMats = new Map<string, THREE.Material>();
function wireMat(color: string): THREE.Material {
  let m = wireMats.get(color);
  if (!m) {
    if (color === "PE") {
      // isolação verde com faixa amarela longitudinal
      const map = canvasTexture("pe-stripe", 8, 64, (c, w, h) => {
        c.fillStyle = "#1f9d3a";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#f2d21b";
        c.fillRect(0, h * 0.18, w, h * 0.3);
        c.fillRect(0, h * 0.68, w, h * 0.14);
      }, false);
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35 });
    } else {
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35 });
    }
    m.userData.keep = true;
    wireMats.set(color, m);
  }
  return m;
}

/** Cor do colar da ponteira por seção (DIN 46228-4). */
const FERRULE: Record<number, string> = { 1.5: "#1d1d1d", 2.5: "#2563eb", 4: "#8a8f96", 6: "#eab308", 10: "#dc2626", 16: "#2563eb", 25: "#eab308", 35: "#dc2626", 50: "#57534e" };

/** Raio externo do cabo flexível 750 V (m). */
export function cableRadius(section: number) {
  const od: Record<number, number> = { 1.5: 3.0, 2.5: 3.7, 4: 4.3, 6: 5.0, 10: 6.3, 16: 7.6, 25: 9.5, 35: 10.9, 50: 12.8 };
  return (od[section] ?? Math.sqrt(section) * 1.9) / 2000;
}

/* ---------------------------------------------------------------- cabos */

/** Caminho ortogonal com curvas de raio real entre os pontos (sem “bolas” nos cantos). */
export function roundedPath(input: THREE.Vector3[], radius: number) {
  const pts: THREE.Vector3[] = [];
  for (const p of input) {
    const last = pts[pts.length - 1];
    if (last && last.distanceTo(p) < 1e-5) continue;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const d1 = last.clone().sub(a).normalize();
      const d2 = p.clone().sub(last).normalize();
      if (d1.dot(d2) > 0.9999) {
        pts[pts.length - 1] = p.clone();
        continue;
      }
    }
    pts.push(p.clone());
  }
  const path = new THREE.CurvePath<THREE.Vector3>();
  if (pts.length < 2) return { path, pts };
  let cur = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (i < pts.length - 1) {
      const dIn = p.clone().sub(pts[i - 1]);
      const dOut = pts[i + 1].clone().sub(p);
      const r = Math.min(radius, dIn.length() / 2, dOut.length() / 2);
      const a = p.clone().addScaledVector(dIn.normalize(), -r);
      const b = p.clone().addScaledVector(dOut.normalize(), r);
      if (cur.distanceTo(a) > 1e-6) path.add(new THREE.LineCurve3(cur.clone(), a));
      path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
      cur = b;
    } else if (cur.distanceTo(p) > 1e-6) path.add(new THREE.LineCurve3(cur.clone(), p.clone()));
  }
  return { path, pts };
}

/**
 * Cabo flexível: tubo com a seção real, curvas suaves e ponteira isolada nas pontas que
 * entram em bornes (o primeiro/último ponto fica ~1 cm dentro do borne).
 */
export function wire(points: THREE.Vector3[], section: number, color: string, ends: { start?: boolean; end?: boolean } = {}) {
  const g = new THREE.Group();
  const r = cableRadius(section);
  const { path, pts } = roundedPath(points, Math.max(0.012, r * 5));
  if (pts.length < 2) return g;
  const len = path.getLength();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(24, Math.round(len / 0.003)), r, 12, false), wireMat(color));
  tube.castShadow = true;
  g.add(tube);
  const ferrule = (tip: THREE.Vector3, next: THREE.Vector3) => {
    const dir = next.clone().sub(tip).normalize();
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.05, 0.007, 14), new THREE.MeshStandardMaterial({ color: FERRULE[section] ?? "#555", roughness: 0.4 }));
    collar.position.copy(tip).addScaledVector(dir, 0.0125);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.012, 10), M.sleeve);
    sleeve.position.copy(tip).addScaledVector(dir, 0.004);
    sleeve.quaternion.copy(collar.quaternion);
    g.add(collar, sleeve);
  };
  if (ends.start) ferrule(pts[0], pts[1]);
  if (ends.end) ferrule(pts[pts.length - 1], pts[pts.length - 2]);
  return g;
}

/* ---------------------------------------------------------------- trilho DIN */

/** Trilho DIN 35 mm perfil cartola, com furos oblongos. */
export function dinRail(length: number) {
  const g = new THREE.Group();
  const web = new THREE.Mesh(new THREE.BoxGeometry(length, 0.027, 0.001), M.rail);
  web.position.z = RAIL_Z + 0.0005;
  g.add(web);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(length, 0.001, 0.0075), M.rail);
    side.position.set(0, s * 0.0135, RAIL_Z + 0.00375);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(length, 0.0045, 0.001), M.rail);
    flange.position.set(0, s * 0.0158, RAIL_Z + 0.0075);
    g.add(side, flange);
  }
  for (let x = -length / 2 + 0.02; x < length / 2 - 0.01; x += 0.025) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.0052, 0.0006), M.hole);
    slot.position.set(x, 0, RAIL_Z + 0.0011);
    g.add(slot);
  }
  return g;
}

/* ---------------------------------------------------------------- dispositivos */

function screw(x: number, y: number, rot: number) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0031, 0.0031, 0.0016, 18), M.screw);
  head.rotation.x = Math.PI / 2;
  const slotA = new THREE.Mesh(new THREE.BoxGeometry(0.0048, 0.0007, 0.0006), M.slot);
  slotA.position.z = 0.0008;
  const slotB = slotA.clone();
  slotB.rotation.z = Math.PI / 2; // fenda Pozidriv
  const cross = new THREE.Group();
  cross.add(slotA, slotB);
  cross.rotation.z = rot;
  g.add(head, cross);
  g.position.set(x, y, SHOULDER - 0.004);
  // parafuso rebaixado dentro de um poço no ombro
  const well = new THREE.Mesh(new THREE.BoxGeometry(0.0085, 0.0085, 0.0008), M.hole);
  well.position.set(x, y, SHOULDER + 0.0002);
  const w = new THREE.Group();
  w.add(g, well);
  return w;
}

const brandColor = "#d24a1c";

function faceBreaker(d: Device, brand: string) {
  const W = 110 * d.poles;
  const H = 280;
  return canvasTexture(`face-dj-${brand}-${d.poles}-${d.curve}${d.current}-${d.breakingKa}-${d.kind}`, W, H, (c) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f8f8f5");
    g.addColorStop(1, "#ebebe6");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(0,0,0,.08)";
    for (let i = 1; i < d.poles; i++) c.fillRect(i * 110 - 1, 0, 2, H);
    c.textAlign = "center";
    c.fillStyle = brandColor;
    c.font = "italic 800 24px Arial, sans-serif";
    c.fillText(brand, W / 2, 30);
    c.fillStyle = "#111";
    c.font = `800 ${d.current >= 100 ? 38 : 46}px Arial, sans-serif`;
    c.fillText(`${d.curve}${d.current}`, W / 2, 82);
    c.fillStyle = "#555";
    c.font = "600 12px Arial, sans-serif";
    c.fillText(d.kind === "geral" ? "GERAL" : "", W / 2, 102);
    // alavanca: marcações I / O
    c.fillStyle = "#333";
    c.font = "700 14px Arial";
    c.fillText("I ON", W / 2, 118);
    c.fillText("O OFF", W / 2, 200);
    c.font = "600 12px Arial";
    c.fillText("230/400V~", W / 2, 222);
    // capacidade de interrupção (caixa) e classe
    const kA = `${Math.round(d.breakingKa * 1000)}`;
    c.strokeStyle = "#222";
    c.lineWidth = 1.5;
    c.strokeRect(W / 2 - 30, 232, 42, 20);
    c.fillText(kA, W / 2 - 9, 247);
    c.beginPath();
    c.arc(W / 2 + 24, 242, 9, 0, Math.PI * 2);
    c.stroke();
    c.fillText("3", W / 2 + 24, 246);
    // indicador de contato
    c.fillStyle = "#d61f1f";
    c.fillRect(W - 26, 258, 16, 9);
  }, false);
}

function faceDr(d: Device, brand: string) {
  const W = 110 * d.poles;
  const H = 280;
  return canvasTexture(`face-dr-${brand}-${d.poles}-${d.current}-${d.sens}-${d.drType}`, W, H, (c) => {
    c.fillStyle = "#f5f5f2";
    c.fillRect(0, 0, W, H);
    c.textAlign = "center";
    c.fillStyle = brandColor;
    c.font = "italic 800 24px Arial";
    c.fillText(brand, W / 2, 30);
    c.fillStyle = "#111";
    c.font = "800 40px Arial";
    c.fillText(`${d.current}A`, W / 2, 76);
    c.font = "700 17px Arial";
    c.fillText(`IΔn ${d.sens}mA`, W / 2, 100);
    c.fillStyle = "#333";
    c.font = "700 14px Arial";
    c.fillText("I ON", W / 2 - 30, 118);
    c.fillText("O OFF", W / 2 - 30, 200);
    // símbolo do tipo (A: senoide + pulsante)
    c.strokeStyle = "#111";
    c.lineWidth = 1.6;
    c.strokeRect(W / 2 - 22, 214, 44, 30);
    c.beginPath();
    for (let x = 0; x <= 36; x++) c.lineTo(W / 2 - 18 + x, 222 - Math.sin((x / 36) * Math.PI * 2) * 5);
    c.stroke();
    if (d.drType !== "AC") {
      c.beginPath();
      for (let x = 0; x <= 36; x++) c.lineTo(W / 2 - 18 + x, 238 - Math.max(0, Math.sin((x / 18) * Math.PI)) * 5);
      c.stroke();
    }
    c.font = "800 13px Arial";
    c.fillText(`tipo ${d.drType}`, W / 2, 262);
    c.font = "800 12px Arial";
    c.fillText("T", W - 22, 176);
  }, false);
}

function faceDps(d: Device, brand: string) {
  const W = 110;
  const H = 280;
  return canvasTexture(`face-dps-${brand}-${d.uc}-${d.current}-${d.label}`, W, H, (c) => {
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#7b838c");
    g.addColorStop(0.5, "#98a0a8");
    g.addColorStop(1, "#7b838c");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // janela de estado (verde = ok)
    c.fillStyle = "#1b1b1b";
    c.fillRect(22, 14, W - 44, 26);
    c.fillStyle = "#22c55e";
    c.fillRect(26, 18, W - 52, 18);
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.font = "800 26px Arial";
    c.fillText("DPS", W / 2, 76);
    c.font = "700 13px Arial";
    c.fillText("Classe II", W / 2, 98);
    c.font = "700 14px Arial";
    c.fillText(`Uc ${d.uc}V`, W / 2, 132);
    c.fillText(`In ${d.current}kA`, W / 2, 154);
    c.fillText(`Imáx ${d.current * 2}kA`, W / 2, 176);
    c.font = "800 16px Arial";
    c.fillText(d.label.includes("N") ? "N-PE" : "L-PE", W / 2, 206);
    // ranhuras de pega do cartucho
    c.fillStyle = "rgba(0,0,0,.25)";
    for (let i = 0; i < 4; i++) c.fillRect(20, 222 + i * 8, W - 40, 3);
    c.fillStyle = "#fff";
    c.font = "italic 800 18px Arial";
    c.fillText(brand, W / 2, 272);
  }, false);
}

export interface DeviceModel {
  group: THREE.Group;
  poleX: number[]; // x de cada polo (local do quadro)
  top: (pole: number) => THREE.Vector3; // ponto ~1 cm dentro do borne de cima
  bottom: (pole: number) => THREE.Vector3;
}

/** Disjuntor, DR ou DPS modular no trilho (x = centro, y = eixo do trilho). */
export function deviceModel(d: Device, x: number, y: number, brand: string): DeviceModel {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const W = d.poles * MOD - 0.0004;
  const poleX = Array.from({ length: d.poles }, (_, i) => x - (d.poles * MOD) / 2 + MOD * (i + 0.5));
  const tag = (m: THREE.Object3D) => {
    m.traverse((o) => (o.userData.deviceId = d.id));
    return m;
  };
  const dps = d.kind === "dps" || d.kind === "dps-cc";
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, BODY_H, 0.047), dps ? M.bodyDps : M.body);
  base.position.z = Z0 + 0.0235;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(tag(base));
  const face = dps ? faceDps(d, brand) : d.kind === "dr" ? faceDr(d, brand) : faceBreaker(d, brand);
  const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: dps ? 0.45 : 0.5 });
  const sideMat = dps ? new THREE.MeshStandardMaterial({ color: "#8a929b", roughness: 0.45 }) : M.body;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(dps ? W - 0.0012 : W, NOSE_H, 0.022), [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]);
  nose.position.z = SHOULDER + 0.011;
  nose.castShadow = true;
  g.add(tag(nose));
  // chanfro entre ombro e espelho (degrau)
  for (const s of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.002, 0.004), dps ? M.bodyDps : M.body);
    lip.position.set(0, s * (NOSE_H / 2 + 0.001), SHOULDER + 0.002);
    g.add(tag(lip));
  }
  if (!dps) {
    // alavanca num rebaixo, levantada (ligado)
    const recess = new THREE.Mesh(new THREE.BoxGeometry(W - 0.004, 0.019, 0.002), M.recess);
    recess.position.set(0, -0.0015, NOSE + 0.0003);
    g.add(tag(recess));
    const pivot = new THREE.Group();
    pivot.position.set(d.kind === "dr" ? -W * 0.12 : 0, -0.004, NOSE - 0.002);
    pivot.rotation.x = -0.55;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(d.kind === "dr" ? W * 0.55 : W - 0.006, 0.0075, 0.016), M.lever);
    lever.position.set(0, 0.0045, 0.006);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(d.kind === "dr" ? W * 0.55 : W - 0.006, 0.0025, 0.004), M.lever);
    grip.position.set(0, 0.0075, 0.0125);
    pivot.add(lever, grip);
    lever.castShadow = true;
    g.add(tag(pivot));
    if (d.kind === "dr") {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.004, 18), M.test);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(W / 2 - 0.0085, 0.0085, NOSE + 0.0015);
      g.add(tag(btn));
    }
  }
  // parafusos dos bornes e aberturas de entrada do cabo
  poleX.forEach((px, i) => {
    const lx = px - x;
    for (const s of [1, -1]) {
      g.add(tag(screw(lx, s * 0.034, (i * 0.7 + (s > 0 ? 0.3 : 1.1)) % Math.PI)));
      const hole = new THREE.Mesh(new THREE.BoxGeometry(0.0085, 0.0008, 0.011), M.hole);
      hole.position.set(lx, s * (TERM_Y + 0.0003), ZT);
      g.add(tag(hole));
    }
  });
  return {
    group: g,
    poleX,
    top: (p) => new THREE.Vector3(poleX[p], y + TERM_Y - 0.01, ZT),
    bottom: (p) => new THREE.Vector3(poleX[p], y - TERM_Y + 0.01, ZT),
  };
}

/** Tampa de reserva (espaço vago) — só aparece com o espelho. */
export function blankPlate(poles: number, x: number, y: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(poles * MOD - 0.0004, NOSE_H, 0.003), M.body);
  m.position.set(x, y, SHOULDER + 0.004);
  return m;
}

/* ---------------------------------------------------------------- barramentos */

/** Pente de fases isolado com pinos de cobre entrando nos bornes de cima. */
export function combBusbar(pins: { x: number }[], y: number) {
  const g = new THREE.Group();
  if (!pins.length) return { group: g, feed: new THREE.Vector3() };
  const xs = pins.map((p) => p.x);
  const x0 = Math.min(...xs) - 0.007;
  const x1 = Math.max(...xs) + 0.007;
  const top = y + TERM_Y;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.011, 0.013), M.comb);
  cover.position.set((x0 + x1) / 2, top + 0.0085, ZT);
  cover.castShadow = true;
  g.add(cover);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.003, 0.009), M.comb);
  ridge.position.set((x0 + x1) / 2, top + 0.0155, ZT);
  g.add(ridge);
  for (const p of pins) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.014, 0.0022), M.copper);
    pin.position.set(p.x, top - 0.002, ZT);
    g.add(pin);
  }
  // borne de alimentação na ponta do pente
  const feedBlock = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.016), M.comb);
  feedBlock.position.set(x0 - 0.006, top + 0.009, ZT);
  const feedScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.002, 12), M.screw);
  feedScrew.rotation.x = Math.PI / 2;
  feedScrew.position.set(x0 - 0.006, top + 0.009, ZT + 0.0085);
  g.add(feedBlock, feedScrew);
  return { group: g, feed: new THREE.Vector3(x0 - 0.006, top + 0.004, ZT) };
}

/** Barramento de latão com parafusos, sobre isoladores (azul = neutro, verde = terra). */
export function terminalBar(kind: "N" | "PE", cx: number, y: number, holes: number) {
  const g = new THREE.Group();
  const pitch = 0.0105;
  const L = Math.max(0.06, holes * pitch + 0.02);
  const zBar = 0.034;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(L, 0.009, 0.009), M.brass);
  bar.position.set(cx, y, zBar);
  bar.castShadow = true;
  g.add(bar);
  for (const s of [-1, 1]) {
    const iso = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.017, 0.022), kind === "N" ? M.isoN : M.isoT);
    iso.position.set(cx + s * (L / 2 + 0.004), y, 0.023);
    iso.castShadow = true;
    g.add(iso);
  }
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < holes; i++) {
    const hx = cx - L / 2 + 0.01 + i * pitch + pitch / 2 - 0.005;
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.0016, 14), M.screw);
    sc.rotation.x = Math.PI / 2;
    sc.position.set(hx, y - 0.0015, zBar + 0.0053);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.0038, 0.0006, 0.0006), M.slot);
    sl.position.set(hx, y - 0.0015, zBar + 0.0062);
    sl.rotation.z = (i * 0.9) % Math.PI;
    g.add(sc, sl);
    pts.push(new THREE.Vector3(hx, y + 0.001, zBar));
  }
  return { group: g, holes: pts, length: L };
}
