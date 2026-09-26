/**
 * Posição do sol e geometria solar.
 *
 * Convenções do Projeto 3D (iguais às da cena):
 *   +X = Leste, −Z = Norte, +Y = para cima.
 *   Azimute medido a partir do Norte, no sentido horário (0 = N, 90 = L, 180 = S, 270 = O).
 */

export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SunPosition {
  azimuth: number; // graus, a partir do Norte (horário)
  elevation: number; // graus acima do horizonte
  vector: Vec3; // unitário, apontando do chão para o sol
}

const norm360 = (v: number) => ((v % 360) + 360) % 360;

/** Vetor unitário na cena a partir de azimute/elevação (graus). */
export function vectorFromAngles(azimuth: number, elevation: number): Vec3 {
  const a = azimuth * RAD;
  const e = elevation * RAD;
  return { x: Math.cos(e) * Math.sin(a), y: Math.sin(e), z: -Math.cos(e) * Math.cos(a) };
}

/** Azimute (graus, a partir do Norte) da componente horizontal de um vetor. */
export function azimuthOf(v: Vec3): number {
  return norm360(Math.atan2(v.x, -v.z) * DEG);
}

/** Azimute/elevação a partir da latitude, declinação e ângulo horário (todos em graus). */
export function sunFromHourAngle(lat: number, declination: number, hourAngle: number): SunPosition {
  const phi = lat * RAD;
  const d = declination * RAD;
  const h = hourAngle * RAD;
  const sinEl = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) * DEG;
  const azimuth = norm360(Math.atan2(-Math.sin(h) * Math.cos(d), Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.cos(h) * Math.sin(phi)) * DEG);
  return { azimuth, elevation, vector: vectorFromAngles(azimuth, elevation) };
}

/**
 * Posição do sol num instante (UTC) — algoritmo do Almanaque Náutico simplificado
 * (erro < 0,1° entre 1950 e 2050, suficiente para sombreamento).
 */
export function sunPosition(date: Date, lat: number, lon: number): SunPosition {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) * DEG;
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const lst = gmst + lon / 15;
  const hourAngle = norm360(lst * 15 - ra + 180) - 180;
  return sunFromHourAngle(lat, dec, hourAngle);
}

/** Dia do ano (1–365) de uma data local (ano/mês/dia). */
export function dayOfYear(month: number, day: number): number {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return cum[Math.max(0, Math.min(11, month - 1))] + day;
}

/** Declinação solar (Cooper), graus. */
export function declination(doy: number): number {
  return 23.45 * Math.sin((360 * (284 + doy)) / 365 * RAD);
}

/** Ângulo horário do nascer/pôr do sol (graus, positivo). */
export function sunsetHourAngle(lat: number, decl: number): number {
  const c = -Math.tan(lat * RAD) * Math.tan(decl * RAD);
  if (c <= -1) return 180; // sol da meia-noite
  if (c >= 1) return 0; // noite polar
  return Math.acos(c) * DEG;
}

/** Fuso padrão estimado (horas em relação ao UTC). No Brasil, usa as faixas oficiais aproximadas. */
export function guessTimezone(lat: number, lon: number): number {
  const inBrazil = lat < 6 && lat > -34 && lon > -75 && lon < -28;
  if (inBrazil) {
    if (lat < -24.1) return -3; // Sul
    if (lon < -66.8 && lat > -11.5) return -5; // Acre e oeste do Amazonas
    if (lon < -53 && !(lat > -7.5 && lon > -56.5)) return lat < -22.5 && lon > -54.6 ? -3 : -4; // AM, RR, RO, MT, MS
    return -3;
  }
  return Math.round(lon / 15);
}

/** Converte data/hora local (fuso em horas) para Date UTC. */
export function localToUtc(year: number, month: number, day: number, hour: number, tz: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + (hour - tz) * 3600000);
}

/** Trajetória do sol num dia (pontos acima do horizonte), passo em minutos. */
export function sunPath(lat: number, lon: number, tz: number, year: number, month: number, day: number, stepMin = 10) {
  const pts: { hour: number; pos: SunPosition }[] = [];
  for (let m = 0; m <= 24 * 60; m += stepMin) {
    const hour = m / 60;
    const pos = sunPosition(localToUtc(year, month, day, hour, tz), lat, lon);
    if (pos.elevation > -0.5) pts.push({ hour, pos });
  }
  return pts;
}

/** Nascer e pôr do sol (hora local decimal), por busca no dia. */
export function sunriseSunset(lat: number, lon: number, tz: number, year: number, month: number, day: number) {
  const path = sunPath(lat, lon, tz, year, month, day, 2);
  if (!path.length) return null;
  const noon = path.reduce((a, b) => (b.pos.elevation > a.pos.elevation ? b : a));
  return { sunrise: path[0].hour, sunset: path[path.length - 1].hour, solarNoon: noon.hour, maxElevation: noon.pos.elevation };
}

export const fmtHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(mm === 60 ? hh + 1 : hh).padStart(2, "0")}:${String(mm === 60 ? 0 : mm).padStart(2, "0")}`;
};
