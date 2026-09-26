/**
 * Recurso solar e modelo fotovoltaico.
 *
 * - Posição do sol: declinação de Cooper, equação do tempo de Spencer, ângulo horário.
 * - Céu limpo: Haurwitz (GHI = 1098·cosZ·e^(−0,057/cosZ)).
 * - Separação direta/difusa: Erbs et al. (1982).
 * - Plano inclinado: modelo isotrópico de Liu–Jordan + refletido pelo solo (albedo).
 * - Temperatura da célula: NOCT. Potência DC: P = Pstc·(POA/1000)·[1 + γ(Tc − 25)].
 * - Nuvens: índice de céu claro diário (logit-normal calibrado para a média mensal do local,
 *   com persistência entre dias) + flutuação intradiária AR(1) — gera dias limpos, dias
 *   nublados e passagem de nuvens (inclusive picos de "cloud enhancement").
 */
import { monthOf, midMonth, type City } from "./climate.ts";
import type { Rng } from "./rng.ts";

const RAD = Math.PI / 180;

export interface SunPos {
  cosZ: number;
  /** Elevação (graus). */
  elevation: number;
  /** Azimute (graus a partir do Norte, horário). */
  azimuth: number;
  /** Irradiância extraterrestre normal (W/m²). */
  g0n: number;
}

export function declination(doy: number) {
  return 23.45 * Math.sin(RAD * ((360 * (284 + doy)) / 365));
}

/** Equação do tempo (minutos) — Spencer (1971). */
export function equationOfTime(doy: number) {
  const b = (2 * Math.PI * (doy - 1)) / 365;
  return 229.18 * (0.000075 + 0.001868 * Math.cos(b) - 0.032077 * Math.sin(b) - 0.014615 * Math.cos(2 * b) - 0.04089 * Math.sin(2 * b));
}

/** Posição do sol para a hora do relógio local (fuso `tz`). */
export function sunPosition(doy: number, clockHour: number, lat: number, lon: number, tz: number): SunPos {
  const dec = declination(doy) * RAD;
  const solarTime = clockHour + (4 * (lon - 15 * tz) + equationOfTime(doy)) / 60;
  const w = 15 * (solarTime - 12) * RAD;
  const phi = lat * RAD;
  const cosZ = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(w);
  const elev = Math.asin(Math.max(-1, Math.min(1, cosZ)));
  const cosElev = Math.cos(elev);
  let az = 0;
  if (cosElev > 1e-6) {
    const c = (Math.sin(dec) - Math.sin(elev) * Math.sin(phi)) / (cosElev * Math.cos(phi));
    az = Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
    if (w > 0) az = 360 - az;
  }
  const g0n = 1367 * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
  return { cosZ, elevation: elev / RAD, azimuth: az, g0n };
}

/** GHI de céu limpo (Haurwitz), W/m². */
export function clearSkyGHI(cosZ: number) {
  if (cosZ <= 0.01) return 0;
  return 1098 * cosZ * Math.exp(-0.057 / cosZ);
}

/** Fração difusa de Erbs em função do índice de claridade kt. */
export function erbsDiffuseFraction(kt: number) {
  if (kt <= 0.22) return 1 - 0.09 * kt;
  if (kt <= 0.8) return 0.9511 - 0.1604 * kt + 4.388 * kt ** 2 - 16.638 * kt ** 3 + 12.336 * kt ** 4;
  return 0.165;
}

/** Irradiância no plano dos módulos (POA), W/m². */
export function planeOfArray(ghi: number, sun: SunPos, tilt: number, azimuth: number, albedo: number) {
  if (ghi <= 0 || sun.cosZ <= 0) return { poa: 0, beam: 0, diffuse: 0 };
  const g0h = sun.g0n * sun.cosZ;
  const kt = Math.min(1.2, ghi / Math.max(g0h, 1));
  const dhi = Math.min(ghi, ghi * erbsDiffuseFraction(kt));
  const cosZ = Math.max(sun.cosZ, 0.087); // evita explosão do DNI com sol rasante
  const dni = (ghi - dhi) / cosZ;
  const b = tilt * RAD;
  const zen = Math.acos(Math.min(1, sun.cosZ));
  const cosTheta = Math.cos(zen) * Math.cos(b) + Math.sin(zen) * Math.sin(b) * Math.cos((sun.azimuth - azimuth) * RAD);
  const beam = dni * Math.max(0, cosTheta);
  const diffuse = dhi * ((1 + Math.cos(b)) / 2) + ghi * albedo * ((1 - Math.cos(b)) / 2);
  return { poa: beam + diffuse, beam, diffuse };
}

/** Temperatura da célula pelo método NOCT (800 W/m², 20 °C, 1 m/s). */
export function cellTemperature(tAmb: number, poa: number, noct: number) {
  return tAmb + ((noct - 20) / 800) * poa;
}

/** Irradiação diária de céu limpo (kWh/m²·dia) para um dia do ano. */
export function clearSkyDaily(doy: number, lat: number, lon: number, tz: number) {
  let sum = 0;
  for (let m = 0; m < 24 * 12; m++) {
    const h = (m + 0.5) / 12;
    sum += clearSkyGHI(sunPosition(doy, h, lat, lon, tz).cosZ) / 12;
  }
  return sum / 1000;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
/** Quantis normais fixos para calcular a média de uma logit-normal por quadratura. */
const Z_Q = Array.from({ length: 41 }, (_, i) => -3 + (6 * i) / 40);
const W_Q = Z_Q.map((z) => Math.exp(-(z * z) / 2));
const W_SUM = W_Q.reduce((a, b) => a + b, 0);
const K_MAX = 1.02;
const SIGMA_DAY = 1.25;

function logitMean(mu: number) {
  let s = 0;
  for (let i = 0; i < Z_Q.length; i++) s += W_Q[i] * K_MAX * sigmoid(mu + SIGMA_DAY * Z_Q[i]);
  return s / W_SUM;
}

/** Encontra μ tal que a média de K_MAX·σ(μ + σz) seja `target`. */
function solveMu(target: number) {
  let lo = -8;
  let hi = 8;
  const t = Math.max(0.05, Math.min(0.99, target));
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (logitMean(mid) < t) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface WeatherModel {
  /** Chame no início de cada dia: sorteia a nebulosidade do dia. */
  newDay(doy: number): { kDay: number; tMean: number; amp: number };
  /** Índice de céu claro no passo (com flutuação de nuvens). */
  kStep(dtH: number): number;
}

/**
 * Gerador estocástico de clima calibrado para a climatologia mensal.
 * `cloudiness` = 0 → céu sempre limpo; 1 → clima típico; 2 → bem mais nublado.
 */
export function createWeather(city: City, lat: number, lon: number, tz: number, cloudiness: number, rng: Rng): WeatherModel {
  const kMonth = city.ghi.map((g, m) => {
    const clear = clearSkyDaily(midMonth(m), lat, lon, tz);
    const kc = Math.min(0.98, g / Math.max(clear, 0.1));
    return Math.max(0.1, 1 - cloudiness * (1 - kc));
  });
  const muMonth = kMonth.map(solveMu);
  let zDay = 0;
  let x = 0;
  let kDay = 0.7;
  const rho = 0.55; // persistência dia a dia (frentes, sistemas de vários dias)
  return {
    newDay(doy) {
      const m = monthOf(doy);
      zDay = rho * zDay + Math.sqrt(1 - rho * rho) * rng.normal();
      kDay = cloudiness <= 0 ? 1 : K_MAX * sigmoid(muMonth[m] + SIGMA_DAY * zDay);
      const tMean = city.temp[m] + 1.2 * (kDay - kMonth[m]) * 2;
      const amp = city.amp * (0.45 + 0.55 * kDay);
      return { kDay, tMean, amp };
    },
    kStep(dtH) {
      if (cloudiness <= 0) return 1;
      const a = Math.exp(-dtH / 0.4);
      x = a * x + Math.sqrt(1 - a * a) * rng.normal();
      const sigma = 1.3 * kDay * (1 - kDay) + 0.02;
      return Math.max(0.03, Math.min(1.25, kDay + sigma * x));
    },
  };
}

/** Temperatura do ar ao longo do dia (mínima ~6h, máxima ~15h). */
export function airTemperature(hour: number, tMean: number, amp: number) {
  return tMean + (amp / 2) * Math.cos((2 * Math.PI * (hour - 15)) / 24);
}

/** Eficiência do inversor em função da carga (curva típica com perdas fixas, lineares e quadráticas). */
export function inverterEfficiency(pDcKW: number, acKW: number, etaMax: number) {
  if (pDcKW <= 0 || acKW <= 0) return 0;
  const x = pDcKW / acKW;
  const loss = 1 - etaMax;
  // perdas: 18% fixas (autoconsumo), 45% proporcionais, 37% quadráticas — calibradas para η_max ~ 50–100% de carga
  const p0 = 0.18 * loss * 0.6;
  const k1 = 0.45 * loss;
  const k2 = 0.37 * loss * 0.8;
  const lossPU = p0 + k1 * x + k2 * x * x;
  return Math.max(0, (x - lossPU) / x);
}
