import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Device, Project } from "@/lib/solar3d/project";
import { boardBox, evBox, inverterBox, stringBoxNeeded, WALL_HEIGHT, type Box2, type ElectricalReport } from "@/lib/solar3d/board";
import { boardSize, fmt, type Route } from "@/lib/solar3d/electrical";
import { beam, cableTube, clearGroup, disposeObject, keep, label, polyTube, textTexture, wallTexture } from "./three-utils";
import { BODY_H, MOD, NOSE, NOSE_H, SHOULDER, TERM_Y, Z0, ZT, blankPlate, cableRadius, combBusbar, deviceModel, dinRail, terminalBar, wire, type DeviceModel } from "./board-parts";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Seção do alimentador do quadro a partir do disjuntor geral (B1, cobre). */
function feederSection(a: number) {
  return a <= 32 ? 6 : a <= 40 ? 10 : a <= 63 ? 16 : a <= 80 ? 25 : a <= 100 ? 35 : 50;
}

export type BoardItem = "inverter" | "board" | "ev";
export type BoardSelection = { kind: "item"; id: BoardItem } | { kind: "device"; id: string } | null;

export interface BoardCallbacks {
  onSelect: (s: BoardSelection) => void;
  onMoveItem: (id: BoardItem, x: number, y: number) => void;
}

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
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#8a8173", 0.8));
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

  update(p: Project, r: ElectricalReport, sel: BoardSelection, xray: boolean, cover = false) {
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
    const board = this.buildBoard(p, r, bb, cover);
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

  private buildBoard(p: Project, r: ElectricalReport, b: Box2, cover: boolean) {
    const g = new THREE.Group();
    const size = boardSize(p.electrical.board.modules);
    const brand = p.electrical.board.brand || "steck";
    const nPh = p.electrical.grid.system === "mono" ? 1 : p.electrical.grid.system === "bi" ? 2 : 3;
    const t = 0.0012; // chapa
    const shell = new THREE.MeshStandardMaterial({ color: "#f3f3f0", roughness: 0.4, metalness: 0.15 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.02, b.h - 0.02, 0.002), new THREE.MeshStandardMaterial({ color: "#c9ccce", metalness: 0.6, roughness: 0.45 }));
    plate.position.z = 0.012;
    plate.receiveShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, t), shell);
    back.position.z = t / 2;
    g.add(back, plate);
    for (const [w, h, x, y] of [
      [b.w, t * 2, 0, b.h / 2 - t],
      [b.w, t * 2, 0, -b.h / 2 + t],
      [t * 2, b.h, -b.w / 2 + t, 0],
      [t * 2, b.h, b.w / 2 - t, 0],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, b.d), shell);
      m.position.set(x, y, b.d / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    // aba frontal (moldura) onde a porta fecha
    for (const [w, h, x, y] of [
      [b.w, 0.012, 0, b.h / 2 - 0.006],
      [b.w, 0.012, 0, -b.h / 2 + 0.006],
      [0.012, b.h, -b.w / 2 + 0.006, 0],
      [0.012, b.h, b.w / 2 - 0.006, 0],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.002), shell);
      m.position.set(x, y, b.d - 0.001);
      g.add(m);
    }
    // porta aberta (dobradiça à esquerda)
    const hinge = new THREE.Group();
    hinge.position.set(-b.w / 2, 0, b.d);
    hinge.rotation.y = -1.95;
    const doorFace = new THREE.MeshStandardMaterial({ map: textTexture([{ text: brand.toUpperCase(), size: 22, color: "#d24a1c" }, { text: "⚡ PERIGO — ELETRICIDADE", size: 15, color: "#b45309" }, { text: "Geração própria (FV) — desligue também o inversor", size: 11, color: "#475569" }], "#f3f3f0", 320, 320), roughness: 0.4 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, 0.012), [shell, shell, shell, shell, doorFace, shell]);
    door.position.set(b.w / 2, 0, 0.006);
    door.castShadow = true;
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), new THREE.MeshStandardMaterial({ color: "#555a60", metalness: 0.8, roughness: 0.3 }));
    lock.rotation.x = Math.PI / 2;
    lock.position.set(b.w - 0.025, 0, 0.014);
    hinge.add(door, lock);
    g.add(hinge);

    // trilhos e dispositivos
    const railLen = size.perRow * MOD + 0.03;
    const left = -(size.perRow * MOD) / 2;
    const railY = (row: number) => b.h / 2 - 0.13 - row * 0.2;
    for (let row = 0; row < size.rows; row++) {
      const rail = dinRail(railLen);
      rail.position.y = railY(row);
      g.add(rail);
    }
    type Placed = { d: Device; row: number; x: number; y: number; model?: DeviceModel };
    const placed: Placed[] = [];
    let row = 0;
    let col = 0;
    for (const d of r.devices) {
      if (col + d.poles > size.perRow) {
        row++;
        col = 0;
      }
      if (row >= size.rows) break;
      const x = left + (col + d.poles / 2) * MOD;
      const y = railY(row);
      const pd: Placed = { d, row, x, y };
      if (d.kind !== "reserva") {
        pd.model = deviceModel(d, x, y, brand);
        g.add(pd.model.group);
        if (this.selection?.kind === "device" && this.selection.id === d.id) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(d.poles * MOD + 0.006, BODY_H + 0.008, 0.075), MAT.sel);
          s.position.set(x, y, Z0 + 0.036);
          g.add(s);
        }
      } else if (cover) g.add(blankPlate(d.poles, x, y));
      placed.push(pd);
      col += d.poles;
    }

    // barramentos de neutro e terra (embaixo)
    const barY = -b.h / 2 + 0.05;
    const holes = Math.max(6, 3 + placed.length);
    const nBar = terminalBar("N", -b.w * 0.2, barY, holes);
    const tBar = terminalBar("PE", b.w * 0.2, barY, holes);
    g.add(nBar.group, tBar.group);
    const nl = label("N", "s3d-tag");
    nl.position.set(-b.w * 0.2 - nBar.length / 2 - 0.02, barY, 0.04);
    const tl = label("PE", "s3d-tag");
    tl.position.set(b.w * 0.2 + tBar.length / 2 + 0.02, barY, 0.04);
    g.add(nl, tl);
    let nHole = 0;
    let tHole = 0;
    const nextN = () => nBar.holes[Math.min(nBar.holes.length - 1, nHole++)];
    const nextT = () => tBar.holes[Math.min(tBar.holes.length - 1, tHole++)];

    // canaletas: cada cabo ganha uma “pista” para não se sobrepor
    const lanes = { L: 0, R: 0, top: new Map<number, number>(), bot: new Map<number, number>() };
    const laneX = (side: number) => {
      const k = side < 0 ? lanes.L++ : lanes.R++;
      return side * (b.w / 2 - 0.022 - Math.min(k, 9) * 0.0065);
    };
    const gutterBelow = (row: number) => {
      const k = lanes.bot.get(row) ?? 0;
      lanes.bot.set(row, k + 1);
      return railY(row) - TERM_Y - 0.022 - Math.min(k, 6) * 0.0055;
    };
    const gutterAbove = (row: number) => {
      const k = lanes.top.get(row) ?? 0;
      lanes.top.set(row, k + 1);
      return railY(row) + TERM_Y + 0.03 + Math.min(k, 6) * 0.0055;
    };
    const Z = ZT;
    const V = (x: number, y: number, z = Z) => new THREE.Vector3(x, y, z);
    const intoBar = (h: THREE.Vector3) => [V(h.x, barY + 0.03), V(h.x, barY + 0.03, h.z), h];

    // saídas (entrada do eletroduto na chapa do quadro)
    const exitOf = (route: Route | null | undefined, atEnd: boolean) => {
      if (!route) return null;
      const pt = atEnd ? route.points[route.points.length - 1] : route.points[0];
      return V(pt.x - b.x, pt.y - b.y);
    };
    const bushing = (e: THREE.Vector3) => {
      const onSide = Math.abs(Math.abs(e.x) - b.w / 2) < 0.01;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0035, 10, 24), new THREE.MeshStandardMaterial({ color: "#3f3f46", roughness: 0.5 }));
      ring.position.copy(e).setZ(Z);
      ring.rotation.set(onSide ? 0 : Math.PI / 2, onSide ? Math.PI / 2 : 0, 0);
      g.add(ring);
    };
    /** Da posição atual até a saída: pista lateral → altura da saída → bucha. */
    const toExit = (from: THREE.Vector3[], exit: THREE.Vector3, spread: number) => {
      const last = from[from.length - 1];
      const side = Math.sign(exit.x) || 1;
      const lx = laneX(side);
      const pts = [...from, V(lx, last.y)];
      const onSide = Math.abs(Math.abs(exit.x) - b.w / 2) < 0.01;
      if (onSide) pts.push(V(lx, exit.y + spread), V(exit.x + side * 0.03, exit.y + spread));
      else {
        const s = Math.sign(exit.y);
        const yIn = exit.y - s * 0.028;
        pts.push(V(lx, yIn - s * Math.abs(spread) * 0.3), V(exit.x + spread, yIn - s * Math.abs(spread) * 0.3), V(exit.x + spread, exit.y + s * 0.04));
      }
      return pts;
    };

    // alimentação vinda do padrão (entra por cima, no centro)
    const main = placed.find((x) => x.d.kind === "geral");
    const feedSec = feederSection(p.electrical.grid.mainBreaker);
    const feedIn = V(0, b.h / 2 + 0.05);
    bushing(V(0, b.h / 2));
    if (main?.model) {
      for (let i = 0; i < Math.min(nPh, main.d.poles); i++) {
        const y0 = gutterAbove(main.row);
        g.add(wire([feedIn.clone().setX(-0.012 + i * 0.012), V(-0.012 + i * 0.012, y0), V(main.model.poleX[i], y0), main.model.top(i)], feedSec, PHASES[i], { end: true }));
      }
    }
    {
      const h = nextN();
      g.add(wire([V(0.024, b.h / 2 + 0.05), V(0.024, b.h / 2 - 0.035), V(laneX(-1), b.h / 2 - 0.035), V(-b.w / 2 + 0.03, barY + 0.03), V(h.x, barY + 0.03), V(h.x, barY + 0.03, h.z), h], feedSec, WIRE.N, { end: true }));
      const e = nextT();
      g.add(wire([V(0.036, b.h / 2 + 0.05), V(0.036, b.h / 2 - 0.045), V(laneX(1), b.h / 2 - 0.045), V(b.w / 2 - 0.03, barY + 0.03), V(e.x, barY + 0.03), V(e.x, barY + 0.03, e.z), e], Math.min(16, feedSec), "PE", { end: true }));
    }

    // pente de fases por fileira: alimenta tudo que não é geral, DPS de neutro ou disjuntor depois de DR
    const drCircuits = new Set(placed.filter((x) => x.d.kind === "dr" && x.d.circuitId).map((x) => x.d.circuitId));
    const neutralPoleOf = (pd: Placed) => {
      if (pd.d.kind !== "dr") return -1;
      const c = pd.d.circuitId === "ve" ? r.ev : pd.d.circuitId === "inversor" ? r.inverter : r.extra.find((e) => e.id === pd.d.circuitId);
      return c?.sizing.neutral ? pd.d.poles - 1 : -1;
    };
    const phaseOfPole = new Map<string, number>(); // `${deviceId}:${pole}` → fase
    let pin = 0;
    for (let rw = 0; rw < size.rows; rw++) {
      const pins: { x: number }[] = [];
      for (const pd of placed.filter((x) => x.row === rw && x.model)) {
        const { d } = pd;
        const fed = d.kind !== "geral" && !(d.kind === "dps" && d.label.includes("N")) && !(d.kind === "disjuntor" && d.circuitId && drCircuits.has(d.circuitId));
        if (!fed) continue;
        const np = neutralPoleOf(pd);
        for (let i = 0; i < d.poles; i++) {
          if (i === np) continue;
          pins.push({ x: pd.model!.poleX[i] });
          phaseOfPole.set(`${d.id}:${i}`, pin++ % nPh);
        }
      }
      if (!pins.length) continue;
      const comb = combBusbar(pins, railY(rw));
      g.add(comb.group);
      // pontes do geral até o borne do pente (contornando o geral pela esquerda)
      if (main?.model) {
        for (let i = 0; i < Math.min(nPh, main.d.poles); i++) {
          const s = main.model.bottom(i);
          const yb = gutterBelow(main.row);
          const xl = left - 0.012 - i * 0.007;
          const ya = railY(rw) + TERM_Y + 0.045 + i * 0.006;
          g.add(wire([s, V(s.x, yb), V(xl, yb), V(xl, ya), V(comb.feed.x + (i - 1) * 0.002, ya), comb.feed.clone().setX(comb.feed.x + (i - 1) * 0.002)], feedSec, PHASES[i], { start: true }));
        }
      }
    }

    // DPS: fase → pente; N → barra de neutro; todos → barra de terra
    for (const pd of placed.filter((x) => x.d.kind === "dps" && x.model)) {
      const m = pd.model!;
      if (pd.d.label.includes("N")) {
        const h = nextN();
        const ya = gutterAbove(pd.row);
        g.add(wire([h, V(h.x, barY + 0.03, h.z), V(h.x, barY + 0.03), V(laneX(-1), barY + 0.03), V(-b.w / 2 + 0.03, ya), V(m.poleX[0], ya), m.top(0)], 4, WIRE.N, { start: true, end: true }));
      }
      const e = nextT();
      const yb = gutterBelow(pd.row);
      g.add(wire([m.bottom(0), V(m.poleX[0], yb), V(e.x, yb), ...intoBar(e)], 4, "PE", { start: true, end: true }));
    }

    // circuitos: saída dos disjuntores (e do DR) até o eletroduto, com neutro e terra
    const circuits: { id: string; exit: THREE.Vector3 | null; section: number; pe: number; neutral: boolean }[] = [
      { id: "inversor", exit: exitOf(r.inverterRoute, true), section: r.inverter.sizing.section, pe: r.inverter.sizing.pe, neutral: r.inverter.sizing.neutral },
      ...(r.ev ? [{ id: "ve", exit: exitOf(r.evRoute, false), section: r.ev.sizing.section, pe: r.ev.sizing.pe, neutral: r.ev.sizing.neutral }] : []),
      ...r.extra.map((c, i) => ({ id: c.id, exit: V(b.w * 0.3 - i * 0.03, b.h / 2), section: c.sizing.section, pe: c.sizing.pe, neutral: c.sizing.neutral })),
    ];
    for (const c of circuits) {
      if (!c.exit) continue;
      bushing(c.exit);
      const br = placed.find((x) => x.d.kind === "disjuntor" && x.d.circuitId === c.id && x.model);
      if (!br) continue;
      const dr = placed.find((x) => x.d.kind === "dr" && x.d.circuitId === c.id && x.model);
      const m = br.model!;
      let spread = -0.012;
      const step = cableRadius(c.section) * 2 + 0.0015;
      // DR → disjuntor: pontes curtas por fora (como no quadro real)
      if (dr) {
        const dm = dr.model!;
        const np = neutralPoleOf(dr);
        let k = 0;
        for (let i = 0; i < dr.d.poles; i++) {
          if (i === np) continue;
          if (k >= br.d.poles) break;
          const s = dm.bottom(i);
          const tIn = m.top(k);
          const yb = s.y - 0.02 - k * 0.004;
          const ya = tIn.y + 0.035 + k * 0.004;
          const zf = NOSE + 0.012 + k * 0.006;
          const ph = phaseOfPole.get(`${dr.d.id}:${i}`) ?? k;
          if (!cover) g.add(wire([s, V(s.x, yb), V(s.x, yb, zf), V(s.x, ya, zf), V(tIn.x, ya, zf), V(tIn.x, ya), tIn], c.section, PHASES[ph % 3], { start: true, end: true })); // com espelho ficam escondidas
          phaseOfPole.set(`${br.d.id}:${k}`, ph);
          k++;
        }
        if (np >= 0) {
          const h = nextN();
          const ya = gutterAbove(dr.row);
          g.add(wire([h, V(h.x, barY + 0.03, h.z), V(h.x, barY + 0.03), V(laneX(-1), barY + 0.03), V(-b.w / 2 + 0.03, ya), V(dm.poleX[np], ya), dm.top(np)], c.section, WIRE.N, { start: true, end: true }));
          const s = dm.bottom(np);
          g.add(wire(toExit([s, V(s.x, gutterBelow(dr.row))], c.exit, spread), c.section, WIRE.N, { start: true }));
          spread += step;
        }
      }
      for (let i = 0; i < br.d.poles; i++) {
        const s = m.bottom(i);
        const ph = phaseOfPole.get(`${br.d.id}:${i}`) ?? i;
        g.add(wire(toExit([s, V(s.x, gutterBelow(br.row))], c.exit, spread), c.section, PHASES[ph % 3], { start: true }));
        spread += step;
      }
      if (c.neutral && !(dr && neutralPoleOf(dr) >= 0)) {
        const h = nextN();
        g.add(wire(toExit([h, V(h.x, barY + 0.03, h.z), V(h.x, barY + 0.022)], c.exit, spread), c.section, WIRE.N, { start: true }));
        spread += step;
      }
      const e = nextT();
      g.add(wire(toExit([e, V(e.x, barY + 0.03, e.z), V(e.x, barY + 0.018)], c.exit, spread), c.pe, "PE", { start: true }));
    }

    // espelho (tampa interna) com recortes para os dispositivos
    if (cover) {
      const s = new THREE.Shape();
      const cw = b.w - 0.03;
      const ch = b.h - 0.03;
      s.moveTo(-cw / 2, -ch / 2);
      s.lineTo(cw / 2, -ch / 2);
      s.lineTo(cw / 2, ch / 2);
      s.lineTo(-cw / 2, ch / 2);
      s.closePath();
      for (let rw = 0; rw < size.rows; rw++) {
        const y = railY(rw);
        const hole = new THREE.Path();
        hole.moveTo(left - 0.002, y - NOSE_H / 2 - 0.001);
        hole.lineTo(-left + 0.002, y - NOSE_H / 2 - 0.001);
        hole.lineTo(-left + 0.002, y + NOSE_H / 2 + 0.001);
        hole.lineTo(left - 0.002, y + NOSE_H / 2 + 0.001);
        hole.closePath();
        s.holes.push(hole);
      }
      const cov = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: "#f5f5f2", roughness: 0.45 }));
      cov.position.z = SHOULDER + 0.006;
      cov.castShadow = true;
      g.add(cov);
      // porta-etiquetas com o nome de cada circuito
      for (const pd of placed) {
        if (pd.d.kind === "reserva") continue;
        const tex = textTexture([{ text: pd.d.label.slice(0, 14), size: 13, color: "#111" }], "#fffef5", 32 * pd.d.poles * 4, 40);
        const lab = new THREE.Mesh(new THREE.PlaneGeometry(pd.d.poles * MOD - 0.001, 0.009), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
        lab.position.set(pd.x, pd.y + NOSE_H / 2 + 0.009, SHOULDER + 0.0085);
        g.add(lab);
      }
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
