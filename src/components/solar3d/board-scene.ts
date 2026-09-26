import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Device, Project } from "@/lib/solar3d/project";
import { boardBox, evBox, inverterBox, stringBoxNeeded, WALL_HEIGHT, type Box2, type ElectricalReport } from "@/lib/solar3d/board";
import { boardSize, fmt, type Route } from "@/lib/solar3d/electrical";
import { beam, cableTube, clearGroup, disposeObject, keep, label, polyTube, textTexture, wallTexture } from "./three-utils";

export type BoardItem = "inverter" | "board" | "ev";
export type BoardSelection = { kind: "item"; id: BoardItem } | { kind: "device"; id: string } | null;

export interface BoardCallbacks {
  onSelect: (s: BoardSelection) => void;
  onMoveItem: (id: BoardItem, x: number, y: number) => void;
}

const MOD = 0.018; // largura de um módulo DIN (m)
const snap = (v: number) => Math.round(v / 0.05) * 0.05;

const MAT = keep({
  wall: new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 0.95 }),
  floor: new THREE.MeshStandardMaterial({ color: "#8f8a82", roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: "#f5f6f7", roughness: 0.4 }),
  gray: new THREE.MeshStandardMaterial({ color: "#bfc4ca", roughness: 0.5, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: "#2a2f35", roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: "#d8dcdf", metalness: 0.6, roughness: 0.35 }),
  din: new THREE.MeshStandardMaterial({ color: "#b8bec4", metalness: 0.8, roughness: 0.3 }),
  copper: new THREE.MeshStandardMaterial({ color: "#c77d45", metalness: 0.8, roughness: 0.3 }),
  nbar: new THREE.MeshStandardMaterial({ color: "#3b82f6", roughness: 0.4 }),
  tbar: new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.4 }),
  pvc: new THREE.MeshStandardMaterial({ color: "#a3a9ae", roughness: 0.55 }),
  pvcX: new THREE.MeshStandardMaterial({ color: "#a3a9ae", roughness: 0.55, transparent: true, opacity: 0.22, depthWrite: false }),
  alu: new THREE.MeshStandardMaterial({ color: "#aeb5bb", metalness: 0.7, roughness: 0.35 }),
  lever: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.4 }),
  test: new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.4 }),
  led: new THREE.MeshBasicMaterial({ color: "#22c55e" }),
  sel: new THREE.MeshBasicMaterial({ color: "#7fcb86", transparent: true, opacity: 0.35, depthWrite: false }),
});

/** Cores dos condutores (NBR 5410: neutro azul-claro, proteção verde-amarelo). */
export const WIRE = { L1: "#111111", L2: "#c81e1e", L3: "#f4f4f4", N: "#5aa9e6", PE: "#3aa655", DCp: "#d11a1a", DCn: "#1a1a1a" };
const PHASES = [WIRE.L1, WIRE.L2, WIRE.L3];

export class BoardScene {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private items = new Map<BoardItem, THREE.Group>();
  private frame = 0;
  private resizeObs: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private selection: BoardSelection = null;
  private drag: null | { id: BoardItem; start: THREE.Vector3; orig: { x: number; y: number }; moved: boolean } = null;
  private down: { x: number; y: number } | null = null;
  private project: Project | null = null;
  private tween: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number } | null = null;

  constructor(private el: HTMLElement, private cb: BoardCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.style.touchAction = "none";
    el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    el.appendChild(this.labels.domElement);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 200);
    this.camera.position.set(0.6, 1.7, 6.2);
    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.onDown, { capture: true });
    dom.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.target.set(0.6, 1.5, 0);
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minAzimuthAngle = -Math.PI * 0.45;
    this.controls.maxAzimuthAngle = Math.PI * 0.45;

    this.scene.background = new THREE.Color("#e9eef3");
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#8a8173", 1.3));
    const key = new THREE.DirectionalLight("#fff8ee", 1.6);
    key.position.set(3, 6, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -2 });
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const fill = new THREE.PointLight("#ffffff", 0.6, 12);
    fill.position.set(0, 2.2, 2.5);
    this.scene.add(fill);
    this.scene.add(this.root);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(el);
    this.resize();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      if (this.tween) {
        this.tween.t = Math.min(1, this.tween.t + 0.06);
        const k = 1 - (1 - this.tween.t) ** 3;
        this.camera.position.lerpVectors(this.tween.from, this.tween.to, k);
        this.controls.target.lerpVectors(this.tween.tFrom, this.tween.tTo, k);
        if (this.tween.t >= 1) this.tween = null;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    window.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  private resize() {
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  focus(what: "board" | "all" | "inverter" | "ev", instant = false) {
    if (!this.project) return;
    const p = this.project;
    const box = what === "board" ? boardBox(p) : what === "inverter" ? inverterBox(p) : what === "ev" ? evBox(p) : null;
    let to: THREE.Vector3;
    let tTo: THREE.Vector3;
    if (box) {
      to = new THREE.Vector3(box.x + 0.05, box.y + 0.05, Math.max(0.7, box.h * 1.9));
      tTo = new THREE.Vector3(box.x, box.y, 0.05);
    } else {
      // enquadra inversor, quadro, carregador e a descida dos cabos CC
      const boxes = [inverterBox(p), boardBox(p), ...(p.electrical.ev.enabled ? [evBox(p)] : [])];
      const minX = Math.min(...boxes.map((b) => b.x - b.w / 2)) - 0.6;
      const maxX = Math.max(...boxes.map((b) => b.x + b.w / 2)) + 0.4;
      const cx = (minX + maxX) / 2;
      const halfW = (maxX - minX) / 2;
      const vfov = (this.camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
      const dist = Math.max(3.2 / (2 * Math.tan(vfov / 2)), halfW / Math.tan(hfov / 2)) + 0.3;
      to = new THREE.Vector3(cx + dist * 0.12, 1.55, dist);
      tTo = new THREE.Vector3(cx, 1.45, 0);
    }
    if (instant) {
      this.camera.position.copy(to);
      this.controls.target.copy(tTo);
      return;
    }
    this.tween = { from: this.camera.position.clone(), to, tFrom: this.controls.target.clone(), tTo, t: 0 };
  }

  private framed = false;

  update(p: Project, r: ElectricalReport, sel: BoardSelection, xray: boolean) {
    this.project = p;
    this.selection = sel;
    clearGroup(this.root);
    this.items.clear();
    const e = p.electrical;
    this.buildRoom(e.wallWidth);

    const ib = inverterBox(p);
    const bb = boardBox(p);
    const inv = this.buildInverter(ib, `${e.inverter.brand}`, `${fmt(e.inverter.powerKw)} kW`, e.inverter.model);
    this.addItem("inverter", inv, ib);
    const board = this.buildBoard(p, r, bb, xray);
    this.addItem("board", board, bb);
    if (e.ev.enabled) {
      const eb = evBox(p);
      this.addItem("ev", this.buildCharger(eb, r.ev ? `${fmt(r.ev.powerW / 1000)} kW` : ""), eb);
    }

    // eletrodutos
    const acMat = xray ? MAT.pvcX : MAT.pvc;
    const invWires = this.circuitWires(r.inverter.sizing.poles, r.inverter.sizing.neutral);
    this.buildConduit(r.inverterRoute, r.inverter.sizing.conduit.dn, r.inverter.sizing.conduit.label, acMat, xray ? invWires : [], `${r.inverter.sizing.conduit.label} · ${r.inverter.sizing.cableSpec} · ${fmt(r.inverter.length)} m · queda ${fmt(r.inverter.sizing.drop, 2)}%`);
    if (r.ev && r.evRoute) {
      const w = this.circuitWires(r.ev.sizing.poles, r.ev.sizing.neutral);
      this.buildConduit(r.evRoute, r.ev.sizing.conduit.dn, r.ev.sizing.conduit.label, acMat, xray ? w : [], `${r.ev.sizing.conduit.label} · ${r.ev.sizing.cableSpec} · ${fmt(r.ev.length)} m · queda ${fmt(r.ev.sizing.drop, 2)}%`);
    }
    const nStr = Math.max(1, r.strings.strings.length);
    const dcW = Array.from({ length: nStr }, () => [WIRE.DCp, WIRE.DCn]).flat();
    this.buildConduit(r.dcRoute, r.dcConduit.dn, r.dcConduit.label, acMat, xray ? [...dcW, WIRE.PE] : [], `CC · ${r.dcConduit.label} · ${nStr} string(s) · cabo solar ${fmt(r.strings.dcSection)} mm² + T 6 mm²`);
    if (stringBoxNeeded(p)) {
      const sb = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.11), [MAT.gray, MAT.gray, MAT.gray, MAT.gray, new THREE.MeshStandardMaterial({ map: textTexture([{ text: "STRING BOX", size: 22 }, { text: "CC", size: 30 }, { text: "⚡", size: 30, color: "#b45309" }], "#e5e7eb", 128, 160) }), MAT.gray]);
      body.castShadow = true;
      sb.add(body);
      sb.position.set(ib.x - ib.w / 2 - 0.2, Math.min(WALL_HEIGHT - 0.3, ib.y + 0.25), 0.07);
      const l = label("String box CC", "s3d-label");
      l.position.set(0, 0.2, 0.05);
      sb.add(l);
      this.root.add(sb);
    }
    // cabos solares descendo do telhado
    const top = new THREE.Vector3(r.dcRoute.points[0].x, WALL_HEIGHT + 0.25, 0.05);
    for (let i = 0; i < Math.min(4, nStr * 2); i++) {
      const off = (i - (Math.min(4, nStr * 2) - 1) / 2) * 0.012;
      this.root.add(cableTube([top.clone().add(new THREE.Vector3(off - 0.25, 0.1, 0.1)), top.clone().add(new THREE.Vector3(off - 0.05, 0.05, 0.05)), new THREE.Vector3(r.dcRoute.points[0].x + off, WALL_HEIGHT, 0.03)], 0.0035, i % 2 ? WIRE.DCn : WIRE.DCp));
    }
    this.highlight();
    if (!this.framed) {
      this.framed = true;
      this.focus("all", true);
    }
  }

  private circuitWires(poles: number, neutral: boolean) {
    return [...PHASES.slice(0, poles), ...(neutral ? [WIRE.N] : []), WIRE.PE];
  }

  private addItem(id: BoardItem, g: THREE.Group, box: Box2) {
    g.position.set(box.x, box.y, 0);
    g.traverse((o) => {
      o.userData.item = o.userData.item ?? id;
    });
    this.root.add(g);
    this.items.set(id, g);
  }

  private buildRoom(width: number) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, 0.2), new THREE.MeshStandardMaterial({ color: "#efe9df", map: wallTexture(), roughness: 0.95 }));
    wall.position.set(0, WALL_HEIGHT / 2, -0.1);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width + 4, 6), MAT.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 2.8);
    floor.receiveShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.015), MAT.gray);
    base.position.set(0, 0.04, 0.008);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: "#b5643b", roughness: 0.8 }));
    eave.position.set(0, WALL_HEIGHT + 0.06, 0.15);
    eave.castShadow = true;
    this.root.add(wall, floor, base, eave);
    const l = label(`Parede ${fmt(width)} m × ${fmt(WALL_HEIGHT)} m`, "s3d-label");
    l.position.set(-width / 2 + 0.8, 0.25, 0.05);
    this.root.add(l);
  }

  private buildInverter(b: Box2, brand: string, power: string, model: string) {
    const g = new THREE.Group();
    const front = new THREE.MeshStandardMaterial({ map: textTexture([{ text: brand.toUpperCase(), size: 34 }, { text: power, size: 28, color: "#475569" }, { text: "● ● ●", size: 18, color: "#16a34a" }], "#f8fafc", 256, Math.round(256 * (b.h / b.w))), roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [MAT.white, MAT.white, MAT.white, MAT.white, front, MAT.white]);
    body.position.z = b.d / 2 + 0.03;
    body.castShadow = true;
    g.add(body);
    // aletas do dissipador nas laterais
    for (const s of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, b.h * 0.85, 0.004), MAT.gray);
        fin.position.set(s * (b.w / 2 + 0.01), 0, 0.04 + (i * b.d) / 6);
        g.add(fin);
      }
    // suporte de parede
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, b.h * 0.3, 0.03), MAT.metal);
    bracket.position.set(0, b.h * 0.2, 0.015);
    g.add(bracket);
    // prensa-cabos: CC à esquerda, CA à direita
    const glands: [number, THREE.Material][] = [
      [-b.w * 0.35, MAT.dark],
      [-b.w * 0.25, MAT.dark],
      [-b.w * 0.15, MAT.dark],
      [b.w * 0.25, MAT.dark],
    ];
    for (const [x, m] of glands) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12), m);
      c.position.set(x, -b.h / 2 - 0.015, b.d / 2 + 0.03);
      g.add(c);
    }
    // chave CC
    const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16), new THREE.MeshStandardMaterial({ color: "#dc2626" }));
    sw.rotation.x = Math.PI / 2;
    sw.position.set(-b.w * 0.3, -b.h * 0.3, b.d + 0.04);
    g.add(sw);
    const l = label(`${brand} ${power}${model ? ` · ${model}` : ""}`, "s3d-label");
    l.position.set(0, b.h / 2 + 0.08, b.d / 2);
    g.add(l);
    return g;
  }

  private buildCharger(b: Box2, power: string) {
    const g = new THREE.Group();
    const face = new THREE.MeshStandardMaterial({ map: textTexture([{ text: "EV", size: 44, color: "#e2e8f0" }, { text: power, size: 22, color: "#94a3b8" }], "#1f2937", 128, 176), roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [MAT.dark, MAT.dark, MAT.dark, MAT.dark, face, MAT.dark]);
    body.position.z = b.d / 2 + 0.01;
    body.castShadow = true;
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 32), new THREE.MeshBasicMaterial({ color: "#22c55e" }));
    ring.position.set(0, -b.h * 0.25, b.d + 0.012);
    g.add(ring);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 40), MAT.dark);
    coil.position.set(b.w / 2 + 0.2, -0.05, 0.05);
    g.add(coil);
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), MAT.dark);
    holster.position.set(b.w / 2 + 0.2, 0.15, 0.04);
    g.add(holster);
    const l = label(`Carregador VE ${power}`, "s3d-label");
    l.position.set(0, b.h / 2 + 0.08, b.d);
    g.add(l);
    return g;
  }

  /** Posição (no quadro, coordenadas locais) de cada dispositivo nos trilhos DIN. */
  private layoutDevices(devices: Device[], perRow: number, bw: number, bh: number, rows: number) {
    const out: { d: Device; x: number; y: number; row: number }[] = [];
    let row = 0;
    let col = 0;
    const railY = (r: number) => bh / 2 - 0.1 - r * 0.2;
    for (const d of devices) {
      if (col + d.poles > perRow) {
        row++;
        col = 0;
      }
      if (row >= rows) break;
      const left = -bw / 2 + 0.08;
      out.push({ d, x: left + (col + d.poles / 2) * MOD, y: railY(row), row });
      col += d.poles;
    }
    return out;
  }

  private buildBoard(p: Project, r: ElectricalReport, b: Box2, _xray: boolean) {
    const g = new THREE.Group();
    const size = boardSize(p.electrical.board.modules);
    const t = 0.012;
    const shell = p.electrical.board.kind === "embutir" ? MAT.white : MAT.white;
    const back = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, t), MAT.gray);
    back.position.z = t / 2;
    g.add(back);
    for (const [w, h, x, y] of [
      [b.w, t, 0, b.h / 2 - t / 2],
      [b.w, t, 0, -b.h / 2 + t / 2],
      [t, b.h, -b.w / 2 + t / 2, 0],
      [t, b.h, b.w / 2 - t / 2, 0],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, b.d), shell);
      m.position.set(x, y, b.d / 2);
      m.castShadow = true;
      g.add(m);
    }
    // porta aberta (dobradiça à esquerda)
    const hinge = new THREE.Group();
    hinge.position.set(-b.w / 2, 0, b.d);
    hinge.rotation.y = -1.9;
    const door = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, 0.01), [MAT.white, MAT.white, MAT.white, MAT.white, MAT.white, new THREE.MeshStandardMaterial({ map: textTexture([{ text: "QUADRO DE DISTRIBUIÇÃO", size: 16 }, { text: "⚠ Geração própria — FV", size: 16, color: "#b45309" }, { text: `${size.modules} módulos DIN`, size: 14, color: "#64748b" }], "#fafafa", 256, 256) })]);
    door.position.set(b.w / 2, 0, 0.005);
    hinge.add(door);
    g.add(hinge);
    // espelho (tampa interna) com recortes simulados pelas faixas
    const placed = this.layoutDevices(r.devices, size.perRow, b.w, b.h, size.rows);
    for (let row = 0; row < size.rows; row++) {
      const y = b.h / 2 - 0.1 - row * 0.2;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(size.perRow * MOD + 0.02, 0.035, 0.008), MAT.din);
      rail.position.set(-b.w / 2 + 0.08 + (size.perRow * MOD) / 2, y, 0.02);
      g.add(rail);
    }
    const devZ = 0.03;
    for (const { d, x, y } of placed) {
      const w = d.poles * MOD - 0.0006;
      const h = 0.085;
      const depth = 0.065;
      const lines =
        d.kind === "reserva"
          ? [{ text: "", size: 10 }]
          : d.kind === "dps"
            ? [{ text: "DPS", size: 20 }, { text: `${d.uc}V`, size: 15 }, { text: `${d.current}kA`, size: 15 }]
            : d.kind === "dr"
              ? [{ text: "DR", size: 22 }, { text: `${d.current}A`, size: 17 }, { text: `${d.sens}mA`, size: 15 }, { text: `tipo ${d.drType}`, size: 15 }]
              : [{ text: d.kind === "geral" ? "GERAL" : d.label.slice(0, 10), size: 13, color: "#334155" }, { text: `${d.curve}${d.current}`, size: 26 }, { text: `${d.breakingKa}kA`, size: 13, color: "#64748b" }];
      const bg = d.kind === "reserva" ? "#e5e7eb" : d.kind === "dps" ? "#dbe4ee" : "#fbfbfb";
      const faceMat = new THREE.MeshStandardMaterial({ map: textTexture(lines, bg, 64 * d.poles, 200), roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [MAT.white, MAT.white, MAT.white, MAT.white, faceMat, MAT.white]);
      body.position.set(x, y, devZ + depth / 2);
      body.userData.deviceId = d.id;
      body.userData.item = "board";
      body.castShadow = true;
      g.add(body);
      if (d.kind === "disjuntor" || d.kind === "geral" || d.kind === "dr") {
        const lever = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.012, 0.02), MAT.lever);
        lever.position.set(x, y + 0.012, devZ + depth + 0.01);
        lever.userData.deviceId = d.id;
        g.add(lever);
      }
      if (d.kind === "dr") {
        const btn = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.006), MAT.test);
        btn.position.set(x + w * 0.3, y - 0.028, devZ + depth + 0.003);
        g.add(btn);
      }
      if (d.kind === "dps") {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.004), MAT.led);
        win.position.set(x, y + 0.03, devZ + depth + 0.002);
        g.add(win);
      }
      if (this.selection?.kind === "device" && this.selection.id === d.id) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, h + 0.006, depth + 0.006), MAT.sel);
        s.position.copy(body.position);
        g.add(s);
      }
    }
    // barramentos de neutro e terra
    const barY = -b.h / 2 + 0.05;
    const nbar = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.32, 0.018, 0.02), MAT.nbar);
    nbar.position.set(-b.w * 0.2, barY, 0.03);
    const tbar = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.32, 0.018, 0.02), MAT.tbar);
    tbar.position.set(b.w * 0.2, barY, 0.03);
    g.add(nbar, tbar);
    const nl = label("N", "s3d-tag");
    nl.position.set(-b.w * 0.2 - b.w * 0.18, barY, 0.04);
    const tl = label("PE", "s3d-tag");
    tl.position.set(b.w * 0.2 + b.w * 0.18, barY, 0.04);
    g.add(nl, tl);

    // pente de fases por fileira (sobre os disjuntores, exceto DPS/reserva)
    const rows = new Map<number, typeof placed>();
    for (const pd of placed) rows.set(pd.row, [...(rows.get(pd.row) ?? []), pd]);
    for (const list of rows.values()) {
      const feed = list.filter((x) => x.d.kind === "disjuntor" || x.d.kind === "geral" || x.d.kind === "dr");
      if (feed.length < 2) continue;
      const x0 = feed[0].x - (feed[0].d.poles * MOD) / 2;
      const x1 = feed[feed.length - 1].x + (feed[feed.length - 1].d.poles * MOD) / 2;
      const comb = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.008, 0.012), MAT.copper);
      comb.position.set((x0 + x1) / 2, feed[0].y + 0.05, devZ + 0.05);
      g.add(comb);
    }

    // fiação: entrada → geral; saídas dos circuitos até os eletrodutos; neutros e terras nos barramentos
    const z = devZ + 0.03;
    const geral = placed.find((x) => x.d.kind === "geral");
    if (geral) {
      for (let i = 0; i < Math.min(3, geral.d.poles); i++) {
        const x = geral.x + (i - (geral.d.poles - 1) / 2) * MOD;
        g.add(cableTube([new THREE.Vector3(x * 0.3, b.h / 2 + 0.02, 0.05), new THREE.Vector3(x, b.h / 2 - 0.03, z + 0.02), new THREE.Vector3(x, geral.y + 0.045, z)], 0.0032, PHASES[i]));
      }
      g.add(cableTube([new THREE.Vector3(-0.02, b.h / 2 + 0.02, 0.05), new THREE.Vector3(-b.w * 0.42, 0, z), new THREE.Vector3(-b.w * 0.33, barY + 0.012, z)], 0.0032, WIRE.N));
      g.add(cableTube([new THREE.Vector3(0.02, b.h / 2 + 0.02, 0.05), new THREE.Vector3(b.w * 0.42, 0, z), new THREE.Vector3(b.w * 0.33, barY + 0.012, z)], 0.0032, WIRE.PE));
    }
    for (const pd of placed.filter((x) => x.d.kind === "dps")) {
      g.add(cableTube([new THREE.Vector3(pd.x, pd.y - 0.045, z), new THREE.Vector3(pd.x, pd.y - 0.08, z), new THREE.Vector3(b.w * 0.1 + (pd.x + b.w / 2) * 0.05, barY + 0.012, z)], 0.0025, WIRE.PE));
    }
    const entryFor = (route: Route | null | undefined, atEnd: boolean) => {
      if (!route) return null;
      const pt = atEnd ? route.points[route.points.length - 1] : route.points[0];
      return new THREE.Vector3(pt.x - b.x, pt.y - b.y, 0.05);
    };
    const circuits: { id: string; entry: THREE.Vector3 | null; poles: number; neutral: boolean; section: number }[] = [
      { id: "inversor", entry: entryFor(r.inverterRoute, true), poles: r.inverter.sizing.poles, neutral: r.inverter.sizing.neutral, section: r.inverter.sizing.section },
      { id: "ve", entry: entryFor(r.evRoute, false), poles: r.ev?.sizing.poles ?? 0, neutral: !!r.ev?.sizing.neutral, section: r.ev?.sizing.section ?? 0 },
      ...r.extra.map((c) => ({ id: c.id, entry: new THREE.Vector3(0, b.h / 2 + 0.02, 0.05), poles: c.sizing.poles, neutral: c.sizing.neutral, section: c.sizing.section })),
    ];
    for (const c of circuits) {
      if (!c.entry) continue;
      const br = placed.find((x) => x.d.kind === "disjuntor" && x.d.circuitId === c.id);
      if (!br) continue;
      const rad = Math.min(0.006, 0.0022 + Math.sqrt(c.section) * 0.0011);
      for (let i = 0; i < Math.min(c.poles, br.d.poles); i++) {
        const x = br.x + (i - (br.d.poles - 1) / 2) * MOD;
        const channelY = br.y - 0.075 - i * 0.008;
        g.add(cableTube([new THREE.Vector3(x, br.y - 0.045, z), new THREE.Vector3(x, channelY, z), new THREE.Vector3((x + c.entry.x) / 2, channelY - 0.02, z), c.entry.clone().add(new THREE.Vector3(i * 0.008, 0, 0))], rad, PHASES[i]));
      }
      if (c.neutral) g.add(cableTube([new THREE.Vector3(-b.w * 0.28 + Math.random() * 0.05, barY + 0.012, z), new THREE.Vector3(-b.w * 0.1, barY + 0.06, z), c.entry.clone().add(new THREE.Vector3(-0.008, 0, 0))], rad, WIRE.N));
      g.add(cableTube([new THREE.Vector3(b.w * 0.25 + Math.random() * 0.05, barY + 0.012, z), new THREE.Vector3(b.w * 0.1, barY + 0.07, z), c.entry.clone().add(new THREE.Vector3(-0.016, 0, 0))], rad, WIRE.PE));
    }
    const l = label(`Quadro ${size.modules} módulos · ${r.modulesUsed} ocupados`, "s3d-label");
    l.position.set(0, b.h / 2 + 0.07, b.d);
    g.add(l);
    return g;
  }

  private buildConduit(route: Route, dn: number, size: string, mat: THREE.Material, wires: string[], text: string) {
    const r = Math.max(0.008, dn / 2000);
    const z = r + 0.012;
    const pts = route.points.map((p) => new THREE.Vector3(p.x, p.y, z));
    if (pts.length < 2) return;
    const tube = polyTube(pts, r, mat);
    tube.traverse((o) => (o.castShadow = true));
    this.root.add(tube);
    // cabos dentro do eletroduto (raio-X)
    wires.forEach((color, i) => {
      const a = (i / wires.length) * Math.PI * 2;
      const off = new THREE.Vector3(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, Math.sin(a) * r * 0.45);
      const wp = pts.map((p) => p.clone().add(off));
      const seg = new THREE.Group();
      for (let k = 1; k < wp.length; k++) seg.add(beam(wp[k - 1], wp[k], r * 0.32, new THREE.MeshStandardMaterial({ color }), true));
      this.root.add(seg);
    });
    // conduletes
    for (const c of route.conduletes) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(r * 5.5, r * 5.5, r * 2.8), MAT.alu);
      body.position.set(c.x, c.y, z);
      body.castShadow = true;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(r * 5.8, r * 5.8, 0.004), MAT.gray);
      cover.position.set(c.x, c.y, z + r * 1.4 + 0.002);
      this.root.add(body, cover);
      const l = label(c.type, "s3d-tag");
      l.position.set(c.x + r * 4, c.y + r * 4, z);
      this.root.add(l);
    }
    // abraçadeiras a cada ~1 m
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.floor(a.distanceTo(b) / 1);
      for (let k = 1; k <= n; k++) {
        const p = a.clone().lerp(b, k / (n + 1));
        const horiz = Math.abs(a.y - b.y) < 1e-6;
        const clip = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.018 : r * 2.8, horiz ? r * 2.8 : 0.018, r * 1.2), MAT.metal);
        clip.position.set(p.x, p.y, r * 0.6);
        this.root.add(clip);
      }
    }
    // rótulo no maior trecho
    let best = 1;
    for (let i = 1; i < pts.length; i++) if (pts[i].distanceTo(pts[i - 1]) > pts[best].distanceTo(pts[best - 1])) best = i;
    const l = label(text, "s3d-cable");
    l.position.copy(pts[best]).lerp(pts[best - 1], 0.5).add(new THREE.Vector3(0, 0.07, 0));
    this.root.add(l);
  }

  private highlight() {
    const sel = this.selection;
    if (sel?.kind !== "item" || !this.project) return;
    const g = this.items.get(sel.id);
    if (!g) return;
    const bb = new THREE.Box3().setFromObject(g);
    this.root.add(new THREE.Box3Helper(bb.expandByScalar(0.02), new THREE.Color("#7fcb86")));
  }

  /* ---------------------------------------------------------------- interação */

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.root.children, true);
    const wall = new THREE.Vector3();
    return { hit: hits.find((h) => (h.object as THREE.Mesh).isMesh) ?? null, wall: this.raycaster.ray.intersectPlane(this.wallPlane, wall) ? wall : null };
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY };
    const { hit, wall } = this.pick(e);
    const id = hit?.object.userData.item as BoardItem | undefined;
    if (!id || !wall || hit?.object.userData.deviceId) return;
    if (this.selection?.kind === "item" && this.selection.id === id && this.project) {
      const e2 = this.project.electrical;
      const orig = id === "inverter" ? e2.inverter : id === "board" ? e2.board : e2.ev;
      this.controls.enabled = false;
      this.drag = { id, start: wall.clone(), orig: { x: orig.x, y: orig.y }, moved: false };
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const { wall } = this.pick(e);
    if (!wall) return;
    const d = this.drag;
    const dx = snap(wall.x - d.start.x);
    const dy = snap(wall.y - d.start.y);
    d.moved = d.moved || Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    this.items.get(d.id)?.position.set(d.orig.x + dx, d.orig.y + dy, 0);
  };

  private onUp = (e: PointerEvent) => {
    const wasClick = this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5;
    this.down = null;
    const d = this.drag;
    this.drag = null;
    this.controls.enabled = true;
    if (d?.moved) {
      const { wall } = this.pick(e);
      if (wall) this.cb.onMoveItem(d.id, snap(d.orig.x + wall.x - d.start.x), snap(d.orig.y + wall.y - d.start.y));
      return;
    }
    if (!wasClick || e.target !== this.renderer.domElement) return;
    const { hit } = this.pick(e);
    const u = hit?.object.userData ?? {};
    if (u.deviceId) this.cb.onSelect({ kind: "device", id: u.deviceId });
    else if (u.item) this.cb.onSelect({ kind: "item", id: u.item });
    else this.cb.onSelect(null);
  };
}
