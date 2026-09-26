/**
 * Irradiação no plano dos módulos (POA) e geração mensal.
 *
 * Modelo: irradiação global horizontal mensal (HSP da localização) → fração difusa pela
 * correlação mensal de Erbs → transposição isotrópica de Liu-Jordan, com o fator de feixe Rb
 * integrado numericamente ao longo do dia médio de cada mês (vale para qualquer azimute,
 * inclinação e hemisfério).
 */

import { RAD, declination, sunFromHourAngle, sunsetHourAngle, vectorFromAngles, type Vec3 } from "./sun.ts";

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Dia médio de cada mês (Klein, 1977). */
export const REP_DAY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
export const REP_DAY_OF_MONTH = [17, 16, 16, 15, 15, 11, 17, 16, 15, 15, 14, 10];

const GSC = 1.367; // kW/m²
const STEP = 5; // passo do ângulo horário na integração (graus = 20 min)

export interface City {
  name: string;
  uf: string;
  lat: number;
  lon: number;
  hsp: number; // irradiação global horizontal média anual (kWh/m²/dia) — estimativa
}

/**
 * Capitais brasileiras com HSP médio anual aproximado (plano horizontal).
 * Valores de referência para estudo inicial — confirme no CRESESB/SunData ou NASA POWER.
 */
export const CITIES: City[] = [
  { name: "São Paulo", uf: "SP", lat: -23.55, lon: -46.63, hsp: 4.6 },
  { name: "Rio de Janeiro", uf: "RJ", lat: -22.91, lon: -43.17, hsp: 4.9 },
  { name: "Belo Horizonte", uf: "MG", lat: -19.92, lon: -43.94, hsp: 5.3 },
  { name: "Vitória", uf: "ES", lat: -20.32, lon: -40.34, hsp: 4.9 },
  { name: "Brasília", uf: "DF", lat: -15.79, lon: -47.88, hsp: 5.4 },
  { name: "Goiânia", uf: "GO", lat: -16.69, lon: -49.26, hsp: 5.4 },
  { name: "Cuiabá", uf: "MT", lat: -15.6, lon: -56.1, hsp: 5.3 },
  { name: "Campo Grande", uf: "MS", lat: -20.47, lon: -54.62, hsp: 5.2 },
  { name: "Curitiba", uf: "PR", lat: -25.43, lon: -49.27, hsp: 4.4 },
  { name: "Florianópolis", uf: "SC", lat: -27.6, lon: -48.55, hsp: 4.4 },
  { name: "Porto Alegre", uf: "RS", lat: -30.03, lon: -51.23, hsp: 4.6 },
  { name: "Salvador", uf: "BA", lat: -12.97, lon: -38.5, hsp: 5.2 },
  { name: "Aracaju", uf: "SE", lat: -10.91, lon: -37.07, hsp: 5.3 },
  { name: "Maceió", uf: "AL", lat: -9.67, lon: -35.74, hsp: 5.3 },
  { name: "Recife", uf: "PE", lat: -8.05, lon: -34.88, hsp: 5.3 },
  { name: "João Pessoa", uf: "PB", lat: -7.12, lon: -34.86, hsp: 5.4 },
  { name: "Natal", uf: "RN", lat: -5.79, lon: -35.21, hsp: 5.6 },
  { name: "Fortaleza", uf: "CE", lat: -3.73, lon: -38.52, hsp: 5.5 },
  { name: "Teresina", uf: "PI", lat: -5.09, lon: -42.8, hsp: 5.5 },
  { name: "São Luís", uf: "MA", lat: -2.53, lon: -44.3, hsp: 5.0 },
  { name: "Palmas", uf: "TO", lat: -10.18, lon: -48.33, hsp: 5.4 },
  { name: "Belém", uf: "PA", lat: -1.46, lon: -48.5, hsp: 4.8 },
  { name: "Macapá", uf: "AP", lat: 0.03, lon: -51.07, hsp: 4.9 },
  { name: "Manaus", uf: "AM", lat: -3.12, lon: -60.02, hsp: 4.6 },
  { name: "Boa Vista", uf: "RR", lat: 2.82, lon: -60.67, hsp: 5.0 },
  { name: "Porto Velho", uf: "RO", lat: -8.76, lon: -63.9, hsp: 4.6 },
  { name: "Rio Branco", uf: "AC", lat: -9.97, lon: -67.81, hsp: 4.6 },
];

/** Cidade de referência mais próxima (distância aproximada em graus). */
export function nearestCity(lat: number, lon: number): City {
  let best = CITIES[0];
  let bd = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + ((c.lon - lon) * Math.cos(lat * RAD)) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** Normal (unitária, apontando para fora/cima) de uma superfície com inclinação e azimute (graus). */
export function surfaceNormal(tilt: number, azimuth: number): Vec3 {
  return vectorFromAngles(azimuth, 90 - tilt);
}

/** Irradiação extraterrestre diária no plano horizontal (kWh/m²/dia) — dia do ano e latitude. */
export function extraterrestrialDaily(lat: number, doy: number): number {
  const d = declination(doy) * RAD;
  const phi = lat * RAD;
  const ws = sunsetHourAngle(lat, declination(doy)) * RAD;
  const E0 = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  return Math.max(0, (24 / Math.PI) * GSC * E0 * (Math.cos(phi) * Math.cos(d) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(d)));
}

/** Fração difusa mensal (Erbs, Klein e Duffie, 1982). */
export function diffuseFraction(kt: number, wsDeg: number): number {
  const k = Math.max(0.3, Math.min(0.8, kt));
  const f = wsDeg <= 81.4 ? 1.391 - 3.56 * k + 4.189 * k * k - 2.137 * k ** 3 : 1.311 - 3.022 * k + 3.427 * k * k - 1.821 * k ** 3;
  return Math.max(0.1, Math.min(0.9, f));
}

/** Instantes (ângulo horário, peso) do dia médio de um mês, para integração e sombreamento. */
export function daySamples(lat: number, month: number, step = STEP) {
  const doy = REP_DAY[month];
  const decl = declination(doy);
  const ws = sunsetHourAngle(lat, decl);
  const out: { hourAngle: number; sun: Vec3; cosZ: number }[] = [];
  for (let w = -ws + step / 2; w < ws; w += step) {
    const s = sunFromHourAngle(lat, decl, w);
    if (s.vector.y <= 0) continue;
    out.push({ hourAngle: w, sun: s.vector, cosZ: s.vector.y });
  }
  return out;
}

/** Fator de feixe médio mensal Rb para uma normal qualquer. */
export function beamFactor(lat: number, month: number, normal: Vec3): number {
  let h = 0;
  let t = 0;
  for (const s of daySamples(lat, month)) {
    h += s.cosZ;
    t += Math.max(0, normal.x * s.sun.x + normal.y * s.sun.y + normal.z * s.sun.z);
  }
  return h > 0 ? t / h : 0;
}

/**
 * Irradiação global horizontal mensal (kWh/m²/dia). Se houver série mensal (ex.: NASA POWER), usa-a;
 * senão distribui o HSP anual pelo índice de claridade constante — sazonalidade coerente com a latitude.
 */
export function monthlyGhi(lat: number, hsp: number, monthly?: number[] | null): number[] {
  if (monthly && monthly.length === 12 && monthly.every((v) => v > 0)) return monthly;
  const h0 = REP_DAY.map((d) => extraterrestrialDaily(lat, d));
  const annualH0 = h0.reduce((a, v, i) => a + v * MONTH_DAYS[i], 0) / 365;
  const kt = annualH0 > 0 ? hsp / annualH0 : 0.5;
  return h0.map((v) => v * kt);
}

export interface PoaInput {
  lat: number;
  hsp: number;
  monthlyGhi?: number[] | null;
  tilt: number; // graus
  azimuth: number; // graus a partir do Norte
  albedo?: number;
  /** Fração do feixe direto perdida por sombra, por mês (0–1). */
  beamShading?: number[];
}

export interface PoaResult {
  monthly: number[]; // kWh/m²/dia no plano
  annual: number; // média anual kWh/m²/dia (= HSP no plano)
  ghi: number[];
  beamShare: number; // fração média do feixe direto na irradiação do plano
  shadingLoss: number; // perda anual relativa por sombra (0–1)
}

export function poaIrradiation(i: PoaInput): PoaResult {
  const ghi = monthlyGhi(i.lat, i.hsp, i.monthlyGhi);
  const n = surfaceNormal(i.tilt, i.azimuth);
  const cb = Math.cos(i.tilt * RAD);
  const rho = i.albedo ?? 0.2;
  let sum = 0;
  let sumNoShade = 0;
  let beamSum = 0;
  const monthly = ghi.map((H, m) => {
    const doy = REP_DAY[m];
    const H0 = extraterrestrialDaily(i.lat, doy);
    const kt = H0 > 0 ? H / H0 : 0.5;
    const Hd = H * diffuseFraction(kt, sunsetHourAngle(i.lat, declination(doy)));
    const Hb = H - Hd;
    const beam = Hb * beamFactor(i.lat, m, n);
    const shade = Math.max(0, Math.min(1, i.beamShading?.[m] ?? 0));
    const rest = Hd * ((1 + cb) / 2) + H * rho * ((1 - cb) / 2);
    const v = beam * (1 - shade) + rest;
    sum += v * MONTH_DAYS[m];
    sumNoShade += (beam + rest) * MONTH_DAYS[m];
    beamSum += beam * MONTH_DAYS[m];
    return v;
  });
  return {
    monthly,
    annual: sum / 365,
    ghi,
    beamShare: sumNoShade > 0 ? beamSum / sumNoShade : 0,
    shadingLoss: sumNoShade > 0 ? 1 - sum / sumNoShade : 0,
  };
}

/** Busca a melhor inclinação/azimute (varredura) — referência para o “rendimento relativo”. */
export function optimalOrientation(lat: number, hsp: number, monthly?: number[] | null) {
  const az0 = lat >= 0 ? 180 : 0; // voltado para o equador
  let best = { tilt: 0, azimuth: az0, annual: 0 };
  for (let tilt = 0; tilt <= 60; tilt += 1) {
    const r = poaIrradiation({ lat, hsp, monthlyGhi: monthly, tilt, azimuth: az0 });
    if (r.annual > best.annual) best = { tilt, azimuth: az0, annual: r.annual };
  }
  return best;
}

export interface GenerationInput {
  kwp: number;
  poa: number[]; // kWh/m²/dia por mês
  performanceRatio: number; // 0–1 (perdas elétricas, temperatura, sujeira; sem sombra)
}

/** Geração mensal (kWh) = kWp × HSP no plano × dias × PR. */
export function monthlyGeneration({ kwp, poa, performanceRatio }: GenerationInput): number[] {
  return poa.map((h, m) => kwp * h * MONTH_DAYS[m] * performanceRatio);
}

/** Nome do ponto cardeal/colateral de um azimute. */
export function cardinal(az: number): string {
  const names = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return names[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}

/** Série mensal de GHI da NASA POWER (climatologia) — kWh/m²/dia. Retorna null se falhar. */
export async function fetchNasaPower(lat: number, lon: number): Promise<{ monthly: number[]; annual: number } | null> {
  try {
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const p = j?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    if (!p) return null;
    const keys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthly = keys.map((k) => Number(p[k]));
    if (monthly.some((v) => !(v > 0))) return null;
    const annual = Number(p.ANN) > 0 ? Number(p.ANN) : monthly.reduce((a, v, i) => a + v * MONTH_DAYS[i], 0) / 365;
    return { monthly, annual };
  } catch {
    return null;
  }
}
