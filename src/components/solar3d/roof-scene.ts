import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { effectiveShape, roofHeights, type Building, type Obstacle, type PanelPlacement } from "@/lib/solar3d/geometry";
import type { Project, ProjectReport } from "@/lib/solar3d/project";
import { daySamples, cardinal } from "@/lib/solar3d/irradiance";
import type { Vec3 } from "@/lib/solar3d/sun";
import { beam, clearGroup, keep, disposeObject, grassTexture, label, moduleTexture, orientedBox, roofTexture, wallTexture } from "./three-utils";

export type RoofTool = "select" | "draw" | "panels" | "obstacle" | "measure" | "trace" | "calibrate";
export type Selection = { kind: "building" | "obstacle" | "array"; id: string } | null;

export interface RoofCallbacks {
  onSelect: (s: Selection) => void;
  onCreateBuilding: (r: { x: number; z: number; length: number; width: number }) => void;
  onMoveBuilding: (id: string, x: number, z: number) => void;
  onMoveObstacle: (id: string, x: number, z: number) => void;
  onPlaneClick: (planeId: string) => void;
  onPanelToggle: (arrayId: string, key: string) => void;
  onPlaceObstacle: (p: Vec3) => void;
  onMeasure: (d: number | null) => void;
  onTrace: (pts: { x: number; z: number }[]) => void;
  onCalibrate: (distance: number) => void;
  onTracePoint?: (n: number) => void;
}

const snap = (v: number, s = 0.1) => Math.round(v / s) * s;
const V = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);

const MAT = keep({
  alu: new THREE.MeshStandardMaterial({ color: "#c7ccd2", metalness: 0.7, roughness: 0.35 }),
  steel: new THREE.MeshStandardMaterial({ color: "#9aa3a8", metalness: 0.6, roughness: 0.45 }),
  clamp: new THREE.MeshStandardMaterial({ color: "#3a3f45", metalness: 0.5, roughness: 0.5 }),
  concrete: new THREE.MeshStandardMaterial({ color: "#a9a69e", roughness: 0.95 }),
  frame: new THREE.MeshStandardMaterial({ color: "#cfd5db", metalness: 0.8, roughness: 0.3 }),
  back: new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: "#3d5a73", metalness: 0.3, roughness: 0.15 }),
  door: new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.7 }),
  ghost: new THREE.MeshBasicMaterial({ color: "#9bd373", transparent: true, opacity: 0.28, depthWrite: false }),
  select: new THREE.LineBasicMaterial({ color: "#7fcb86" }),
});

export class RoofScene {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private world = new THREE.Group();
  private overlay = new THREE.Group();
  private sunGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private preview = new THREE.Group();
  private compass = new THREE.Group();
  private buildingGroups = new Map<string, THREE.Group>();
  private obstacleGroups = new Map<string, THREE.Group>();
  private raycaster = new THREE.Raycaster();
  private ground: THREE.Mesh;
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private frame = 0;
  private resizeObs: ResizeObserver;
  private tool: RoofTool = "select";
  private selection: Selection = null;
  private project: Project | null = null;
  private drag: null | { kind: "building" | "obstacle" | "draw"; id?: string; start: THREE.Vector3; orig?: { x: number; z: number }; moved: boolean } = null;
  private down: { x: number; y: number } | null = null;
  private measureA: THREE.Vector3 | null = null;
  private tracePts: THREE.Vector3[] = [];
  private backdropGroup = new THREE.Group();
  private backdropKey = "";
  private extent = 20;
  private center = new THREE.Vector3();
  private sunVec = new THREE.Vector3(0.3, 0.8, -0.4);

  constructor(private el: HTMLElement, private cb: RoofCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.touchAction = "none";
    el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.style.position = "absolute";
    this.labels.domElement.style.inset = "0";
    this.labels.domElement.style.pointerEvents = "none";
    el.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.set(20, 17, 24);

    // eventos antes dos controles (captura) para poder desligar a órbita ao arrastar
    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.onDown, { capture: true });
    dom.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.target.set(0, 2, 0);
    this.controls.minDistance = 3;
    this.controls.maxDistance = 400;

    this.scene.background = new THREE.Color("#cfe6f7");
    this.scene.fog = new THREE.Fog("#cfe6f7", 180, 600);
    this.hemi = new THREE.HemisphereLight("#eaf4ff", "#6d7a55", 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff6e0", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    const grass = grassTexture();
    grass.repeat.set(80, 80);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.ground = true;
    this.scene.add(this.ground);
    const grid = new THREE.GridHelper(200, 200, "#5f7d4f", "#6f8f5d");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    grid.position.y = 0.005;
    this.scene.add(grid);

    this.scene.add(this.world, this.overlay, this.sunGroup, this.measureGroup, this.preview, this.compass, this.backdropGroup);
    this.buildCompass();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(el);
    this.resize();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
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

  setTool(t: RoofTool) {
    this.tool = t;
    this.measureA = null;
    this.tracePts = [];
    clearGroup(this.measureGroup);
    this.renderer.domElement.style.cursor = t === "draw" || t === "measure" || t === "obstacle" || t === "trace" || t === "calibrate" ? "crosshair" : t === "panels" ? "cell" : "default";
    this.refreshOverlay();
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  /** Enquadra a câmera no conjunto. */
  frameAll() {
    const r = Math.max(8, this.extent);
    this.controls.target.copy(this.center).setY(2);
    this.camera.position.set(this.center.x + r * 0.9, r * 0.8, this.center.z + r * 1.1);
  }

  view(kind: "top" | "north" | "south" | "iso") {
    const r = Math.max(10, this.extent * 1.4);
    const c = this.center;
    this.controls.target.set(c.x, 1.5, c.z);
    if (kind === "top") this.camera.position.set(c.x, r * 1.6, c.z + 0.01);
    else if (kind === "north") this.camera.position.set(c.x, r * 0.5, c.z - r);
    else if (kind === "south") this.camera.position.set(c.x, r * 0.5, c.z + r);
    else this.frameAll();
  }

  /** Foto aérea no chão, em escala real e orientada pelo rumo da câmera. */
  setBackdrop(b: Project["backdrop"]) {
    const key = b ? `${b.image.length}:${b.image.slice(-64)}:${b.widthM}:${b.rotation}:${b.x}:${b.z}:${b.opacity}` : "";
    if (key === this.backdropKey) return;
    this.backdropKey = key;
    clearGroup(this.backdropGroup);
    if (!b) return;
    const tex = new THREE.TextureLoader().load(b.image);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const h = (b.widthM * b.pxH) / b.pxW;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, transparent: b.opacity < 1, opacity: b.opacity, depthWrite: b.opacity >= 1 });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(b.widthM, h), mat);
    photo.rotation.x = -Math.PI / 2;
    photo.receiveShadow = true;
    const holder = new THREE.Group();
    holder.position.set(b.x, 0.008, b.z);
    holder.rotation.y = (-b.rotation * Math.PI) / 180;
    holder.add(photo);
    // moldura e seta do topo da foto
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(b.widthM, h)), new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 }));
    edges.rotation.x = -Math.PI / 2;
    edges.position.y = 0.002;
    holder.add(edges);
    this.backdropGroup.add(holder);
  }

  /* ---------------------------------------------------------------- sol */

  setSun(v: Vec3, paths: { pts: Vec3[]; color: string; hours?: { h: number; v: Vec3 }[] }[]) {
    this.sunVec.set(v.x, v.y, v.z).normalize();
    const up = v.y;
    const R = Math.max(30, this.extent * 1.8);
    this.sun.position.copy(this.center).addScaledVector(this.sunVec, 80);
    this.sun.target.position.copy(this.center);
    const cam = this.sun.shadow.camera;
    const s = Math.max(15, this.extent * 1.3);
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 1;
    cam.far = 200;
    cam.updateProjectionMatrix();
    const day = Math.max(0, Math.min(1, up * 3 + 0.1));
    this.sun.intensity = up > 0 ? 0.6 + 2.4 * Math.min(1, up * 2) : 0;
    this.sun.color.set(up < 0.2 ? "#ffcf9a" : "#fff6e0");
    this.hemi.intensity = 0.25 + 0.7 * day;
    const sky = new THREE.Color("#0f1830").lerp(new THREE.Color(up < 0.15 ? "#f6c79a" : "#cfe6f7"), day);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color = sky;

    clearGroup(this.sunGroup);
    if (up > -0.05) {
      const disc = new THREE.Mesh(new THREE.SphereGeometry(R * 0.035, 20, 12), new THREE.MeshBasicMaterial({ color: "#ffd84d" }));
      disc.position.copy(this.center).addScaledVector(this.sunVec, R);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(R * 0.06, 20, 12), new THREE.MeshBasicMaterial({ color: "#fff1a8", transparent: true, opacity: 0.35 }));
      glow.position.copy(disc.position);
      this.sunGroup.add(disc, glow);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.center.clone().setY(0.05), disc.position]), new THREE.LineDashedMaterial({ color: "#f59e0b", dashSize: 0.6, gapSize: 0.4 }));
      ray.computeLineDistances();
      this.sunGroup.add(ray);
    }
    for (const p of paths) {
      if (p.pts.length < 2) continue;
      const pts = p.pts.map((q) => new THREE.Vector3(q.x, q.y, q.z).multiplyScalar(R).add(this.center));
      this.sunGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.85 })));
      for (const h of p.hours ?? []) {
        const pos = new THREE.Vector3(h.v.x, h.v.y, h.v.z).multiplyScalar(R).add(this.center);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.008, 8, 6), new THREE.MeshBasicMaterial({ color: p.color }));
        dot.position.copy(pos);
        this.sunGroup.add(dot);
        if (h.h % 3 === 0) {
          const l = label(`${h.h}h`, "s3d-hour");
          l.position.copy(pos);
          this.sunGroup.add(l);
        }
      }
    }
  }

  private buildCompass() {
    clearGroup(this.compass);
    const R = Math.max(14, this.extent * 1.1);
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 96), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.center.x, 0.02, this.center.z);
    this.compass.add(ring);
    const dirs: [string, number, number, string][] = [
      ["N", 0, -1, "s3d-compass n"],
      ["S", 0, 1, "s3d-compass"],
      ["L", 1, 0, "s3d-compass"],
      ["O", -1, 0, "s3d-compass"],
    ];
    for (const [t, x, z, cls] of dirs) {
      const l = label(t, cls);
      l.position.set(this.center.x + x * (R + 1), 0.1, this.center.z + z * (R + 1));
      this.compass.add(l);
    }
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 3), new THREE.MeshBasicMaterial({ color: "#e11d48" }));
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(this.center.x, 0.05, this.center.z - R + 1.2);
    this.compass.add(arrow);
  }

  /* ---------------------------------------------------------------- cena */

  update(project: Project, report: ProjectReport, selection: Selection, heatmap: boolean) {
    this.project = project;
    this.selection = selection;
    clearGroup(this.world);
    this.buildingGroups.clear();
    this.obstacleGroups.clear();

    // limites
    const box = new THREE.Box3();
    for (const b of project.buildings) {
      const r = Math.hypot(b.length, b.width) / 2 + 1;
      box.expandByPoint(new THREE.Vector3(b.x - r, 0, b.z - r));
      box.expandByPoint(new THREE.Vector3(b.x + r, 6, b.z + r));
    }
    for (const o of project.obstacles) box.expandByPoint(new THREE.Vector3(o.x, o.height, o.z));
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(16, 4, 16));
    const size = box.getSize(new THREE.Vector3());
    const newExtent = Math.max(10, Math.hypot(size.x, size.z) / 2);
    const newCenter = box.getCenter(new THREE.Vector3()).setY(0);
    if (Math.abs(newExtent - this.extent) > 0.5 || newCenter.distanceTo(this.center) > 0.5) {
      this.extent = newExtent;
      this.center.copy(newCenter);
      this.buildCompass();
    }

    for (const b of project.buildings) {
      const g = new THREE.Group();
      g.userData.buildingId = b.id;
      this.buildBuilding(g, b, report);
      this.world.add(g);
      this.buildingGroups.set(b.id, g);
    }
    // módulos e estruturas
    for (const a of report.arrays) {
      const g = this.buildingGroups.get(a.building.id);
      if (!g) continue;
      const showGhost = selection?.kind === "array" && selection.id === a.array.id;
      const shade = heatmap ? project.shading[a.array.id]?.perPanel : undefined;
      this.buildPanels(g, a.array.id, a.plane.roofType, a.layout.panels, showGhost, shade);
    }
    for (const o of project.obstacles) {
      const g = new THREE.Group();
      this.buildObstacle(g, o);
      this.world.add(g);
      this.obstacleGroups.set(o.id, g);
    }
    this.refreshOverlay(report);
  }

  private currentReport: ProjectReport | null = null;

  private refreshOverlay(report?: ProjectReport) {
    if (report) this.currentReport = report;
    report = this.currentReport ?? undefined;
    clearGroup(this.overlay);
    if (!this.project || !report) return;
    const sel = this.selection;
    // rótulos das águas (orientação e inclinação)
    for (const pl of report.planes) {
      const b = this.project.buildings.find((x) => x.id === pl.buildingId)!;
      const show = this.tool === "panels" || (sel?.kind === "building" && sel.id === b.id);
      if (!show) continue;
      const c = pl.verts.reduce<THREE.Vector3>((a, v) => a.add(V(v)), new THREE.Vector3()).multiplyScalar(1 / pl.verts.length);
      const l = label(pl.flat ? `${pl.label} · plana` : `${Math.round(pl.tilt)}° · ${cardinal(pl.azimuth)} ${Math.round(pl.azimuth)}°`, "s3d-tag");
      l.position.copy(c).addScaledVector(V(pl.n), 0.6);
      this.overlay.add(l);
    }
    if (sel?.kind === "building") {
      const b = this.project.buildings.find((x) => x.id === sel.id);
      const g = b && this.buildingGroups.get(b.id);
      if (b && g) {
        g.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.userData.outline) {
            const e = new THREE.LineSegments(new THREE.EdgesGeometry((o as THREE.Mesh).geometry, 25), MAT.select);
            o.updateWorldMatrix(true, false);
            e.applyMatrix4(o.matrixWorld);
            this.overlay.add(e);
          }
        });
        const rot = new THREE.Matrix4().makeRotationY((b.rotation * Math.PI) / 180).setPosition(b.x, 0, b.z);
        const put = (text: string, p: THREE.Vector3) => {
          const l = label(text, "s3d-dim");
          l.position.copy(p.applyMatrix4(rot));
          this.overlay.add(l);
        };
        const f = (v: number) => `${v.toFixed(2).replace(".", ",")} m`;
        put(f(b.length), new THREE.Vector3(0, 0.15, b.width / 2 + 0.4));
        put(f(b.width), new THREE.Vector3(b.length / 2 + 0.4, 0.15, 0));
        if (b.roofType !== "solo") put(`↕ ${f(b.height)}`, new THREE.Vector3(b.length / 2 + 0.3, b.height / 2, b.width / 2 + 0.3));
      }
    }
    if (sel?.kind === "obstacle") {
      const g = this.obstacleGroups.get(sel.id);
      if (g) {
        const bb = new THREE.Box3().setFromObject(g);
        this.overlay.add(new THREE.Box3Helper(bb, new THREE.Color("#7fcb86")));
      }
    }
  }

  private buildBuilding(g: THREE.Group, b: Building, report: ProjectReport) {
    const local = new THREE.Group();
    local.position.set(b.x, 0, b.z);
    local.rotation.y = (b.rotation * Math.PI) / 180;
    g.add(local);
    const tag = (m: THREE.Mesh, occluder = true) => {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.buildingId = b.id;
      m.userData.occluder = occluder;
      m.userData.outline = true;
      return m;
    };
    const wt = wallTexture();
    const wallMat = new THREE.MeshStandardMaterial({ color: b.wallColor, map: wt, roughness: 0.95 });

    if (b.roofType === "solo") {
      const rt = roofTexture("solo");
      rt.map.repeat.set(1 / rt.scale[0], 1 / rt.scale[1]);
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(b.length, b.width), new THREE.MeshStandardMaterial({ map: rt.map, roughness: 1 }));
      patch.rotation.x = -Math.PI / 2;
      patch.position.y = 0.012;
      patch.receiveShadow = true;
      patch.userData.buildingId = b.id;
      patch.userData.planeId = `${b.id}:0`;
      patch.userData.outline = true;
      local.add(patch);
      return;
    }

    const h = b.height;
    const walls = tag(new THREE.Mesh(new THREE.BoxGeometry(b.length, h, b.width), wallMat));
    walls.position.y = h / 2;
    local.add(walls);
    // porta e janelas
    if (h >= 2.3) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.1), MAT.door);
      door.position.set(-b.length * 0.18, 1.05, b.width / 2 + 0.01);
      local.add(door);
      const nWin = Math.max(1, Math.floor(b.length / 4));
      for (let i = 0; i < nWin; i++) {
        const x = -b.length / 2 + ((i + 0.5) * b.length) / nWin;
        if (Math.abs(x - door.position.x) < 1.2) continue;
        for (const side of [1, -1]) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), MAT.glass);
          w.position.set(x, Math.min(h - 0.9, 1.6), side * (b.width / 2 + 0.01));
          if (side < 0) w.rotation.y = Math.PI;
          local.add(w);
        }
      }
    }
    const shape = effectiveShape(b);
    if (b.roofType === "laje") {
      const slab = tag(new THREE.Mesh(new THREE.BoxGeometry(b.length + 0.1, 0.15, b.width + 0.1), MAT.concrete));
      slab.position.y = h + 0.075;
      slab.userData.planeId = `${b.id}:0`;
      local.add(slab);
      if (b.parapet > 0) {
        const t = 0.15;
        const y = h + 0.15 + b.parapet / 2;
        const mk = (sx: number, sz: number, x: number, z: number) => {
          const m = tag(new THREE.Mesh(new THREE.BoxGeometry(sx, b.parapet, sz), wallMat));
          m.position.set(x, y, z);
          local.add(m);
        };
        mk(b.length + 0.1, t, 0, b.width / 2 - t / 2 + 0.05);
        mk(b.length + 0.1, t, 0, -b.width / 2 + t / 2 - 0.05);
        mk(t, b.width - 2 * t + 0.1, b.length / 2 - t / 2 + 0.05, 0);
        mk(t, b.width - 2 * t + 0.1, -b.length / 2 + t / 2 - 0.05, 0);
      }
    } else if (shape === "duas-aguas" || shape === "uma-agua") {
      // oitões (triângulos entre o topo da parede e o telhado)
      const t = roofHeights(b).t;
      const W = b.width / 2;
      const s = new THREE.Shape();
      // fica 8 cm abaixo das telhas para não disputar a superfície (nem o clique) com a água do telhado
      const drop = 0.08 / Math.cos(Math.atan(t));
      if (shape === "duas-aguas") {
        s.moveTo(-W, h - drop);
        s.lineTo(W, h - drop);
        s.lineTo(0, h + W * t - drop);
      } else {
        s.moveTo(-W, h - drop);
        s.lineTo(W, h - drop);
        s.lineTo(W, h + 2 * W * t - drop);
      }
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: b.length, bevelEnabled: false });
      // shape x → −z local, shape y → y, extrusão → +x
      geo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));
      geo.translate(-b.length / 2, 0, 0);
      const gable = tag(new THREE.Mesh(geo, wallMat));
      local.add(gable);
    }
    // águas do telhado (em coordenadas do mundo)
    if (b.roofType !== "laje") {
      const rt = roofTexture(b.roofType);
      rt.map.repeat.set(1 / rt.scale[0], 1 / rt.scale[1]);
      const mat = new THREE.MeshStandardMaterial({ map: rt.map, roughness: b.roofType === "metalico" ? 0.45 : 0.85, metalness: b.roofType === "metalico" ? 0.4 : 0, side: THREE.DoubleSide });
      for (const pl of report.planes.filter((p) => p.buildingId === b.id)) {
        const s = new THREE.Shape(pl.poly.map(([u, v]) => new THREE.Vector2(u, v)));
        const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
        const m = new THREE.Matrix4().makeBasis(V(pl.u), V(pl.v), V(pl.n));
        m.setPosition(V(pl.origin).addScaledVector(V(pl.n), -0.05));
        geo.applyMatrix4(m);
        const mesh = tag(new THREE.Mesh(geo, mat));
        mesh.userData.planeId = pl.id;
        g.add(mesh);
      }
    }
  }

  private buildPanels(g: THREE.Group, arrayId: string, roofType: string, panels: PanelPlacement[], ghost: boolean, shade?: Record<string, number>) {
    const topCache = new Map<string, THREE.Material>();
    const topMat = (landscape: boolean, loss?: number) => {
      const key = `${landscape}-${loss === undefined ? "" : Math.round(loss * 20)}`;
      let m = topCache.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ map: moduleTexture(landscape), roughness: 0.22, metalness: 0.35 });
        if (loss !== undefined) {
          // mapa de calor: verde (sem sombra) → amarelo → vermelho (≥ 25% do feixe perdido)
          const t = Math.min(1, loss / 0.25);
          (m as THREE.MeshStandardMaterial).emissive = new THREE.Color("#22c55e").lerp(new THREE.Color("#facc15"), Math.min(1, t * 2)).lerp(new THREE.Color("#ef4444"), Math.max(0, t * 2 - 1));
          (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
        }
        topCache.set(key, m);
      }
      return m;
    };
    const flat = roofType === "laje" || roofType === "solo";
    for (const p of panels) {
      if (!p.enabled && !ghost) continue;
      const x = V(p.xAxis);
      const y = V(p.yAxis);
      const z = V(p.zAxis);
      const c = V(p.center);
      const landscape = p.sizeX > p.sizeZ;
      const mats = p.enabled ? [MAT.frame, MAT.frame, topMat(landscape, shade?.[p.key]), MAT.back, MAT.frame, MAT.frame] : MAT.ghost;
      const m = orientedBox([p.sizeX, 0.035, p.sizeZ], c, x, y, z, mats);
      m.userData.arrayId = arrayId;
      m.userData.panelKey = p.key;
      m.userData.buildingId = g.userData.buildingId;
      if (p.enabled) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.occluder = true;
        m.userData.panel = true;
      }
      g.add(m);
    }
    const active = panels.filter((p) => p.enabled);
    if (!active.length) return;
    if (flat) this.buildRacks(g, roofType, active);
    else this.buildRails(g, roofType, active);
  }

  /** Trilhos, ganchos/prisioneiros/mini-trilhos e grampos de telhado inclinado. */
  private buildRails(g: THREE.Group, roofType: string, panels: PanelPlacement[]) {
    const rows = new Map<number, PanelPlacement[]>();
    for (const p of panels) rows.set(p.row, [...(rows.get(p.row) ?? []), p]);
    for (const list of rows.values()) {
      list.sort((a, b) => a.col - b.col);
      // separa sequências contínuas
      const runs: PanelPlacement[][] = [];
      for (const p of list) {
        const last = runs[runs.length - 1];
        if (last && p.col === last[last.length - 1].col + 1) last.push(p);
        else runs.push([p]);
      }
      for (const run of runs) {
        const a = run[0];
        const b = run[run.length - 1];
        const x = V(a.xAxis);
        const y = V(a.yAxis);
        const z = V(a.zAxis);
        const start = V(a.center).addScaledVector(x, -a.sizeX / 2 - 0.05);
        const end = V(b.center).addScaledVector(x, b.sizeX / 2 + 0.05);
        for (const off of [-a.sizeZ / 4, a.sizeZ / 4]) {
          const s = start.clone().addScaledVector(z, off).addScaledVector(y, -0.055);
          const e = end.clone().addScaledVector(z, off).addScaledVector(y, -0.055);
          if (roofType === "metalico") {
            // mini-trilhos em cada linha de grampo
            for (let i = 0; i <= run.length; i++) {
              const pc = i < run.length ? V(run[i].center).addScaledVector(x, -run[i].sizeX / 2) : V(b.center).addScaledVector(x, b.sizeX / 2);
              const mc = pc.addScaledVector(z, off).addScaledVector(y, -0.075);
              g.add(orientedBox([0.06, 0.035, 0.4], mc, x, y, z, MAT.alu));
            }
          } else {
            const len = s.distanceTo(e);
            const rail = orientedBox([len, 0.04, 0.04], s.clone().add(e).multiplyScalar(0.5), x, y, z, MAT.alu);
            rail.castShadow = true;
            g.add(rail);
            const spacing = roofType === "colonial" ? 1.1 : 1.3;
            const n = Math.max(2, Math.ceil(len / spacing) + 1);
            for (let i = 0; i < n; i++) {
              const p = s.clone().lerp(e, i / (n - 1));
              if (roofType === "colonial") {
                // gancho: sobe do caibro, contorna a telha e segura o trilho
                g.add(orientedBox([0.035, 0.09, 0.012], p.clone().addScaledVector(y, -0.05), x, y, z, MAT.steel));
                g.add(orientedBox([0.035, 0.012, 0.12], p.clone().addScaledVector(y, -0.1).addScaledVector(z, 0.05), x, y, z, MAT.steel));
              } else {
                // prisioneiro atravessando a telha
                g.add(beam(p.clone(), p.clone().addScaledVector(y, -0.14), 0.014, MAT.steel, true));
                const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12), MAT.clamp);
                washer.position.copy(p).addScaledVector(y, -0.09);
                washer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), y);
                g.add(washer);
              }
            }
          }
          // grampos
          for (let i = 0; i <= run.length; i++) {
            const edge = i < run.length ? V(run[i].center).addScaledVector(x, -run[i].sizeX / 2) : V(b.center).addScaledVector(x, b.sizeX / 2);
            g.add(orientedBox([i === 0 || i === run.length ? 0.03 : 0.04, 0.04, 0.05], edge.addScaledVector(z, off).addScaledVector(y, 0.01), x, y, z, MAT.clamp));
          }
        }
      }
    }
  }

  /** Triângulos (laje) e mesas com pilares (solo). */
  private buildRacks(g: THREE.Group, roofType: string, panels: PanelPlacement[]) {
    const racks = new Map<string, PanelPlacement>();
    for (const p of panels) {
      // uma “coluna” de estrutura por borda de módulo em cada mesa
      const k = `${p.rack}:${p.col}`;
      if (!racks.has(k)) racks.set(k, p);
    }
    const solo = roofType === "solo";
    const mat = solo ? MAT.steel : MAT.alu;
    const drawn = new Set<string>();
    for (const p of racks.values()) {
      const x = V(p.xAxis);
      for (const side of [-1, 1]) {
        const key = `${p.rack}:${p.col + (side > 0 ? 1 : 0)}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        if (solo && (p.col + (side > 0 ? 1 : 0)) % 2 === 1 && racks.has(`${p.rack}:${p.col + side}`)) continue; // pilares a cada 2 módulos
        const low = V(p.lowEdge!).addScaledVector(x, (side * p.sizeX) / 2 - side * 0.05);
        const high = V(p.highEdge!).addScaledVector(x, (side * p.sizeX) / 2 - side * 0.05);
        const base = p.lowEdge!.y - 0.3;
        const lowB = low.clone().setY(base);
        const highB = high.clone().setY(base);
        const t = solo ? 0.08 : 0.04;
        g.add(beam(low, high, t, mat));
        g.add(beam(lowB.clone().setY(solo ? -0.2 : base), low, t, mat));
        g.add(beam(highB.clone().setY(solo ? -0.2 : base), high, t, mat));
        if (!solo) g.add(beam(lowB, highB, t, mat));
        else g.add(beam(lowB.clone().setY(base + 0.25), high.clone().lerp(low, 0.5), 0.05, mat));
        for (const f of [lowB, highB]) {
          const foot = new THREE.Mesh(solo ? new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12) : new THREE.BoxGeometry(0.3, 0.12, 0.3), MAT.concrete);
          foot.position.copy(f).setY(base + 0.06);
          foot.castShadow = true;
          g.add(foot);
        }
      }
    }
    // trilhos longitudinais sob os módulos
    const byRack = new Map<number, PanelPlacement[]>();
    for (const p of panels) byRack.set(p.rack, [...(byRack.get(p.rack) ?? []), p]);
    for (const list of byRack.values()) {
      const rows = new Map<number, PanelPlacement[]>();
      for (const p of list) rows.set(p.row, [...(rows.get(p.row) ?? []), p]);
      for (const row of rows.values()) {
        row.sort((a, b) => a.col - b.col);
        const a = row[0];
        const b = row[row.length - 1];
        const x = V(a.xAxis);
        const y = V(a.yAxis);
        const z = V(a.zAxis);
        for (const off of [-a.sizeZ / 4, a.sizeZ / 4]) {
          const s = V(a.center).addScaledVector(x, -a.sizeX / 2 - 0.05).addScaledVector(z, off).addScaledVector(y, -0.05);
          const e = V(b.center).addScaledVector(x, b.sizeX / 2 + 0.05).addScaledVector(z, off).addScaledVector(y, -0.05);
          g.add(orientedBox([s.distanceTo(e), 0.04, 0.04], s.add(e).multiplyScalar(0.5), x, y, z, mat));
        }
      }
    }
  }

  private buildObstacle(g: THREE.Group, o: Obstacle) {
    const tag = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.obstacleId = o.id;
      m.userData.occluder = true;
      g.add(m);
      return m;
    };
    g.position.set(o.x, o.baseY, o.z);
    g.rotation.y = (o.rotation * Math.PI) / 180;
    if (o.kind === "arvore") {
      const trunkH = o.height * 0.4;
      const trunk = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, trunkH, 8), new THREE.MeshStandardMaterial({ color: "#6b4a2f" })));
      trunk.position.y = trunkH / 2;
      const r = o.size;
      const crown = tag(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ color: "#4f8a3c", flatShading: true, roughness: 0.9 })));
      crown.position.y = Math.max(trunkH + r * 0.6, o.height - r);
      crown.scale.y = Math.max(0.6, (o.height - trunkH) / (2 * r));
    } else if (o.kind === "caixa") {
      const m = tag(new THREE.Mesh(new THREE.CylinderGeometry(o.size / 2, o.size / 2.2, o.height, 20), new THREE.MeshStandardMaterial({ color: "#2f6fb3", roughness: 0.5 })));
      m.position.y = o.height / 2;
    } else if (o.kind === "chamine") {
      const m = tag(new THREE.Mesh(new THREE.BoxGeometry(o.size, o.height, o.size), new THREE.MeshStandardMaterial({ color: "#9c4a33", roughness: 0.9 })));
      m.position.y = o.height / 2;
    } else if (o.kind === "poste") {
      const m = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, o.height, 10), MAT.concrete));
      m.position.y = o.height / 2;
      const arm = tag(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), MAT.steel));
      arm.position.set(0.5, o.height - 0.3, 0);
    } else {
      const m = tag(new THREE.Mesh(new THREE.BoxGeometry(o.size, o.height, o.size), new THREE.MeshStandardMaterial({ color: "#b9b3a6", map: wallTexture(), roughness: 0.95 })));
      m.position.y = o.height / 2;
    }
  }

  /* ---------------------------------------------------------------- interação */

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([this.world, this.ground], true);
    const ground = new THREE.Vector3();
    const onGround = this.raycaster.ray.intersectPlane(this.groundPlane, ground) ? ground : null;
    return { hit: hits[0] ?? null, ground: onGround };
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY };
    const { hit, ground } = this.pick(e);
    const obj = hit?.object;
    if (this.tool === "draw" && ground) {
      this.controls.enabled = false;
      const p = new THREE.Vector3(snap(ground.x), 0, snap(ground.z));
      this.drag = { kind: "draw", start: p, moved: false };
      return;
    }
    if (this.tool === "select" && obj && ground && this.selection) {
      const bId = obj.userData.buildingId;
      const oId = obj.userData.obstacleId;
      if (this.selection.kind === "building" && bId === this.selection.id) {
        const b = this.project?.buildings.find((x) => x.id === bId);
        if (b) {
          this.controls.enabled = false;
          this.drag = { kind: "building", id: bId, start: ground.clone(), orig: { x: b.x, z: b.z }, moved: false };
        }
      } else if (this.selection.kind === "obstacle" && oId === this.selection.id) {
        const o = this.project?.obstacles.find((x) => x.id === oId);
        if (o) {
          this.controls.enabled = false;
          this.drag = { kind: "obstacle", id: oId, start: ground.clone(), orig: { x: o.x, z: o.z }, moved: false };
        }
      }
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const { ground } = this.pick(e);
    if (!ground) return;
    const d = this.drag;
    if (d.kind === "draw") {
      const p = new THREE.Vector3(snap(ground.x), 0, snap(ground.z));
      d.moved = true;
      clearGroup(this.preview);
      const w = Math.abs(p.x - d.start.x);
      const h = Math.abs(p.z - d.start.z);
      if (w < 0.1 || h < 0.1) return;
      const rect = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: "#7fcb86", transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      rect.rotation.x = -Math.PI / 2;
      rect.position.set((p.x + d.start.x) / 2, 0.03, (p.z + d.start.z) / 2);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(rect.geometry), new THREE.LineBasicMaterial({ color: "#1c1234" }));
      edges.rotation.copy(rect.rotation);
      edges.position.copy(rect.position);
      const lw = label(`${w.toFixed(1).replace(".", ",")} m`, "s3d-dim");
      lw.position.set(rect.position.x, 0.1, Math.max(p.z, d.start.z) + 0.5);
      const lh = label(`${h.toFixed(1).replace(".", ",")} m`, "s3d-dim");
      lh.position.set(Math.max(p.x, d.start.x) + 0.6, 0.1, rect.position.z);
      this.preview.add(rect, edges, lw, lh);
      return;
    }
    const dx = snap(ground.x - d.start.x);
    const dz = snap(ground.z - d.start.z);
    d.moved = d.moved || Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05;
    const g = d.kind === "building" ? this.buildingGroups.get(d.id!) : this.obstacleGroups.get(d.id!);
    if (!g) return;
    if (d.kind === "building") g.position.set(dx, 0, dz);
    else g.position.set(d.orig!.x + dx, g.position.y, d.orig!.z + dz);
    clearGroup(this.overlay);
  };

  private onUp = (e: PointerEvent) => {
    const wasClick = this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5;
    const d = this.drag;
    this.drag = null;
    this.controls.enabled = true;
    if (d?.kind === "draw") {
      clearGroup(this.preview);
      const { ground } = this.pick(e);
      if (ground) {
        const p = new THREE.Vector3(snap(ground.x), 0, snap(ground.z));
        const L = Math.abs(p.x - d.start.x);
        const W = Math.abs(p.z - d.start.z);
        if (L >= 1 && W >= 1) this.cb.onCreateBuilding({ x: (p.x + d.start.x) / 2, z: (p.z + d.start.z) / 2, length: L, width: W });
      }
      this.down = null;
      return;
    }
    if (d && d.moved) {
      const { ground } = this.pick(e);
      if (ground) {
        const dx = snap(ground.x - d.start.x);
        const dz = snap(ground.z - d.start.z);
        if (d.kind === "building") this.cb.onMoveBuilding(d.id!, snap(d.orig!.x + dx), snap(d.orig!.z + dz));
        else this.cb.onMoveObstacle(d.id!, snap(d.orig!.x + dx), snap(d.orig!.z + dz));
      }
      this.down = null;
      return;
    }
    if (!wasClick || e.target !== this.renderer.domElement) {
      this.down = null;
      return;
    }
    this.down = null;
    this.click(e);
  };

  private click(e: PointerEvent) {
    const { hit, ground } = this.pick(e);
    const obj = hit?.object;
    const u = obj?.userData ?? {};
    if (this.tool === "trace" || this.tool === "calibrate") {
      if (!ground) return;
      const need = this.tool === "trace" ? 4 : 2;
      if (this.tracePts.length >= need) {
        this.tracePts = [];
        clearGroup(this.measureGroup);
      }
      const p = ground.clone().setY(0.06);
      this.tracePts.push(p);
      const color = this.tool === "trace" ? "#f59e0b" : "#e11d48";
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      dot.position.copy(p);
      dot.renderOrder = 10;
      const n = label(String(this.tracePts.length), "s3d-dim");
      n.position.copy(p).setY(0.6);
      this.measureGroup.add(dot, n);
      if (this.tracePts.length > 1) {
        const a = this.tracePts[this.tracePts.length - 2];
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, p]), new THREE.LineBasicMaterial({ color, depthTest: false }));
        line.renderOrder = 10;
        const d = label(`${a.distanceTo(p).toFixed(2).replace(".", ",")} m`, "s3d-dim");
        d.position.copy(a).add(p).multiplyScalar(0.5);
        this.measureGroup.add(line, d);
      }
      this.cb.onTracePoint?.(this.tracePts.length);
      if (this.tracePts.length === need) {
        if (this.tool === "trace") {
          const close = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, this.tracePts[0]]), new THREE.LineBasicMaterial({ color, depthTest: false }));
          this.measureGroup.add(close);
          this.cb.onTrace(this.tracePts.map((q) => ({ x: q.x, z: q.z })));
        } else this.cb.onCalibrate(this.tracePts[0].distanceTo(this.tracePts[1]));
      }
      return;
    }
    if (this.tool === "measure") {
      const p = hit ? hit.point.clone() : ground;
      if (!p) return;
      if (!this.measureA) {
        clearGroup(this.measureGroup);
        this.measureA = p;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: "#e11d48" }));
        dot.position.copy(p);
        this.measureGroup.add(dot);
        this.cb.onMeasure(null);
      } else {
        const a = this.measureA;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, p]), new THREE.LineBasicMaterial({ color: "#e11d48", depthTest: false }));
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: "#e11d48" }));
        dot.position.copy(p);
        const dist = a.distanceTo(p);
        const l = label(`${dist.toFixed(2).replace(".", ",")} m`, "s3d-dim");
        l.position.copy(a).add(p).multiplyScalar(0.5);
        this.measureGroup.add(line, dot, l);
        this.measureA = null;
        this.cb.onMeasure(dist);
      }
      return;
    }
    if (this.tool === "obstacle") {
      const p = hit ? hit.point : ground;
      if (p) this.cb.onPlaceObstacle({ x: snap(p.x), y: Math.max(0, p.y), z: snap(p.z) });
      return;
    }
    if (this.tool === "panels") {
      if (u.panelKey && u.arrayId) this.cb.onPanelToggle(u.arrayId, u.panelKey);
      else if (u.planeId) this.cb.onPlaneClick(u.planeId);
      return;
    }
    if (this.tool === "select") {
      if (u.arrayId) this.cb.onSelect({ kind: "array", id: u.arrayId });
      else if (u.buildingId) this.cb.onSelect({ kind: "building", id: u.buildingId });
      else if (u.obstacleId) this.cb.onSelect({ kind: "obstacle", id: u.obstacleId });
      else this.cb.onSelect(null);
    }
  }

  /* ---------------------------------------------------------------- sombreamento */

  /**
   * Fração do feixe direto perdida por sombra — por módulo e por mês — lançando raios de
   * 3 pontos de cada módulo em direção ao sol ao longo do dia médio de cada mês.
   */
  async computeShading(project: Project, report: ProjectReport, onProgress?: (f: number) => void) {
    const occluders: THREE.Object3D[] = [];
    this.world.updateMatrixWorld(true);
    this.world.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.occluder) occluders.push(o);
    });
    const ray = new THREE.Raycaster();
    const lat = project.site.lat;
    const samples = Array.from({ length: 12 }, (_, m) => daySamples(lat, m, 7.5));
    const out: Project["shading"] = {};
    const total = report.arrays.reduce((a, r) => a + r.layout.panels.filter((p) => p.enabled).length, 0) || 1;
    let done = 0;
    for (const a of report.arrays) {
      const monthlyHit = Array(12).fill(0);
      const monthlyW = Array(12).fill(0);
      const perPanel: Record<string, number> = {};
      const meshByKey = new Map<string, THREE.Object3D>();
      this.world.traverse((o) => {
        if (o.userData.arrayId === a.array.id && o.userData.panel) meshByKey.set(o.userData.panelKey, o);
      });
      for (const p of a.layout.panels.filter((x) => x.enabled)) {
        const own = meshByKey.get(p.key);
        const n = V(p.yAxis);
        const z = V(p.zAxis);
        const pts = [-0.35, 0, 0.35].map((f) => V(p.center).addScaledVector(z, f * p.sizeZ).addScaledVector(n, 0.03));
        let hitW = 0;
        let allW = 0;
        for (let m = 0; m < 12; m++) {
          for (const s of samples[m]) {
            const dir = new THREE.Vector3(s.sun.x, s.sun.y, s.sun.z);
            const w = Math.max(0, n.dot(dir)) * s.cosZ ** 0.3; // peso ~ feixe no plano (atenua sol rasante)
            if (w <= 0) continue;
            let blocked = 0;
            for (const o of pts) {
              ray.set(o, dir);
              ray.far = 200;
              const hits = ray.intersectObjects(occluders, false);
              if (hits.some((h) => h.object !== own && h.distance > 0.02)) blocked++;
            }
            const f = blocked / pts.length;
            monthlyHit[m] += w * f;
            monthlyW[m] += w;
            hitW += w * f;
            allW += w;
          }
        }
        perPanel[p.key] = allW > 0 ? hitW / allW : 0;
        done++;
        if (done % 4 === 0) {
          onProgress?.(done / total);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      out[a.array.id] = { monthly: monthlyHit.map((h, m) => (monthlyW[m] > 0 ? h / monthlyW[m] : 0)), perPanel };
    }
    onProgress?.(1);
    return out;
  }
}
