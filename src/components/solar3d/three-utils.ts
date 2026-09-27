import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/** Rótulo HTML preso a um ponto 3D. */
export function label(text: string, cls = "s3d-label"): CSS2DObject {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.center.set(0.5, 0.5);
  return o;
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    // materiais compartilhados (userData.keep) ficam vivos para não recompilar shaders a cada reconstrução
    if (Array.isArray(mat)) mat.forEach((x) => !x.userData.keep && x.dispose());
    else if (mat && !mat.userData.keep) mat.dispose();
    if (o instanceof CSS2DObject) o.element.remove();
  });
}

/** Marca materiais compartilhados para não serem descartados junto com os objetos. */
export function keep<T extends Record<string, THREE.Material>>(mats: T): T {
  for (const m of Object.values(mats)) m.userData.keep = true;
  return mats;
}

export function clearGroup(g: THREE.Group) {
  for (const c of [...g.children]) {
    g.remove(c);
    disposeObject(c);
  }
}

const texCache = new Map<string, THREE.Texture>();

export function canvasTexture(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true) {
  const cached = texCache.get(key);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

/** Texturas de cobertura. A escala (m por repetição) volta junto. */
export function roofTexture(kind: string): { map: THREE.Texture; scale: [number, number]; color: string } {
  if (kind === "fibrocimento")
    return {
      scale: [0.18, 1.2],
      color: "#c9c8c2",
      map: canvasTexture("fibro", 64, 128, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "#8e8d87");
        g.addColorStop(0.5, "#e6e5df");
        g.addColorStop(1, "#8e8d87");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(0,0,0,.18)";
        c.fillRect(0, h - 3, w, 3);
      }),
    };
  if (kind === "metalico")
    return {
      scale: [0.25, 2],
      color: "#b8c4cf",
      map: canvasTexture("metal", 64, 64, (c, w, h) => {
        c.fillStyle = "#9fb0bf";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#e3eaf0";
        c.fillRect(w * 0.3, 0, w * 0.4, h);
        c.fillStyle = "#7b8c9b";
        c.fillRect(w * 0.26, 0, 3, h);
        c.fillRect(w * 0.72, 0, 3, h);
      }),
    };
  if (kind === "colonial")
    return {
      scale: [0.16, 0.4],
      color: "#c46a3c",
      map: canvasTexture("colonial", 64, 96, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "#7d3419");
        g.addColorStop(0.5, "#d8804f");
        g.addColorStop(1, "#7d3419");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(60,20,5,.5)";
        c.fillRect(0, h - 8, w, 8);
        c.fillStyle = "rgba(255,210,170,.12)";
        c.fillRect(0, 0, w, 10);
      }),
    };
  if (kind === "laje")
    return {
      scale: [1, 1],
      color: "#b9b7b0",
      map: canvasTexture("laje", 128, 128, (c, w, h) => {
        c.fillStyle = "#bdbbb4";
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          c.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
          c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
      }),
    };
  return {
    scale: [1.5, 1.5],
    color: "#b8a98a",
    map: canvasTexture("brita", 128, 128, (c, w, h) => {
      c.fillStyle = "#a89f8c";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const v = 120 + Math.random() * 90;
        c.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
        c.beginPath();
        c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2);
        c.fill();
      }
    }),
  };
}

export function grassTexture() {
  return canvasTexture("grama", 256, 256, (c, w, h) => {
    c.fillStyle = "#7fa36a";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const g = 120 + Math.random() * 60;
      c.fillStyle = `rgba(${g - 50},${g},${g - 70},.5)`;
      c.fillRect(Math.random() * w, Math.random() * h, 1, 3);
    }
  });
}

export function wallTexture() {
  return canvasTexture("parede", 256, 256, (c, w, h) => {
    c.fillStyle = "#efebe3";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      c.fillStyle = `rgba(90,80,60,${Math.random() * 0.05})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

/** Face das células do módulo (retrato: largura × comprimento). */
export function moduleTexture(landscape: boolean) {
  return canvasTexture(
    `modulo-${landscape}`,
    landscape ? 512 : 256,
    landscape ? 256 : 512,
    (c, w, h) => {
      c.fillStyle = "#c9cfd6";
      c.fillRect(0, 0, w, h);
      const f = 6;
      c.fillStyle = "#0f1f3d";
      c.fillRect(f, f, w - 2 * f, h - 2 * f);
      const cols = landscape ? 12 : 6;
      const rows = landscape ? 6 : 12;
      const cw = (w - 2 * f) / cols;
      const ch = (h - 2 * f) / rows;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const x = f + i * cw + 1.5;
          const y = f + j * ch + 1.5;
          const g = c.createLinearGradient(x, y, x + cw, y + ch);
          g.addColorStop(0, "#1b3a6e");
          g.addColorStop(1, "#122a55");
          c.fillStyle = g;
          c.fillRect(x, y, cw - 3, ch - 3);
          c.fillStyle = "rgba(200,215,240,.25)";
          if (landscape) for (let k = 1; k < 4; k++) c.fillRect(x, y + (k * (ch - 3)) / 4, cw - 3, 0.8);
          else for (let k = 1; k < 4; k++) c.fillRect(x + (k * (cw - 3)) / 4, y, 0.8, ch - 3);
        }
      // divisão half-cell
      c.fillStyle = "#c9cfd6";
      if (landscape) c.fillRect(w / 2 - 1, f, 2, h - 2 * f);
      else c.fillRect(f, h / 2 - 1, w - 2 * f, 2);
    },
    false,
  );
}

/** Textura com texto (placas de identificação, frente dos disjuntores). */
export function textTexture(lines: { text: string; size: number; color?: string; weight?: string }[], bg: string, w = 256, h = 256, key?: string) {
  const k = key ?? `txt-${bg}-${w}-${h}-${lines.map((l) => l.text + l.size).join("|")}`;
  return canvasTexture(
    k,
    w,
    h,
    (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      const total = lines.reduce((a, l) => a + l.size * 1.25, 0);
      let y = (h - total) / 2;
      c.textAlign = "center";
      c.textBaseline = "top";
      for (const l of lines) {
        c.fillStyle = l.color ?? "#111";
        c.font = `${l.weight ?? "700"} ${l.size}px system-ui, sans-serif`;
        c.fillText(l.text, w / 2, y);
        y += l.size * 1.25;
      }
    },
    false,
  );
}

/** Caixa orientada por uma base (x, y, z) e centro. */
export function orientedBox(size: [number, number, number], center: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3, mat: THREE.Material | THREE.Material[]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  const basis = new THREE.Matrix4().makeBasis(x, y, z);
  m.quaternion.setFromRotationMatrix(basis);
  m.position.copy(center);
  return m;
}

/** Barra (cilindro/caixa) entre dois pontos. */
export function beam(a: THREE.Vector3, b: THREE.Vector3, thickness: number, mat: THREE.Material, round = false) {
  const d = new THREE.Vector3().subVectors(b, a);
  const l = d.length();
  const geo = round ? new THREE.CylinderGeometry(thickness / 2, thickness / 2, l, 12) : new THREE.BoxGeometry(thickness, l, thickness);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/** Tubo suave passando por pontos (cabos). */
export function cableTube(points: THREE.Vector3[], radius: number, color: string, tension = 0.1) {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", tension);
  const geo = new THREE.TubeGeometry(curve, Math.max(8, points.length * 10), radius, 8, false);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
}

/** Tubo com cantos vivos (eletroduto) formado por trechos retos. */
export function polyTube(points: THREE.Vector3[], radius: number, mat: THREE.Material) {
  const g = new THREE.Group();
  for (let i = 1; i < points.length; i++) g.add(beam(points[i - 1], points[i], radius * 2, mat, true));
  for (let i = 1; i < points.length - 1; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat);
    s.position.copy(points[i]);
    g.add(s);
  }
  return g;
}

export const LABEL_CSS = `
.s3d-label{font:600 11px/1.2 system-ui,sans-serif;color:#1c1234;background:rgba(255,255,255,.92);padding:3px 7px;border-radius:8px;box-shadow:0 2px 8px rgba(28,18,52,.18);white-space:nowrap;pointer-events:none;transform:translateY(-2px)}
.s3d-dim{font:700 11px/1 system-ui,sans-serif;color:#fff;background:#1c1234;padding:4px 7px;border-radius:7px;white-space:nowrap;pointer-events:none}
.s3d-compass{font:800 14px/1 system-ui,sans-serif;color:#1c1234;background:rgba(255,255,255,.85);width:24px;height:24px;display:grid;place-items:center;border-radius:999px;pointer-events:none}
.s3d-compass.n{background:#e11d48;color:#fff}
.s3d-hour{font:600 10px/1 system-ui,sans-serif;color:#7a5a00;background:rgba(255,241,190,.92);padding:2px 5px;border-radius:6px;pointer-events:none}
.s3d-tag{font:700 10px/1.25 system-ui,sans-serif;color:#1c1234;background:#f3ea3b;padding:3px 6px;border-radius:6px;white-space:nowrap;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.s3d-cable{font:600 10.5px/1.3 system-ui,sans-serif;color:#fff;background:rgba(28,18,52,.9);padding:4px 7px;border-radius:7px;white-space:nowrap;pointer-events:none}
`;
