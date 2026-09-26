/**
 * Dimensionamento elétrico (referência NBR 5410, NBR 16690, NBR 17019 e REN 1000).
 * Ferramenta de estudo/pré-projeto — o projeto executivo exige responsável técnico (ART/TRT).
 */

/* ------------------------------------------------------------------ rede */

export type System = "mono" | "bi" | "tri";
export type Connection = "fn" | "ff" | "3f"; // fase-neutro, fase-fase, trifásico
export type Earthing = "TN-S" | "TN-C-S" | "TT";

export interface Grid {
  system: System;
  vFN: 127 | 220;
  mainBreaker: number; // disjuntor geral do padrão de entrada (A)
  earthing: Earthing;
}

export const vFF = (g: Pick<Grid, "vFN">) => (g.vFN === 127 ? 220 : 380);
export const SYSTEM_LABEL: Record<System, string> = { mono: "Monofásico (F+N)", bi: "Bifásico (2F+N)", tri: "Trifásico (3F+N)" };
export const CONNECTION_LABEL: Record<Connection, string> = { fn: "Fase + neutro", ff: "Fase + fase", "3f": "Trifásico" };

export function connectionVoltage(c: Connection, g: Pick<Grid, "vFN">): number {
  return c === "fn" ? g.vFN : vFF(g);
}
export const phasesOf = (c: Connection) => (c === "3f" ? 3 : c === "ff" ? 2 : 1);
export const polesOf = (c: Connection) => (c === "3f" ? 3 : c === "ff" ? 2 : 1);
/** Condutores carregados (para a tabela de capacidade de condução). */
export const loadedConductors = (c: Connection) => (c === "3f" ? 3 : 2);

/** Ligações possíveis numa rede (não dá para ligar trifásico numa entrada bifásica etc.). */
export function allowedConnections(s: System): Connection[] {
  return s === "mono" ? ["fn"] : s === "bi" ? ["fn", "ff"] : ["fn", "ff", "3f"];
}

/** Potência disponibilizada pelo padrão de entrada (kW, fator de potência 1). */
export function availablePowerKw(g: Grid): number {
  const In = g.mainBreaker;
  if (g.system === "mono") return (g.vFN * In) / 1000;
  if (g.system === "bi") return (2 * g.vFN * In) / 1000;
  return (Math.sqrt(3) * vFF(g) * In) / 1000;
}

/** Corrente de projeto (A). */
export function designCurrent(powerW: number, c: Connection, g: Pick<Grid, "vFN">): number {
  const V = connectionVoltage(c, g);
  return c === "3f" ? powerW / (Math.sqrt(3) * V) : powerW / V;
}

/* ------------------------------------------------------------------ tabelas */

export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

/** NBR 5410 Tab. 36 — cobre, PVC 70 °C, 30 °C ambiente. [2 carregados, 3 carregados] */
const AMPACITY: Record<"B1" | "C", Record<number, [number, number]>> = {
  B1: { 1.5: [17.5, 15.5], 2.5: [24, 21], 4: [32, 28], 6: [41, 36], 10: [57, 50], 16: [76, 68], 25: [101, 89], 35: [125, 110], 50: [151, 134], 70: [192, 171], 95: [232, 207], 120: [269, 239] },
  C: { 1.5: [19.5, 17.5], 2.5: [27, 24], 4: [36, 32], 6: [46, 41], 10: [63, 57], 16: [85, 76], 25: [112, 96], 35: [138, 119], 50: [168, 144], 70: [213, 184], 95: [258, 223], 120: [299, 259] },
};
export const METHOD_LABEL = { B1: "B1 — eletroduto aparente sobre parede", C: "C — cabo fixado direto na parede" };

/** NBR 5410 Tab. 40 — fator de temperatura (PVC). */
export function temperatureFactor(ambient: number): number {
  const t: [number, number][] = [[10, 1.22], [15, 1.17], [20, 1.12], [25, 1.06], [30, 1], [35, 0.94], [40, 0.87], [45, 0.79], [50, 0.71], [55, 0.61], [60, 0.5]];
  if (ambient <= 10) return 1.22;
  for (let i = 1; i < t.length; i++) if (ambient <= t[i][0]) {
    const [t0, f0] = t[i - 1];
    const [t1, f1] = t[i];
    return f0 + ((f1 - f0) * (ambient - t0)) / (t1 - t0);
  }
  return 0.5;
}

/** NBR 5410 Tab. 42 — agrupamento de circuitos no mesmo eletroduto. */
export function groupingFactor(circuits: number): number {
  const f = [1, 1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5, 0.5, 0.5, 0.45];
  return f[Math.max(1, Math.min(12, Math.round(circuits)))] ?? 0.45;
}

export const BREAKERS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 70, 80, 90, 100, 125, 160, 200, 225, 250];
export const nextBreaker = (i: number) => BREAKERS.find((b) => b >= i - 1e-9) ?? BREAKERS[BREAKERS.length - 1];

/** Diâmetro externo aproximado (mm) — cabo flexível 450/750 V. */
const CABLE_OD: Record<number, number> = { 1.5: 3.0, 2.5: 3.7, 4: 4.3, 6: 5.0, 10: 6.3, 16: 7.6, 25: 9.5, 35: 10.9, 50: 12.8, 70: 14.7, 95: 17.1, 120: 19.1 };
/** Cabo solar (CC) 1,8 kV — duplo isolamento. */
const SOLAR_OD: Record<number, number> = { 4: 5.6, 6: 6.2, 10: 7.4, 16: 8.8 };
export const cableOD = (s: number, solar = false) => (solar ? SOLAR_OD[s] ?? 6 : CABLE_OD[s] ?? Math.sqrt(s) * 1.9);

/** Eletroduto de PVC rígido roscável — diâmetro interno aproximado (mm). */
export const CONDUITS = [
  { label: '1/2"', dn: 20, id: 15.8 },
  { label: '3/4"', dn: 25, id: 20.8 },
  { label: '1"', dn: 32, id: 26.6 },
  { label: '1 1/4"', dn: 40, id: 35 },
  { label: '1 1/2"', dn: 50, id: 40.8 },
  { label: '2"', dn: 60, id: 52.2 },
  { label: '2 1/2"', dn: 75, id: 67 },
  { label: '3"', dn: 85, id: 78.8 },
];

/** NBR 5410 6.2.11.1.6 — taxa máxima de ocupação: 53% (1 cabo), 31% (2), 40% (3 ou mais). */
export function conduitFor(cables: { section: number; solar?: boolean }[], minLabel = '3/4"') {
  const area = cables.reduce((a, c) => a + (Math.PI * cableOD(c.section, c.solar) ** 2) / 4, 0);
  const fill = cables.length === 1 ? 0.53 : cables.length === 2 ? 0.31 : 0.4;
  const minIdx = Math.max(0, CONDUITS.findIndex((c) => c.label === minLabel));
  for (let i = minIdx; i < CONDUITS.length; i++) {
    const inner = (Math.PI * CONDUITS[i].id ** 2) / 4;
    if (area <= inner * fill) return { ...CONDUITS[i], occupancy: area / inner, limit: fill };
  }
  const last = CONDUITS[CONDUITS.length - 1];
  return { ...last, occupancy: area / ((Math.PI * last.id ** 2) / 4), limit: fill };
}

/** NBR 5410 Tab. 58 — seção do condutor de proteção. */
export function peSection(s: number): number {
  if (s <= 16) return s;
  if (s <= 35) return 16;
  return SECTIONS.find((x) => x >= s / 2) ?? s / 2;
}

export const RHO_CU = 0.0206; // Ω·mm²/m a ~70 °C

export function voltageDropPct(current: number, length: number, section: number, c: Connection, g: Pick<Grid, "vFN">): number {
  const k = c === "3f" ? Math.sqrt(3) : 2;
  return (100 * k * RHO_CU * length * current) / section / connectionVoltage(c, g);
}

/* ------------------------------------------------------------------ circuitos */

export type CircuitKind = "inversor" | "ve" | "chuveiro" | "ar" | "tomadas" | "iluminacao" | "outro";
export const CIRCUIT_KIND: Record<CircuitKind, { label: string; continuous: boolean; minSection: number; curve: "B" | "C" | "D"; maxDrop: number }> = {
  inversor: { label: "Saída CA do inversor", continuous: true, minSection: 2.5, curve: "C", maxDrop: 2 },
  ve: { label: "Carregador de veículo elétrico", continuous: true, minSection: 2.5, curve: "C", maxDrop: 4 },
  chuveiro: { label: "Chuveiro / aquecedor", continuous: true, minSection: 2.5, curve: "C", maxDrop: 4 },
  ar: { label: "Ar-condicionado", continuous: false, minSection: 2.5, curve: "C", maxDrop: 4 },
  tomadas: { label: "Tomadas de uso geral", continuous: false, minSection: 2.5, curve: "C", maxDrop: 4 },
  iluminacao: { label: "Iluminação", continuous: false, minSection: 1.5, curve: "B", maxDrop: 4 },
  outro: { label: "Outro", continuous: false, minSection: 2.5, curve: "C", maxDrop: 4 },
};

export interface CircuitInput {
  kind: CircuitKind;
  powerW: number;
  current?: number; // corrente nominal do equipamento (sobrepõe P/V)
  connection: Connection;
  length: number; // m
  method: "B1" | "C";
  ambient: number; // °C
  grouped: number; // circuitos no mesmo eletroduto
  maxDrop?: number; // %
  forceSection?: number; // bitola escolhida manualmente
  forceBreaker?: number;
}

export interface CircuitSizing {
  ib: number; // corrente de projeto
  ibDesign: number; // com fator de carga contínua
  breaker: number;
  poles: number;
  curve: "B" | "C" | "D";
  section: number;
  pe: number;
  neutral: boolean;
  iz: number; // capacidade corrigida
  drop: number; // %
  maxDrop: number;
  voltage: number;
  conduit: ReturnType<typeof conduitFor>;
  cableSpec: string; // ex.: "2 × 6 mm² + T 6 mm²"
  ok: boolean;
  warnings: string[];
  reasons: string[]; // por que essa bitola
}

export function sizeCircuit(c: CircuitInput, g: Pick<Grid, "vFN">): CircuitSizing {
  const kind = CIRCUIT_KIND[c.kind];
  const voltage = connectionVoltage(c.connection, g);
  const ib = c.current && c.current > 0 ? c.current : designCurrent(c.powerW, c.connection, g);
  const ibDesign = ib * (kind.continuous ? 1.25 : 1);
  const breaker = c.forceBreaker && c.forceBreaker > 0 ? c.forceBreaker : nextBreaker(ibDesign);
  const nLoaded = loadedConductors(c.connection) === 3 ? 1 : 0;
  const fct = temperatureFactor(c.ambient);
  const fca = groupingFactor(c.grouped);
  const maxDrop = c.maxDrop ?? kind.maxDrop;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const izOf = (s: number) => AMPACITY[c.method][s][nLoaded] * fct * fca;

  let section = SECTIONS[SECTIONS.length - 1];
  if (c.forceSection && c.forceSection > 0) section = c.forceSection;
  else {
    for (const s of SECTIONS) {
      if (s < kind.minSection) continue;
      if (izOf(s) < breaker) continue;
      if (voltageDropPct(ib, c.length, s, c.connection, g) > maxDrop) continue;
      section = s;
      break;
    }
  }
  const byAmp = SECTIONS.find((s) => s >= kind.minSection && izOf(s) >= breaker) ?? section;
  reasons.push(`Capacidade: ${fmt(byAmp)} mm² suporta ${fmt(izOf(byAmp))} A ≥ disjuntor ${breaker} A (FCT ${fct.toFixed(2)} × FCA ${fca.toFixed(2)})`);
  if (section > byAmp) reasons.push(`Queda de tensão: subiu para ${fmt(section)} mm² para ficar ≤ ${fmt(maxDrop)}% em ${fmt(c.length)} m`);
  if (section === kind.minSection && byAmp <= kind.minSection) reasons.push(`Seção mínima da NBR 5410 para ${kind.label.toLowerCase()}: ${fmt(kind.minSection)} mm²`);

  const iz = izOf(section);
  const drop = voltageDropPct(ib, c.length, section, c.connection, g);
  const pe = peSection(section);
  const neutral = c.connection === "fn" || (c.connection === "3f" && c.kind !== "inversor");
  const phases = phasesOf(c.connection);
  const conductors = phases + (neutral ? 1 : 0);
  const conduit = conduitFor([...Array(conductors).fill({ section }), { section: pe }]);
  if (!(ib <= breaker)) warnings.push(`Disjuntor de ${breaker} A menor que a corrente de projeto (${fmt(ib)} A).`);
  if (breaker > iz + 1e-9) warnings.push(`Disjuntor de ${breaker} A maior que a capacidade do cabo (${fmt(iz)} A): cabo não protegido.`);
  if (drop > maxDrop) warnings.push(`Queda de tensão de ${fmt(drop)}% acima do limite de ${fmt(maxDrop)}%.`);
  if (c.kind === "inversor" && drop > 1.5) warnings.push("Queda alta na saída do inversor pode causar desligamento por sobretensão da rede.");
  return {
    ib,
    ibDesign,
    breaker,
    poles: polesOf(c.connection),
    curve: kind.curve,
    section,
    pe,
    neutral,
    iz,
    drop,
    maxDrop,
    voltage,
    conduit,
    cableSpec: `${phases} × ${fmt(section)} mm²${neutral ? ` + N ${fmt(section)} mm²` : ""} + T ${fmt(pe)} mm²`,
    ok: warnings.length === 0,
    warnings,
    reasons,
  };
}

export const fmt = (v: number, d = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(d).replace(".", ","));

/* ------------------------------------------------------------------ proteção */

/** DPS classe II do lado CA. */
export function acSurge(g: Grid) {
  const uc = g.vFN === 127 ? 275 : g.earthing === "TT" ? 385 : 320;
  const phases = g.system === "mono" ? 1 : g.system === "bi" ? 2 : 3;
  return {
    uc,
    inKa: 20,
    imaxKa: 40,
    count: phases + 1,
    text: `${phases} DPS fase-terra + 1 DPS neutro-terra, classe II, Uc ≥ ${uc} V, In 20 kA / Imáx 40 kA`,
    topology: g.earthing === "TT" ? `${phases}+1 (neutro para terra por centelhador N-PE)` : `${phases + 1} × DPS fase/neutro → barramento de terra`,
  };
}

/** DPS classe II do lado CC (por MPPT/entrada), conforme tensão máxima da string. */
export function dcSurge(stringVocMax: number) {
  const need = stringVocMax * 1.2;
  const ucpv = [600, 1000, 1100, 1500].find((v) => v >= need) ?? 1500;
  return { ucpv, text: `DPS CC classe II, Ucpv ≥ ${ucpv} Vcc, In 20 kA (um por MPPT, polo + e −)` };
}

/** DR para o carregador de VE (NBR 17019). */
export function evResidual(c: Connection, rdcdd: boolean, breaker: number) {
  const poles = c === "3f" ? 4 : 2;
  const rating = [25, 40, 63, 80, 100].find((r) => r >= breaker) ?? 100;
  return {
    type: rdcdd ? "A" : "B",
    sens: 30,
    poles,
    rating,
    text: rdcdd
      ? `DR ${poles}P ${rating} A 30 mA tipo A — o carregador já detecta fuga CC de 6 mA (RDC-DD).`
      : `DR ${poles}P ${rating} A 30 mA tipo B — o carregador não tem detecção de 6 mA CC.`,
  };
}

/** Espaços reserva no quadro (NBR 5410 6.5.4.7). */
export function reserveSpaces(circuits: number): number {
  if (circuits <= 6) return 2;
  if (circuits <= 12) return 3;
  if (circuits <= 30) return 4;
  return Math.ceil(circuits * 0.15);
}

export const BOARD_SIZES = [
  { modules: 12, rows: 1, perRow: 12 },
  { modules: 18, rows: 1, perRow: 18 },
  { modules: 24, rows: 2, perRow: 12 },
  { modules: 36, rows: 2, perRow: 18 },
  { modules: 54, rows: 3, perRow: 18 },
];
export const boardSize = (modules: number) => BOARD_SIZES.find((b) => b.modules === modules) ?? BOARD_SIZES[1];

/* ------------------------------------------------------------------ inversor e strings */

export interface InverterSpec {
  brand: string;
  model: string;
  powerKw: number;
  connection: Connection;
  maxCurrent: number; // A (0 = calcular)
  mppts: number;
  stringsPerMppt: number;
  vdcMax: number;
  mpptMin: number;
  mpptMax: number;
  iMaxMppt: number; // A por MPPT
  dcSwitch: boolean;
  dcSpd: boolean; // DPS CC interno
}

export const INVERTER_BRANDS = ["Growatt", "Deye", "Fronius", "SMA", "Huawei", "Sungrow", "Solis", "GoodWe", "WEG", "Sofar", "Hoymiles", "Outro"];

/** Presets típicos por faixa de potência (confira a folha de dados do modelo escolhido). */
export function inverterPreset(powerKw: number, connection: Connection): Omit<InverterSpec, "brand" | "model"> {
  const tri = connection === "3f";
  return {
    powerKw,
    connection,
    maxCurrent: 0,
    mppts: powerKw <= 3.6 ? 1 : powerKw <= 12 ? 2 : powerKw <= 30 ? 3 : 4,
    stringsPerMppt: powerKw <= 12 ? 1 : 2,
    vdcMax: tri ? 1100 : 600,
    mpptMin: tri ? 180 : 80,
    mpptMax: tri ? 1000 : 550,
    iMaxMppt: powerKw <= 12 ? 16 : 32,
    dcSwitch: true,
    dcSpd: true,
  };
}

export const INVERTER_SIZES = [2, 3, 3.6, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 36, 40, 50, 60, 75];

/** Potência de inversor sugerida para um gerador (relação CC/CA alvo ≈ 1,25). */
export function suggestInverterKw(kwp: number, ratio = 1.25): number {
  const target = kwp / ratio;
  return INVERTER_SIZES.find((s) => s >= target * 0.95) ?? INVERTER_SIZES[INVERTER_SIZES.length - 1];
}

export interface StringModule {
  voc: number;
  vmp: number;
  isc: number;
  imp: number;
  tempCoefVoc: number; // %/°C
}

export interface StringDesign {
  vocCold: number;
  vmpHot: number;
  minPerString: number;
  maxPerString: number;
  strings: { mppt: number; modules: number }[];
  used: number;
  leftover: number;
  stringVocMax: number;
  stringVmp: number;
  currentOk: boolean;
  needFuses: boolean;
  dcSection: number;
  dcDrop: number;
  warnings: string[];
}

/** Arranjo de strings: limites por temperatura (célula a 5 °C e 70 °C) e distribuição nos MPPTs. */
export function designStrings(mod: StringModule, inv: InverterSpec, nModules: number, dcLength: number, tMin = 5, tMax = 70): StringDesign {
  const k = mod.tempCoefVoc / 100;
  const vocCold = mod.voc * (1 + k * (tMin - 25));
  const vmpHot = mod.vmp * (1 + 1.3 * k * (tMax - 25));
  const maxPerString = Math.max(1, Math.floor(inv.vdcMax / vocCold));
  const minPerString = Math.max(1, Math.ceil(inv.mpptMin / vmpHot));
  const maxStrings = Math.max(1, inv.mppts * inv.stringsPerMppt);
  const warnings: string[] = [];

  let best: { s: number; per: number[] } | null = null;
  for (let s = 1; s <= maxStrings; s++) {
    const base = Math.floor(nModules / s);
    if (base < minPerString) break;
    const per = Array.from({ length: s }, (_, i) => Math.min(maxPerString, base + (i < nModules % s ? 1 : 0)));
    const used = per.reduce((a, b) => a + b, 0);
    const score = used * 10 - (Math.max(...per) - Math.min(...per)) - s * 0.1;
    const bestScore = best ? best.per.reduce((a, b) => a + b, 0) * 10 - (Math.max(...best.per) - Math.min(...best.per)) - best.s * 0.1 : -Infinity;
    if (score > bestScore) best = { s, per };
  }
  const per = best?.per ?? [];
  // distribui strings pelos MPPTs (uma por MPPT primeiro)
  const strings = per.map((m, i) => ({ mppt: (i % inv.mppts) + 1, modules: m }));
  const used = per.reduce((a, b) => a + b, 0);
  const stringsOnMppt = Math.max(1, Math.ceil(per.length / Math.max(1, inv.mppts)));
  const currentOk = mod.isc * 1.25 * stringsOnMppt <= inv.iMaxMppt * 1.25 + 1e-9 && mod.imp * stringsOnMppt <= inv.iMaxMppt + 1e-9;
  const maxPer = per.length ? Math.max(...per) : 0;
  const stringVocMax = vocCold * maxPer;
  const stringVmp = mod.vmp * (per.length ? Math.min(...per) : 0);
  if (nModules === 0) warnings.push("Nenhum módulo posicionado ainda — monte o telhado na aba “Telhado e sol”.");
  else if (!per.length) warnings.push(`Poucos módulos: mínimo de ${minPerString} por string para entrar na faixa de MPPT.`);
  if (used < nModules) warnings.push(`${nModules - used} módulo(s) não cabem nas strings do inversor — revise o inversor ou a quantidade.`);
  if (stringVocMax > inv.vdcMax) warnings.push(`Voc da string no frio (${fmt(stringVocMax, 0)} V) acima do máximo do inversor (${inv.vdcMax} V).`);
  if (!currentOk) warnings.push(`Corrente por MPPT (${fmt(mod.imp * stringsOnMppt)} A) acima do limite de ${inv.iMaxMppt} A.`);
  if (mod.vmp * maxPer > inv.mpptMax) warnings.push("Vmp da string acima da faixa de MPPT — o inversor vai limitar a potência.");
  const needFuses = stringsOnMppt >= 3;
  // cabo solar: capacidade (≈ 4 mm² 40 A, 6 mm² 52 A) e queda ≤ 1%
  let dcSection = 4;
  for (const s of [4, 6, 10, 16]) {
    dcSection = s;
    const drop = stringVmp > 0 ? (100 * 2 * RHO_CU * dcLength * mod.imp) / s / stringVmp : 0;
    if (drop <= 1 && mod.isc * 1.25 <= (s === 4 ? 40 : s === 6 ? 52 : 70)) break;
  }
  const dcDrop = stringVmp > 0 ? (100 * 2 * RHO_CU * dcLength * mod.imp) / dcSection / stringVmp : 0;
  return { vocCold, vmpHot, minPerString, maxPerString, strings, used, leftover: nModules - used, stringVocMax, stringVmp, currentOk, needFuses, dcSection, dcDrop, warnings };
}

/* ------------------------------------------------------------------ rota do eletroduto */

export type ConduleteType = "LL" | "LR" | "LB" | "C" | "T" | "X" | "E";
export const CONDULETE_INFO: Record<ConduleteType, string> = {
  LL: "Curva — saída à esquerda",
  LR: "Curva — saída à direita",
  LB: "Curva — saída traseira (entra na parede)",
  C: "Passagem reta (inspeção)",
  T: "Derivação em T",
  X: "Cruzeta",
  E: "Terminal",
};

export interface RoutePoint {
  x: number; // m na parede (horizontal)
  y: number; // m (altura)
}

export interface Condulete extends RoutePoint {
  type: ConduleteType;
}

export interface Route {
  points: RoutePoint[];
  conduletes: Condulete[];
  length: number;
  bends: number;
  warnings: string[];
}

/**
 * Rota ortogonal de eletroduto aparente na parede: sai do equipamento, vai até a altura
 * da rota, corre na horizontal e desce/sobe até o destino. Condulete em cada curva e
 * caixa de passagem a cada 15 m de trecho reto (reduzido em 3 m por curva — NBR 5410 6.2.11.1.6).
 */
export function wallRoute(from: RoutePoint, to: RoutePoint, routeY: number): Route {
  const raw: RoutePoint[] = [from];
  if (Math.abs(from.x - to.x) < 0.01) raw.push(to);
  else {
    raw.push({ x: from.x, y: routeY }, { x: to.x, y: routeY }, to);
  }
  // remove pontos repetidos/colineares
  const pts: RoutePoint[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = last;
      if ((Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - p.x) < 1e-6) || (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - p.y) < 1e-6)) {
        pts[pts.length - 1] = p;
        continue;
      }
    }
    pts.push(p);
  }
  const conduletes: Condulete[] = [];
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const dIn = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
    const dOut = { x: pts[i + 1].x - pts[i].x, y: pts[i + 1].y - pts[i].y };
    const turn = dIn.x * dOut.y - dIn.y * dOut.x; // > 0: vira à esquerda
    conduletes.push({ ...pts[i], type: turn > 0 ? "LL" : "LR" });
  }
  const bends = conduletes.length;
  const maxStraight = Math.max(3, 15 - 3 * bends);
  // caixas de passagem em trechos longos
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.ceil(seg / maxStraight) - 1;
    for (let k = 1; k <= n; k++) conduletes.push({ x: a.x + ((b.x - a.x) * k) / (n + 1), y: a.y + ((b.y - a.y) * k) / (n + 1), type: "C" });
  }
  const warnings: string[] = [];
  if (bends > 3) warnings.push("Mais de 3 curvas entre caixas: acrescente condulete de passagem (NBR 5410).");
  return { points: pts, conduletes, length, bends, warnings };
}
