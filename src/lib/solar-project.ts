/**
 * Projeto fotovoltaico para a distribuidora (Equatorial · microgeração grupo B):
 * dados do cliente, da UC, do responsável técnico e dos equipamentos, os cálculos do
 * memorial e o mapa das células do Formulário de Solicitação (ANEXO I, NT.020).
 */
import type { SheetValues } from "./xlsx-fill.ts";

/* ------------------------------------------------------------------ listas do formulário */

export const PHASES = ["MONOFÁSICO", "BIFÁSICO", "TRIFÁSICO"] as const;
export type Phase = (typeof PHASES)[number];
export const VOLTAGES = [127, 220, 380] as const;
export const BREAKERS = [20, 25, 30, 32, 40, 50, 60, 63, 70, 80, 100, 125, 150, 175, 200] as const;
export const UFS = ["AL", "AP", "GO", "MA", "PA", "PI", "RS"] as const;
export const CLASSES = ["Residencial", "Industrial", "Comércio, serviços e outras atividades", "Rural", "Poder Público", "Iluminação Pública", "Serviço Público", "Consumo próprio"] as const;
export const BRANCHES = ["AÉREO", "SUBTERRÂNEO"] as const;
export const MODALITIES = ["AUTOCONSUMO LOCAL", "AUTOCONSUMO REMOTO", "GERAÇÃO COMPARTILHADA", "EMPREENDIMENTO DE MÚLTIPLAS UNIDADES CONSUMIDORAS"] as const;
export const REQUEST_TYPES = [
  "LIGAÇÃO NOVA DE UNIDADE CONSUMIDORA COM GERAÇÃO DISTRIBUÍDA",
  "CONEXÃO DE GD EM UNIDADE CONSUMIDORA EXISTENTE SEM AUMENTO DE POTÊNCIA DISPONIBILIZADA (ver item abaixo)",
  "CONEXÃO DE GD EM UNIDADE CONSUMIDORA EXISTENTE COM AUMENTO DE POTÊNCIA DISPONIBILIZADA (ver item abaixo)",
  "AUMENTO DA POTÊNCIA DE GERAÇÃO EM UC COM GD EXISTENTE SEM AUMENTO DE POTÊNCIA DISPONIBILIZADA (ver item abaixo)",
  "AUMENTO DA POTÊNCIA DE GERAÇÃO EM UC COM GD EXISTENTE COM AUMENTO DE POTÊNCIA DISPONIBILIZADA (ver item abaixo)",
] as const;
export const REQUEST_LABEL: Record<string, string> = {
  [REQUEST_TYPES[0]]: "Ligação nova com GD",
  [REQUEST_TYPES[1]]: "UC existente, sem aumento de potência",
  [REQUEST_TYPES[2]]: "UC existente, com aumento de potência",
  [REQUEST_TYPES[3]]: "Aumento da geração, sem aumento de potência",
  [REQUEST_TYPES[4]]: "Aumento da geração, com aumento de potência",
};
export const UF_NAME: Record<string, string> = { AL: "Alagoas", AP: "Amapá", GO: "Goiás", MA: "Maranhão", PA: "Pará", PI: "Piauí", RS: "Rio Grande do Sul" };

/* ------------------------------------------------------------------ dados */

export interface PvModule {
  brand: string;
  model: string;
  powerW: number;
  qty: number;
  voc: string;
  isc: string;
  vmp: string;
  imp: string;
  efficiency: string;
  lengthM: number;
  widthM: number;
  weightKg: string;
}

export interface PvInverter {
  brand: string;
  model: string;
  qty: number;
  /** Potência nominal CA (kW). */
  powerKw: number;
  /** Fases na saída (1 = F+N, 2 = 2F+N, 3 = 3F+N). */
  phases: 1 | 2 | 3;
  maxDcKw: string;
  maxDcV: string;
  maxDcA: string;
  mpptMaxV: string;
  mpptMinV: string;
  startV: string;
  strings: string;
  mppts: string;
  acMaxKw: string;
  /** Corrente nominal / máxima de saída CA (A). */
  acA: number;
  acV: string;
  acMaxV: string;
  acMinV: string;
  /** Faixa de tensão de operação (formulário), ex.: "180-280". */
  voltageRange: string;
  pf: string;
  efficiency: number;
  thd: string;
}

export interface LoadItem {
  name: string;
  w: number;
  qty: number;
  fp: number;
  fd: number;
}

export interface ProjectData {
  client: { name: string; doc: string; rg: string; rgDate: string; phone: string; landline: string; email: string; address: string; district: string; cep: string; city: string; state: string };
  uc: {
    account: string;
    cls: string;
    activity: string;
    phase: Phase;
    voltage: number;
    breakerA: number;
    declaredLoadKw: number;
    branch: string;
    pole: string;
    utmX: string;
    utmY: string;
    requestType: string;
    modality: string;
    specialLoads: boolean;
  };
  rt: { name: string; title: string; register: string; registerUf: string; email: string; landline: string; mobile: string; address: string; district: string; city: string; uf: string; cep: string };
  modules: PvModule[];
  inverters: PvInverter[];
  generation: { hsp: number; pr: number; tempMax: number; source: string };
  entrance: { phaseMm2: string; neutralMm2: string; meterBox: string; meterBoxDims: string; meterBoxPlace: string; groundMm2: string };
  protection: {
    fuses: string;
    dcSwitch: string;
    /** Disjuntor CA por inversor (A); 0 = automático. */
    acBreakerA: number;
    acPoles: number;
    curve: string;
    dpsClass: string;
    dpsV: string;
    dpsIn: string;
    dpsMax: string;
    rods: number;
    groundInverterMm2: string;
    groundModuleMm2: string;
  };
  cables: { dcMm2: string; /** 0 = automático */ acMm2: number };
  loads: LoadItem[];
  /** Consumo dos últimos 12 meses (kWh); vazio = sem histórico. */
  consumption: number[];
  place: string;
}

export const emptyModule = (): PvModule => ({ brand: "", model: "", powerW: 0, qty: 0, voc: "", isc: "", vmp: "", imp: "", efficiency: "", lengthM: 0, widthM: 0, weightKg: "" });
export const emptyInverter = (): PvInverter => ({
  brand: "",
  model: "",
  qty: 1,
  powerKw: 0,
  phases: 1,
  maxDcKw: "",
  maxDcV: "",
  maxDcA: "",
  mpptMaxV: "",
  mpptMinV: "",
  startV: "",
  strings: "",
  mppts: "",
  acMaxKw: "",
  acA: 0,
  acV: "220",
  acMaxV: "",
  acMinV: "",
  voltageRange: "",
  pf: "1",
  efficiency: 0,
  thd: "<3",
});

export const DEFAULT_LOADS: LoadItem[] = ["Ar condicionado", "Geladeira", "Chuveiro elétrico", "Micro-ondas", "Máquina de lavar roupas", "Computador", "TV", "Luminária", "Ventilador"].map((name) => ({ name, w: 0, qty: 0, fp: 0.92, fd: 1 }));

export function defaultProject(): ProjectData {
  return {
    client: { name: "", doc: "", rg: "", rgDate: "", phone: "", landline: "", email: "", address: "", district: "", cep: "", city: "", state: "AL" },
    uc: {
      account: "",
      cls: "Residencial",
      activity: "Residencial",
      phase: "MONOFÁSICO",
      voltage: 220,
      breakerA: 40,
      declaredLoadKw: 0,
      branch: "AÉREO",
      pole: "",
      utmX: "",
      utmY: "",
      requestType: REQUEST_TYPES[1],
      modality: "AUTOCONSUMO LOCAL",
      specialLoads: false,
    },
    rt: { name: "", title: "Técnico em Eletrotécnica", register: "", registerUf: "AL", email: "", landline: "", mobile: "", address: "", district: "", city: "Maceió", uf: "AL", cep: "" },
    modules: [emptyModule()],
    inverters: [emptyInverter()],
    generation: { hsp: 5.28, pr: 0.8, tempMax: 29, source: "CRESESB (SunData)" },
    entrance: { phaseMm2: "", neutralMm2: "", meterBox: "existente monofásica em material polimérico", meterBoxDims: "414 mm x 280 mm x 215 mm", meterBoxPlace: "na fachada", groundMm2: "10" },
    protection: {
      fuses: "Para esse sistema não foi necessária a utilização de fusíveis.",
      dcSwitch: "32 A / 1000 VCC integrada ao inversor",
      acBreakerA: 0,
      acPoles: 0,
      curve: "C",
      dpsClass: "II",
      dpsV: "275 V",
      dpsIn: "10 kA",
      dpsMax: "20 kA",
      rods: 1,
      groundInverterMm2: "",
      groundModuleMm2: "4",
    },
    cables: { dcMm2: "4", acMm2: 0 },
    loads: DEFAULT_LOADS.map((l) => ({ ...l })),
    consumption: [],
    place: "",
  };
}

/** Projeto salvo (jsonb) completo com os campos que faltarem. */
export function normalizeProject(raw: unknown): ProjectData {
  const d = defaultProject();
  const r = (raw ?? {}) as Partial<ProjectData>;
  return {
    ...d,
    ...r,
    client: { ...d.client, ...(r.client ?? {}) },
    uc: { ...d.uc, ...(r.uc ?? {}) },
    rt: { ...d.rt, ...(r.rt ?? {}) },
    modules: (r.modules?.length ? r.modules : d.modules).map((m) => ({ ...emptyModule(), ...m })),
    inverters: (r.inverters?.length ? r.inverters : d.inverters).map((m) => ({ ...emptyInverter(), ...m })),
    generation: { ...d.generation, ...(r.generation ?? {}) },
    entrance: { ...d.entrance, ...(r.entrance ?? {}) },
    protection: { ...d.protection, ...(r.protection ?? {}) },
    cables: { ...d.cables, ...(r.cables ?? {}) },
    loads: r.loads ?? d.loads,
    consumption: r.consumption ?? [],
  };
}

/* ------------------------------------------------------------------ cálculos */

const n = (v: unknown) => Number(String(v ?? "").replace(",", ".")) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Seções de cabo (mm²) e a corrente que cada uma conduz (A), método de referência B1 (NBR 5410). */
const CABLES: [number, number][] = [
  [1.5, 15.5],
  [2.5, 21],
  [4, 28],
  [6, 36],
  [10, 50],
  [16, 68],
  [25, 89],
  [35, 111],
  [50, 134],
  [70, 171],
  [95, 207],
  [120, 239],
];
const AC_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/** Disjuntor de saída do inversor: o primeiro padrão acima da corrente nominal + 8 A (regra da Quark). */
export const inverterBreaker = (acA: number) => AC_BREAKERS.find((b) => b > n(acA) + 8) ?? AC_BREAKERS[AC_BREAKERS.length - 1];
/** Menor cabo que conduz a corrente do disjuntor. */
export const cableFor = (amps: number) => (CABLES.find(([, cap]) => cap >= amps) ?? CABLES[CABLES.length - 1])[0];
export const mm2 = (v: number | string) => String(v).replace(".", ",");

export const phaseCount = (p: Phase) => (p === "TRIFÁSICO" ? 3 : p === "BIFÁSICO" ? 2 : 1);
/** Tensão fase-neutro do atendimento (380/220 → 220). */
export const phaseVoltage = (p: Phase, v: number) => (p === "MONOFÁSICO" ? v : v === 380 ? 220 : v === 220 ? 127 : Math.round(v / Math.sqrt(3)));

export function calc(d: ProjectData) {
  const mods = d.modules.filter((m) => n(m.qty) > 0 && n(m.powerW) > 0);
  const invs = d.inverters.filter((i) => n(i.qty) > 0 && n(i.powerKw) > 0);
  const moduleQty = mods.reduce((s, m) => s + n(m.qty), 0);
  const kwp = r2(mods.reduce((s, m) => s + (n(m.qty) * n(m.powerW)) / 1000, 0));
  const areaOf = (m: PvModule) => (n(m.lengthM) > 0 && n(m.widthM) > 0 ? n(m.lengthM) * n(m.widthM) : 2.57);
  const area = r2(mods.reduce((s, m) => s + n(m.qty) * areaOf(m), 0));
  const inverterKw = r2(invs.reduce((s, i) => s + n(i.qty) * n(i.powerKw), 0));
  const inverterQty = invs.reduce((s, i) => s + n(i.qty), 0);
  const tri = d.uc.phase === "TRIFÁSICO";
  const nf = tri ? 1.73 : 1;
  const pdKva = r2((n(d.uc.voltage) * n(d.uc.breakerA) * nf) / 1000);
  const pdKw = r2(pdKva * 0.92);
  /** Potência de geração do orçamento: a menor entre inversores e módulos. */
  const pg = r2(Math.min(inverterKw || kwp, kwp || inverterKw));
  const monthlyRaw = r2(kwp * n(d.generation.hsp) * 30);
  const monthly = r2(monthlyRaw * n(d.generation.pr));
  const main = invs[0] ?? d.inverters[0] ?? emptyInverter();
  const acBreaker = n(d.protection.acBreakerA) || inverterBreaker(main.acA);
  const acCable = n(d.cables.acMm2) || cableFor(acBreaker);
  const vf = phaseVoltage(d.uc.phase, n(d.uc.voltage));
  const phases = phaseCount(d.uc.phase);
  const entranceCable = n(String(d.entrance.phaseMm2).replace(",", ".")) || cableFor(n(d.uc.breakerA));
  const consumption = d.consumption.filter((v) => n(v) > 0);
  const loads = d.loads
    .filter((l) => l.name.trim() && n(l.w) > 0 && n(l.qty) > 0)
    .map((l) => {
      const ci = r2((n(l.w) * n(l.qty)) / 1000);
      const fp = n(l.fp) || 1;
      const fd = n(l.fd) || 1;
      return { ...l, ci, kva: r2(ci / fp), dkw: r2(ci * fd), dkva: r2((ci / fp) * fd) };
    });
  return {
    mods,
    invs,
    moduleQty,
    kwp,
    area,
    inverterKw,
    inverterQty,
    pdKva,
    pdKw,
    nf,
    pg,
    pgOk: pg > 0 && pg <= pdKw,
    overGroupB: pg > 75,
    dcAcRatio: inverterKw > 0 ? r2(kwp / inverterKw) : 0,
    monthlyRaw,
    monthly,
    yearly: r2(monthly * 12),
    acBreaker,
    acPoles: n(d.protection.acPoles) || main.phases || 1,
    acCable,
    groundInverter: d.protection.groundInverterMm2 || mm2(acCable),
    vf,
    protMin: Math.round(vf * 0.8),
    protMax: Math.round(vf * 1.1),
    phases,
    conductors: `${["um", "dois", "três"][phases - 1]} ${phases === 1 ? "condutor" : "condutores"} fase`,
    conductorsTotal: ["dois", "três", "quatro"][phases - 1] + " condutores",
    entranceCable,
    consumption,
    consumptionAvg: consumption.length ? Math.round(consumption.reduce((s, v) => s + n(v), 0) / consumption.length) : 0,
    loads,
    loadTotal: {
      ci: r2(loads.reduce((s, l) => s + l.ci, 0)),
      kva: r2(loads.reduce((s, l) => s + l.kva, 0)),
      dkw: r2(loads.reduce((s, l) => s + l.dkw, 0)),
      dkva: r2(loads.reduce((s, l) => s + l.dkva, 0)),
    },
  };
}
export type ProjectCalc = ReturnType<typeof calc>;

/** Perdas do estudo de performance ratio (memorial). */
export const LOSSES: [string, string][] = [
  ["Sombreamento", "0,1%"],
  ["Temperatura", "7,0%"],
  ["Sujidade", "1,0%"],
  ["Mismatching", "0,5%"],
  ["Tolerância de potência", "4,0%"],
  ["Perdas C.C.", "2,5%"],
  ["Tracking losses", "0,1%"],
  ["Eficiência do inversor", "1,8%"],
  ["Perdas C.A.", "3,0%"],
];

/** O que falta para gerar os documentos (campos obrigatórios do formulário). */
export function missing(d: ProjectData): string[] {
  const c = calc(d);
  const out: string[] = [];
  if (!d.client.name.trim()) out.push("Nome do titular");
  if (!d.client.doc.trim()) out.push("CPF/CNPJ do titular");
  if (!d.client.address.trim()) out.push("Endereço da UC");
  if (!d.client.city.trim()) out.push("Município");
  if (!d.uc.account.trim() && d.uc.requestType !== REQUEST_TYPES[0]) out.push("Conta contrato");
  if (!c.mods.length) out.push("Módulos (potência e quantidade)");
  if (!c.invs.length) out.push("Inversor (potência e quantidade)");
  if (!d.rt.name.trim()) out.push("Responsável técnico");
  if (!d.rt.register.trim()) out.push("Registro do responsável técnico");
  return out;
}

/* ------------------------------------------------------------------ formulário (Excel) */

const digits = (v: string) => v.replace(/\D/g, "");
const num = (v: string | number) => {
  const x = n(v);
  return x ? x : null;
};
const txt = (v: string | number | null | undefined) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

/** Células do modelo da distribuidora (Guias 0 e 1 e o cabeçalho do comissionamento). */
export function formCells(d: ProjectData): SheetValues {
  const g0: Record<string, string | number | null> = {};
  for (let i = 0; i < 10; i++) {
    const r = 7 + i;
    const m = d.modules[i];
    g0[`D${r}`] = m ? num(m.powerW) : null;
    g0[`H${r}`] = m ? num(m.qty) : null;
    g0[`P${r}!`] = m && n(m.qty) ? r2(n(m.qty) * (n(m.lengthM) > 0 && n(m.widthM) > 0 ? n(m.lengthM) * n(m.widthM) : 2.57)) : null;
    g0[`T${r}`] = m ? txt(m.brand) : null;
    g0[`AA${r}`] = m ? txt(m.model) : null;
  }
  for (let i = 0; i < 9; i++) {
    const r = 22 + i;
    const v = d.inverters[i];
    const qty = v ? Math.max(1, n(v.qty)) : 0;
    g0[`D${r}`] = v ? txt(v.brand) : null;
    g0[`H${r}`] = v ? txt(qty > 1 ? `${v.model} (${qty} un.)` : v.model) : null;
    g0[`L${r}`] = v ? num(r2(n(v.powerKw) * qty)) : null;
    g0[`P${r}`] = v ? txt(v.voltageRange) : null;
    g0[`T${r}`] = v ? num(v.acA) : null;
    g0[`W${r}`] = v ? num(v.pf) : null;
    g0[`Z${r}`] = v ? num(v.efficiency) : null;
    g0[`AC${r}`] = v ? txt(v.thd) : null;
  }
  const c = d.client;
  const u = d.uc;
  const t = d.rt;
  const doc = digits(c.doc);
  const fmtDoc = doc.length === 14 ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : doc.length === 11 ? doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : c.doc;
  const g1: Record<string, string | number | null> = {
    C10: txt(c.name?.toUpperCase()),
    R10: txt(fmtDoc),
    AC9: txt(c.rg),
    AC10: txt(c.rgDate),
    C13: txt([c.address, c.district].filter((x) => x?.trim()).join(" - ").toUpperCase()),
    T13: txt(c.phone),
    AB13: txt(c.landline) ?? "-",
    D15: num(digits(c.cep)),
    I15: txt(c.city?.toUpperCase()),
    Q15: txt(c.state || "AL"),
    V15: txt(c.email),
    F17: "Orçamento de Conexão",
    Z17: num(digits(u.account)) ?? txt(u.account),
    G19: u.requestType,
    F23: u.specialLoads ? "SIM" : "NÃO",
    G25: txt(u.activity?.toUpperCase()),
    F27: u.cls,
    T27: u.phase,
    AC27: num(u.voltage),
    F29: num(u.declaredLoadKw),
    P29: num(u.breakerA),
    F31: u.branch,
    T31: txt(u.pole) ?? "-",
    P33: txt(u.utmX),
    Y33: txt(u.utmY),
    C38: txt(t.name),
    M38: txt(t.title),
    Y38: txt(t.register),
    AE38: txt(t.registerUf),
    C41: txt(t.email),
    M41: txt(t.landline) ?? "-",
    S41: txt(t.mobile),
    C44: txt(t.address),
    P43: txt(t.district),
    AB43: txt(t.uf),
    P44: txt(t.city),
    AB44: num(digits(t.cep)),
    G49: "SOLAR FOTOVOLTAICA",
    G51: "EMPREGANDO CONVERSOR ELETRÔNICO/INVERSOR",
    I53: u.modality,
    O109: txt(`${(c.city || d.place || "Maceió").toUpperCase()}, ${(UF_NAME[c.state || "AL"] ?? c.state).toUpperCase()}`),
  };
  const com: Record<string, string | number | null> = {
    C11: txt(t.name),
    C12: txt(t.title),
    N12: txt(t.register),
    C13: txt(t.mobile),
    G13: txt(t.email),
    C14: txt(t.address),
    M14: txt(t.district),
    C15: num(digits(t.cep)),
    F15: txt(t.city),
    M15: txt(UF_NAME[t.uf] ?? t.uf),
  };
  return { "0": g0, "1": g1, Comissionamento: com };
}

/** Modelo limpo: as mesmas células, vazias (o que é fixo do formulário fica). */
export function blankFormCells(): SheetValues {
  const keep = new Set(["F17", "G49", "G51"]);
  const out: SheetValues = {};
  for (const [sheet, cells] of Object.entries(formCells(defaultProject()))) out[sheet] = Object.fromEntries(Object.keys(cells).map((k) => [k, sheet === "1" && keep.has(k) ? cells[k] : null]));
  return out;
}

/** Os 7 itens da pasta do projeto, na ordem da distribuidora. */
export const PROJECT_ITEMS = [
  { key: "formulario", n: 1, title: "Formulário de solicitação", hint: "Gerado a partir dos dados do projeto (Excel e PDF)", auto: true },
  { key: "rg", n: 2, title: "RG do cliente", hint: "Foto ou PDF do documento do titular", auto: false },
  { key: "trt", n: 3, title: "TRT", hint: "Termo de responsabilidade técnica que você emite", auto: false },
  { key: "unifilar", n: 4, title: "Diagrama unifilar", hint: "PDF ou imagem do diagrama", auto: false },
  { key: "blocos", n: 5, title: "Diagrama de blocos", hint: "PDF ou imagem do diagrama", auto: false },
  { key: "memorial", n: 6, title: "Memorial técnico descritivo", hint: "Gerado a partir dos dados do projeto (PDF)", auto: true },
  { key: "datasheet", n: 7, title: "Datasheet do inversor", hint: "PDF do fabricante (vem do cadastro do equipamento)", auto: false },
] as const;
export type ProjectItemKey = (typeof PROJECT_ITEMS)[number]["key"];

/** Imagens que entram no memorial (opcionais). */
export const MEMORIAL_IMAGES = [
  { key: "localizacao", title: "Localização da UC", hint: "Print do mapa com o ponto da unidade (Figura 1)" },
  { key: "caixa", title: "Caixa de medição", hint: "Foto do padrão ou do local da futura caixa (Figura 3)" },
  { key: "cresesb", title: "Irradiação (CRESESB)", hint: "Print da consulta SunData da cidade" },
  { key: "assinatura", title: "Assinatura do responsável", hint: "PNG com fundo transparente, vai no fim do memorial" },
] as const;

export interface ProjectFile {
  path: string;
  name: string;
  type: string;
  size: number;
  at: string;
}
export type ProjectFiles = Partial<Record<string, ProjectFile>>;

export const PROJECT_STATUS = [
  { id: "rascunho", label: "Em preenchimento" },
  { id: "pronto", label: "Pasta pronta" },
  { id: "enviado", label: "Enviado à distribuidora" },
  { id: "aprovado", label: "Parecer aprovado" },
  { id: "vistoria", label: "Vistoria" },
  { id: "concluido", label: "Homologado" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number]["id"];

/* ------------------------------------------------------------------ projeto novo */

export interface LeadLike {
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  connection_type: string | null;
  consumption_kwh: number | null;
}
export interface ProposalLike {
  inputs: Record<string, unknown> | null;
}

/** Equipamento salvo na biblioteca (sem a quantidade, que é do projeto). */
export type ModuleSpecs = Omit<PvModule, "qty">;
export type InverterSpecs = Omit<PvInverter, "qty">;

/**
 * Projeto novo a partir do lead e da proposta: cliente, ligação, equipamentos e HSP.
 * O responsável técnico vem do último projeto; as fichas dos equipamentos, da biblioteca.
 */
export function projectFromLead(lead: LeadLike | null, proposal: ProposalLike | null, opts: { last?: ProjectData | null; modules?: { brand: string; model: string; specs: ModuleSpecs }[]; inverters?: { brand: string; model: string; specs: InverterSpecs }[] } = {}): ProjectData {
  const d = defaultProject();
  if (opts.last) {
    d.rt = { ...opts.last.rt };
    d.protection = { ...opts.last.protection, acBreakerA: 0, acPoles: 0 };
    d.generation = { ...opts.last.generation };
  }
  if (lead) {
    d.client = {
      ...d.client,
      name: lead.name ?? "",
      doc: lead.document ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      address: lead.address ?? "",
      city: lead.city ?? "",
      state: (lead.state || "AL").toUpperCase().slice(0, 2),
    };
    const ph = lead.connection_type === "tri" ? "TRIFÁSICO" : lead.connection_type === "bi" ? "BIFÁSICO" : lead.connection_type === "mono" ? "MONOFÁSICO" : null;
    if (ph) {
      d.uc.phase = ph;
      d.uc.voltage = ph === "MONOFÁSICO" ? 220 : 380;
      d.uc.breakerA = ph === "MONOFÁSICO" ? 40 : 50;
    }
  }
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const i = (proposal?.inputs ?? {}) as Record<string, unknown>;
  const s = (k: string) => String(i[k] ?? "").trim();
  const nn = (k: string) => Number(i[k]) || 0;
  if (s("moduleBrand") || nn("modulePowerW")) {
    const lib = opts.modules?.find((m) => same(m.brand, s("moduleBrand")) && same(m.model, s("moduleModel")));
    d.modules = [{ ...emptyModule(), ...(lib?.specs ?? {}), brand: s("moduleBrand"), model: s("moduleModel"), powerW: nn("modulePowerW") || lib?.specs.powerW || 0, qty: nn("moduleQty") }];
  }
  if (s("inverterBrand") || nn("inverterPowerKw")) {
    const lib = opts.inverters?.find((m) => same(m.brand, s("inverterBrand")) && same(m.model, s("inverterModel")));
    d.inverters = [{ ...emptyInverter(), ...(lib?.specs ?? {}), brand: s("inverterBrand"), model: s("inverterModel"), powerKw: nn("inverterPowerKw") || lib?.specs.powerKw || 0, qty: nn("inverterQty") || 1 }];
  }
  if (nn("sunHours")) d.generation.hsp = nn("sunHours");
  if (nn("performanceRatio")) d.generation.pr = nn("performanceRatio") > 1 ? nn("performanceRatio") / 100 : nn("performanceRatio");
  if (d.uc.phase === "MONOFÁSICO" && d.inverters[0]) d.inverters[0].phases = 1;
  return d;
}

/** Itens da pasta já resolvidos (os gerados contam quando os dados mínimos estão completos). */
export function packageProgress(d: ProjectData, files: ProjectFiles) {
  const ready = missing(d).length === 0;
  const done = PROJECT_ITEMS.map((it) => (it.auto ? ready : !!files[it.key]));
  return { done, count: done.filter(Boolean).length, total: PROJECT_ITEMS.length };
}
