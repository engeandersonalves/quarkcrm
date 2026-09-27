/**
 * Foto de drone como base do projeto: leitura de EXIF/XMP (GPS, altura, lente, rumo),
 * escala no chão e ajuste de um retângulo aos cantos clicados do telhado.
 */

export interface DroneMeta {
  lat: number | null;
  lon: number | null;
  relAltitude: number | null; // m acima do ponto de decolagem (XMP DJI)
  focal35: number | null; // distância focal equivalente 35 mm
  yaw: number | null; // rumo da câmera (graus, 0 = norte, horário)
  gimbalPitch: number | null; // −90 = câmera apontada para baixo
  make: string | null;
  model: string | null;
}

function ascii(view: DataView, off: number, len: number) {
  let s = "";
  for (let i = 0; i < len && off + i < view.byteLength; i++) {
    const c = view.getUint8(off + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Lê metadados de um JPEG (EXIF + XMP do DJI). Campos ausentes ficam nulos. */
export function parseDroneMeta(buf: ArrayBuffer): DroneMeta {
  const meta: DroneMeta = { lat: null, lon: null, relAltitude: null, focal35: null, yaw: null, gimbalPitch: null, make: null, model: null };
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return meta;
  let off = 2;
  while (off + 4 < view.byteLength) {
    const marker = view.getUint16(off);
    const size = view.getUint16(off + 2);
    if ((marker & 0xff00) !== 0xff00 || size < 2) break;
    if (marker === 0xffe1 && ascii(view, off + 4, 4) === "Exif") readExif(view, off + 10, meta);
    if (marker === 0xffe1) {
      const text = ascii(view, off + 4, Math.min(size, 65000));
      if (text.startsWith("http://ns.adobe.com/xap")) readXmp(new TextDecoder().decode(new Uint8Array(buf, off + 4, size - 2)), meta);
    }
    if (marker === 0xffda) break; // início da imagem
    off += 2 + size;
  }
  return meta;
}

function readExif(view: DataView, tiff: number, meta: DroneMeta) {
  const le = view.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  const rational = (o: number) => {
    const d = u32(o + 4);
    return d ? u32(o) / d : 0;
  };
  const entries = (ifd: number) => {
    const out = new Map<number, { type: number; count: number; valueOff: number }>();
    if (ifd <= 0 || tiff + ifd + 2 > view.byteLength) return out;
    const n = u16(tiff + ifd);
    for (let i = 0; i < n; i++) {
      const e = tiff + ifd + 2 + i * 12;
      if (e + 12 > view.byteLength) break;
      const type = u16(e + 2);
      const count = u32(e + 4);
      const bytes = count * ([0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] ?? 1);
      out.set(u16(e), { type, count, valueOff: bytes > 4 ? tiff + u32(e + 8) : e + 8 });
    }
    return out;
  };
  const ifd0 = entries(u32(tiff + 4));
  const str = (t?: { count: number; valueOff: number }) => (t ? ascii(view, t.valueOff, t.count).trim() : null);
  meta.make = str(ifd0.get(0x010f));
  meta.model = str(ifd0.get(0x0110));
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr) {
    const ex = entries(u32(exifPtr.valueOff));
    const f35 = ex.get(0xa405);
    if (f35) meta.focal35 = u16(f35.valueOff) || null;
  }
  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const gps = entries(u32(gpsPtr.valueOff));
    const dms = (t?: { valueOff: number }) => (t ? rational(t.valueOff) + rational(t.valueOff + 8) / 60 + rational(t.valueOff + 16) / 3600 : null);
    const lat = dms(gps.get(2));
    const lon = dms(gps.get(4));
    const latRef = gps.get(1) ? ascii(view, gps.get(1)!.valueOff, 1) : "N";
    const lonRef = gps.get(3) ? ascii(view, gps.get(3)!.valueOff, 1) : "E";
    if (lat !== null && lon !== null && (lat !== 0 || lon !== 0)) {
      meta.lat = latRef === "S" ? -lat : lat;
      meta.lon = lonRef === "W" ? -lon : lon;
    }
  }
}

function readXmp(xmp: string, meta: DroneMeta) {
  const num = (name: string) => {
    const m = xmp.match(new RegExp(`${name}\\s*=\\s*"([+-]?[\\d.]+)"`)) ?? xmp.match(new RegExp(`<[^>]*${name}>([+-]?[\\d.]+)<`));
    return m ? Number(m[1]) : null;
  };
  meta.relAltitude = num("RelativeAltitude") ?? meta.relAltitude;
  meta.yaw = num("GimbalYawDegree") ?? num("FlightYawDegree") ?? meta.yaw;
  meta.gimbalPitch = num("GimbalPitchDegree") ?? meta.gimbalPitch;
}

/** Campo de visão horizontal (graus) a partir da focal equivalente 35 mm (lado maior de 36 mm). */
export function hfovFrom35(f35: number) {
  return (2 * Math.atan(36 / (2 * f35)) * 180) / Math.PI;
}

/** Largura no chão (m) coberta pelo lado maior da foto, câmera apontada para baixo. */
export function groundWidth(altitude: number, hfovDeg: number) {
  return 2 * altitude * Math.tan((hfovDeg * Math.PI) / 360);
}

/**
 * Ajusta um retângulo a 4 cantos clicados (no chão, x/z da cena): o lado 1→2 define o
 * comprimento e a direção; a largura é a distância média dos pontos 3 e 4 até essa linha.
 * Retorna centro, medidas e a rotação no mesmo sentido usado pelas edificações.
 */
export function fitRectangle(pts: { x: number; z: number }[]) {
  const [a, b] = pts;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  const ux = dx / (length || 1);
  const uz = dz / (length || 1);
  const dist = (p: { x: number; z: number }) => Math.abs((p.x - a.x) * -uz + (p.z - a.z) * ux);
  const rest = pts.slice(2);
  const width = rest.length ? rest.reduce((s, p) => s + dist(p), 0) / rest.length : 0;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  // eixo local X da edificação = (cos r, −sin r) no plano x/z
  const rotation = (Math.atan2(-dz, dx) * 180) / Math.PI;
  return { x: cx, z: cz, length, width, rotation };
}

/** Reduz a foto para caber no armazenamento do navegador (lado maior ≤ max px). */
export async function downscaleImage(file: Blob, max = 2048): Promise<{ dataUrl: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * k);
  cv.height = Math.round(bmp.height * k);
  cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
  return { dataUrl: cv.toDataURL("image/jpeg", 0.82), width: bmp.width, height: bmp.height };
}
