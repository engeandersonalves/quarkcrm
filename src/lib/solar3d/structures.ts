/**
 * Estruturas de fixação por tipo de telhado e levantamento de materiais (BOM).
 *
 * Os catálogos trazem nomes de linha genéricos e medidas típicas de mercado para estudo e
 * pré-orçamento — confirme códigos, vãos máximos e comprimentos no catálogo técnico do fabricante
 * e no cálculo estrutural (vento pela NBR 6123).
 */

import { panelRuns, type PanelPlacement, type RoofType } from "./geometry.ts";

export interface RoofInfo {
  label: string;
  short: string;
  defaultPitch: number;
  minPitch: number;
  maxPitch: number;
  flat: boolean;
  description: string;
  structure: string; // como a estrutura é fixada
  tips: string[];
}

export const ROOF_TYPES: Record<RoofType, RoofInfo> = {
  fibrocimento: {
    label: "Fibrocimento",
    short: "Fibro",
    defaultPitch: 10,
    minPitch: 5,
    maxPitch: 27,
    flat: false,
    description: "Telha ondulada de fibrocimento sobre terças de madeira ou metálicas.",
    structure: "Parafuso estrutural (prisioneiro) com vedação EPDM atravessando a crista da onda até a terça + trilho de alumínio.",
    tips: [
      "Fure sempre na crista da onda, nunca na calha.",
      "O parafuso precisa ancorar na terça — conferir espaçamento das terças antes de marcar os pontos.",
      "Use arruela/vedação EPDM e não pise diretamente nas telhas (use tábuas sobre as terças).",
      "Telha de 4 mm não suporta tráfego: planeje a montagem por passarelas.",
    ],
  },
  metalico: {
    label: "Metálico (trapezoidal)",
    short: "Metálico",
    defaultPitch: 10,
    minPitch: 3,
    maxPitch: 30,
    flat: false,
    description: "Telha metálica trapezoidal ou sanduíche (termoacústica).",
    structure: "Mini-trilho de alumínio fixado direto na crista do trapézio com parafusos autobrocantes e fita/vedação EPDM.",
    tips: [
      "Confirme a espessura da chapa (mín. 0,43–0,50 mm para autobrocante direto).",
      "Em telha sanduíche, fixe atravessando até a terça ou use mini-trilho com rebite estrutural conforme fabricante.",
      "Mini-trilho dispensa trilho longo: 1 peça por grampo, alinhada às cristas.",
    ],
  },
  colonial: {
    label: "Cerâmico / colonial",
    short: "Colonial",
    defaultPitch: 17,
    minPitch: 14,
    maxPitch: 45,
    flat: false,
    description: "Telhas cerâmicas (colonial, portuguesa, romana, francesa) ou de concreto sobre caibros e ripas.",
    structure: "Gancho de aço inox ou alumínio parafusado no caibro, passando sob a telha, + trilho de alumínio.",
    tips: [
      "Retire a telha, parafuse o gancho no caibro e desbaste a telha de cima para ela assentar sem quebrar.",
      "Inclinação mínima típica de 30% (≈17°) para telha colonial.",
      "Nunca apoie o gancho sobre a telha: a carga vai sempre para o caibro.",
    ],
  },
  laje: {
    label: "Laje",
    short: "Laje",
    defaultPitch: 0,
    minPitch: 0,
    maxPitch: 5,
    flat: true,
    description: "Laje de concreto (plana), com ou sem platibanda.",
    structure: "Triângulo de alumínio com inclinação fixa (10°–30°) chumbado com parabolt/químico ou com lastro de concreto.",
    tips: [
      "Afaste as fileiras para uma fileira não sombrear a outra no inverno (o app calcula automaticamente).",
      "Refaça a impermeabilização nos pontos de chumbamento ou use lastro sem furar.",
      "Verifique a sobrecarga admissível da laje (lastro pesa!).",
    ],
  },
  solo: {
    label: "Solo",
    short: "Solo",
    defaultPitch: 0,
    minPitch: 0,
    maxPitch: 0,
    flat: true,
    description: "Usina em solo: mesas com estacas cravadas, parafusadas ou em sapata de concreto.",
    structure: "Pilares de aço galvanizado + vigas e terças (ou perfis de alumínio), mesa em 2 módulos retrato (2P) ou 4 paisagem (4L).",
    tips: [
      "Faça sondagem/ensaio de arrancamento para escolher estaca cravada ou concreto.",
      "Mantenha a borda baixa a pelo menos 50 cm do solo (vegetação, respingos, animais).",
      "Preveja cerca, aterramento em malha e acesso para limpeza.",
    ],
  },
};

export interface StructureBrand {
  id: string;
  name: string;
  railLength: number; // barra de trilho padrão (m)
  maxSpan: Record<"fibrocimento" | "colonial", number>; // vão máximo típico entre fixações (m)
  lines: Partial<Record<RoofType, string>>;
  notes: string;
}

/** Fabricantes de estruturas comuns no Brasil (linhas e medidas típicas — confirme no catálogo). */
export const STRUCTURE_BRANDS: StructureBrand[] = [
  {
    id: "solar-group",
    name: "Solar Group",
    railLength: 4.2,
    maxSpan: { fibrocimento: 1.5, colonial: 1.2 },
    lines: {
      fibrocimento: "Kit fibrocimento — prisioneiro + perfil de alumínio",
      metalico: "Kit metálico — mini-trilho",
      colonial: "Kit cerâmico — gancho + perfil de alumínio",
      laje: "Kit laje — triângulo de alumínio",
      solo: "Estrutura de solo",
    },
    notes: "Kits completos por quantidade de módulos; perfis em alumínio extrudado.",
  },
  {
    id: "romagnole",
    name: "Romagnole",
    railLength: 4.2,
    maxSpan: { fibrocimento: 1.4, colonial: 1.2 },
    lines: {
      fibrocimento: "Linha fibrocimento — haste estrutural + trilho",
      metalico: "Linha metálica — mini-trilho / suporte trapezoidal",
      colonial: "Linha cerâmica — gancho regulável + trilho",
      laje: "Linha laje — triângulo inclinado",
      solo: "Linha solo — estrutura em aço galvanizado",
    },
    notes: "Fabricante nacional com linha completa em alumínio e aço galvanizado.",
  },
  {
    id: "pratyc",
    name: "Pratyc",
    railLength: 4.2,
    maxSpan: { fibrocimento: 1.4, colonial: 1.1 },
    lines: {
      fibrocimento: "Fibrocimento — prisioneiro e perfil",
      metalico: "Metálico — mini-trilho",
      colonial: "Cerâmico — gancho e perfil",
      laje: "Laje — triângulo",
      solo: "Solo — mesa fixa",
    },
    notes: "Estruturas em alumínio para telhados e solo.",
  },
  {
    id: "k2",
    name: "K2 Systems",
    railLength: 4.4,
    maxSpan: { fibrocimento: 1.5, colonial: 1.3 },
    lines: {
      fibrocimento: "Hanger bolt + trilho",
      metalico: "MiniRail / SingleRail",
      colonial: "Gancho (roof hook) + trilho",
      laje: "Sistema para laje (triângulo/lastro)",
      solo: "Sistema de solo",
    },
    notes: "Sistema alemão com cálculo estrutural por projeto (software do fabricante).",
  },
  {
    id: "generica",
    name: "Genérica / outra",
    railLength: 4.2,
    maxSpan: { fibrocimento: 1.2, colonial: 1.0 },
    lines: {},
    notes: "Medidas conservadoras para estudo.",
  },
];

export const brandById = (id: string) => STRUCTURE_BRANDS.find((b) => b.id === id) ?? STRUCTURE_BRANDS[STRUCTURE_BRANDS.length - 1];

export interface BomLine {
  item: string;
  qty: number;
  unit: string;
  note?: string;
}

export interface StructureInput {
  roofType: RoofType;
  panels: PanelPlacement[];
  brandId: string;
  /** Espaçamento real entre terças/caibros (m) — define onde cai cada fixação. */
  supportSpacing: number;
  moduleAlongRow: number; // largura do módulo ao longo da fileira (m)
  gap: number;
  stack: number; // módulos por mesa (laje/solo)
}

/** Levantamento de materiais da estrutura de um conjunto de módulos. */
export function structureBom(i: StructureInput): BomLine[] {
  const brand = brandById(i.brandId);
  const active = i.panels.filter((p) => p.enabled);
  if (!active.length) return [];
  const runs = panelRuns(active);
  const lines: BomLine[] = [];
  const midClamps = runs.reduce((a, r) => a + 2 * (r.count - 1), 0);
  const endClamps = runs.length * 4;

  if (i.roofType === "fibrocimento" || i.roofType === "colonial") {
    // As fixações só podem cair sobre terças/caibros: pula apoios enquanto o vão couber no limite do trilho.
    const support = Math.max(0.3, i.supportSpacing);
    const maxSpan = brand.maxSpan[i.roofType];
    const span = support * Math.max(1, Math.floor(maxSpan / support));
    if (support > maxSpan) lines.push({ item: "⚠ Vão entre apoios maior que o permitido para o trilho", qty: 0, unit: "", note: `apoios a ${support.toFixed(2).replace(".", ",")} m > ${maxSpan.toFixed(2).replace(".", ",")} m: prever terça/caibro intermediário` });
    let bars = 0;
    let splices = 0;
    let fixings = 0;
    let railMeters = 0;
    for (const r of runs) {
      const len = r.count * i.moduleAlongRow + (r.count - 1) * i.gap + 0.1;
      const pieces = Math.ceil(len / brand.railLength);
      railMeters += 2 * len;
      bars += 2 * pieces;
      splices += 2 * (pieces - 1);
      fixings += 2 * (Math.ceil(len / span) + 1);
    }
    lines.push({ item: `Trilho de alumínio ${brand.railLength.toFixed(2).replace(".", ",")} m`, qty: bars, unit: "barra", note: `${railMeters.toFixed(1).replace(".", ",")} m lineares` });
    lines.push({ item: "Emenda de trilho", qty: splices, unit: "pç" });
    if (i.roofType === "colonial") lines.push({ item: "Gancho para telha cerâmica (inox/alumínio)", qty: fixings, unit: "pç", note: `≈ 1 a cada ${span.toFixed(2).replace(".", ",")} m, sempre no caibro` });
    else lines.push({ item: "Parafuso estrutural (prisioneiro) com vedação EPDM", qty: fixings, unit: "pç", note: `≈ 1 a cada ${span.toFixed(2).replace(".", ",")} m, na crista, ancorado na terça` });
    lines.push({ item: "Parafuso de fixação (gancho/haste → trilho) com porca martelo", qty: fixings, unit: "pç" });
    lines.push({ item: "Terminal/clip de aterramento do trilho", qty: runs.length * 2, unit: "pç" });
    lines.push({ item: "Jumper de aterramento na emenda", qty: splices, unit: "pç" });
  } else if (i.roofType === "metalico") {
    const miniRails = runs.reduce((a, r) => a + 2 * (r.count + 1), 0);
    lines.push({ item: "Mini-trilho de alumínio (≈ 40 cm)", qty: miniRails, unit: "pç", note: "1 por ponto de grampo, sobre a crista do trapézio" });
    lines.push({ item: "Parafuso autobrocante com vedação", qty: miniRails * 4, unit: "pç" });
    lines.push({ item: "Fita/vedação EPDM para mini-trilho", qty: miniRails, unit: "pç" });
    lines.push({ item: "Clip/terminal de aterramento", qty: active.length, unit: "pç" });
  } else {
    // laje e solo: mesas
    const racks = new Map<number, number[]>();
    for (const p of active) {
      const list = racks.get(p.rack) ?? [];
      if (!list.includes(p.col)) list.push(p.col);
      racks.set(p.rack, list);
    }
    let tables = 0;
    let colsTotal = 0;
    for (const cols of racks.values()) {
      cols.sort((a, b) => a - b);
      let n = 1;
      for (let k = 1; k <= cols.length; k++) {
        if (k < cols.length && cols[k] === cols[k - 1] + 1) n++;
        else {
          tables++;
          colsTotal += n;
          n = 1;
        }
      }
    }
    const tableLen = colsTotal * i.moduleAlongRow + Math.max(0, colsTotal - tables) * i.gap;
    if (i.roofType === "laje") {
      const triangles = tables + colsTotal; // um triângulo por junta de módulos
      lines.push({ item: "Triângulo de alumínio (inclinação fixa)", qty: triangles, unit: "pç" });
      lines.push({ item: `Trilho de alumínio ${brand.railLength.toFixed(2).replace(".", ",")} m`, qty: Math.ceil((2 * tableLen) / brand.railLength) * i.stack, unit: "barra" });
      lines.push({ item: "Chumbador parabolt 3/8\" ou fixação química", qty: triangles * 2, unit: "pç", note: "ou lastro de concreto conforme cálculo de vento" });
      lines.push({ item: "Manta/selante para impermeabilização dos furos", qty: Math.ceil(triangles / 10), unit: "tubo" });
    } else {
      const posts = Math.ceil(tableLen / 2.5) + tables;
      lines.push({ item: "Pilar dianteiro (aço galvanizado)", qty: posts, unit: "pç" });
      lines.push({ item: "Pilar traseiro (aço galvanizado)", qty: posts, unit: "pç" });
      lines.push({ item: "Viga inclinada (diagonal da mesa)", qty: posts, unit: "pç" });
      lines.push({ item: "Terça/perfil longitudinal", qty: Math.ceil((tableLen * (i.stack + 1)) / 6), unit: "barra 6 m" });
      lines.push({ item: "Estaca cravada/parafusada ou sapata de concreto", qty: posts * 2, unit: "pç", note: "definir após sondagem do terreno" });
      lines.push({ item: "Contraventamento", qty: tables * 2, unit: "pç" });
    }
    lines.push({ item: "Terminal de aterramento da estrutura", qty: tables, unit: "pç" });
  }
  lines.push({ item: "Grampo intermediário", qty: i.roofType === "laje" || i.roofType === "solo" ? midClampsTables(active) : midClamps, unit: "pç" });
  lines.push({ item: "Grampo final", qty: i.roofType === "laje" || i.roofType === "solo" ? endClampsTables(active) : endClamps, unit: "pç" });
  return lines;
}

function midClampsTables(active: PanelPlacement[]) {
  return panelRuns(active).reduce((a, r) => a + 2 * (r.count - 1), 0);
}
function endClampsTables(active: PanelPlacement[]) {
  return panelRuns(active).length * 4;
}

/** Soma linhas iguais de vários conjuntos. */
export function mergeBom(lists: BomLine[][]): BomLine[] {
  const map = new Map<string, BomLine>();
  for (const list of lists)
    for (const l of list) {
      const cur = map.get(l.item);
      if (cur) cur.qty += l.qty;
      else map.set(l.item, { ...l });
    }
  return [...map.values()].filter((l) => l.qty > 0 || l.item.startsWith("⚠"));
}
