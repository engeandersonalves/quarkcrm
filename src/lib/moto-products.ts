/**
 * Catálogo de scooters gerenciado no CRM: ficha técnica, custos, preço, lucro
 * e parcelamento no cartão (Tabela Price com taxa mensal fixa, padrão 2,10% a.m.).
 */
import { SCOOTERS, type GalleryPhoto, type Scooter } from "./catalog-mobilidade.ts";

export interface MotoSpecsFull {
  power: string;
  battery: string;
  range: string;
  speed: string;
  recharge: string;
  load: string;
  brakes: string;
  weight: string;
  security: string;
  highlight: string;
  /** Ficha completa do manual (opcional). */
  voltage?: string;
  motorType?: string;
  dimensions?: string;
  wheelbase?: string;
  wheels?: string;
  tires?: string;
  gears?: string;
  panel?: string;
  controller?: string;
  charger?: string;
  frame?: string;
  extras?: string;
}

/** Campos extras da ficha completa, na ordem do manual. */
export const MANUAL_SPEC_FIELDS: { k: keyof MotoSpecsFull; label: string; ph: string }[] = [
  { k: "voltage", label: "Tensão nominal", ph: "60 V" },
  { k: "motorType", label: "Tipo de motor", ph: "Motor traseiro sem escovas (brushless)" },
  { k: "dimensions", label: "Dimensões", ph: "165 × 45 × 87 cm" },
  { k: "wheelbase", label: "Entre-eixos", ph: "1.285 mm" },
  { k: "wheels", label: "Rodas", ph: "10 polegadas" },
  { k: "tires", label: "Pneus", ph: "3.0 × 10 para uso urbano" },
  { k: "gears", label: "Marchas", ph: "3 velocidades + ré" },
  { k: "panel", label: "Painel", ph: "Digital com NFC" },
  { k: "controller", label: "Controlador", ph: "12 tubos" },
  { k: "charger", label: "Carregador", ph: "60V 3A bivolt (100–240V), plugue 3 pinos" },
  { k: "frame", label: "Quadro", ph: "Aço" },
  { k: "extras", label: "Itens", ph: "Encosto, alarme, marcha ré" },
];

export interface MotoCosts {
  /** Custo de compra no fornecedor. */
  purchase: number;
  /** Frete até a loja. */
  freight: number;
  /** Montagem, preparação e revisão de entrega. */
  assembly: number;
  /** Itens que vão junto sem cobrar (capacete, cadeado…). */
  accessories: number;
  /** Outros custos fixos por unidade (marketing, documentação…). */
  other: number;
  /** Impostos sobre a venda (%). */
  taxPct: number;
  /** Comissão do vendedor (%). */
  commissionPct: number;
}

export interface MotoProduct {
  id: string;
  slug: string;
  name: string;
  kicker: string;
  pitch: string;
  forWho: string;
  accent: string;
  photo: string;
  gallery: GalleryPhoto[];
  colors: string[];
  specs: MotoSpecsFull;
  costs: MotoCosts;
  /** Preço à vista. */
  price: number;
  /** Parcelas no cartão (padrão 21). */
  installments: number;
  /** Juros ao mês no cartão (%). */
  rate: number;
  active: boolean;
  position: number;
}

export const DEFAULT_RATE = 2.1;
export const DEFAULT_INSTALLMENTS = 21;

export const emptySpecs = (): MotoSpecsFull => ({ power: "1.000W", battery: "", range: "", speed: "32 km/h", recharge: "", load: "", brakes: "", weight: "", security: "", highlight: "" });
export const emptyCosts = (): MotoCosts => ({ purchase: 0, freight: 0, assembly: 0, accessories: 0, other: 0, taxPct: 0, commissionPct: 0 });

export const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "modelo";

export function newProduct(p: Partial<MotoProduct> = {}): MotoProduct {
  return {
    id: "",
    slug: "",
    name: "",
    kicker: "",
    pitch: "",
    forWho: "",
    accent: "#9FDB7C",
    photo: "",
    gallery: [],
    colors: [],
    specs: emptySpecs(),
    costs: emptyCosts(),
    price: 0,
    installments: DEFAULT_INSTALLMENTS,
    rate: DEFAULT_RATE,
    active: true,
    position: 0,
    ...p,
  };
}

/* ---------------------------------------------------------------- contas */

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Parcela na Tabela Price: valor × i ÷ (1 − (1 + i)^−n). Sem juros quando a taxa é 0. */
export function installmentValue(price: number, n: number, ratePct = DEFAULT_RATE) {
  const p = Number(price) || 0;
  const k = Math.max(1, Math.round(Number(n) || 1));
  const i = (Number(ratePct) || 0) / 100;
  if (p <= 0) return 0;
  if (i <= 0 || k === 1) return round2(p / k);
  return round2((p * i) / (1 - (1 + i) ** -k));
}

/** Tabela de parcelamento (1x … n), com parcela e total. */
export function installmentTable(price: number, ratePct = DEFAULT_RATE, max = DEFAULT_INSTALLMENTS, picks = [1, 3, 6, 10, 12, 18, 21, 24]) {
  return picks
    .filter((n) => n <= Math.max(max, 1))
    .map((n) => {
      const each = n === 1 ? round2(price) : installmentValue(price, n, ratePct);
      return { n, each, total: round2(each * n) };
    });
}

export const unitCost = (c: MotoCosts) => round2((Number(c.purchase) || 0) + (Number(c.freight) || 0) + (Number(c.assembly) || 0) + (Number(c.accessories) || 0) + (Number(c.other) || 0));

/** Lucro de cada scooter vendida à vista, depois de custos, impostos e comissão. */
export function profitOf(p: Pick<MotoProduct, "price" | "costs">) {
  const price = Number(p.price) || 0;
  const cost = unitCost(p.costs);
  const taxes = round2((price * (Number(p.costs.taxPct) || 0)) / 100);
  const commission = round2((price * (Number(p.costs.commissionPct) || 0)) / 100);
  const profit = round2(price - cost - taxes - commission);
  return {
    price,
    cost,
    taxes,
    commission,
    profit,
    /** Lucro sobre o preço de venda. */
    margin: price > 0 ? round2((profit / price) * 100) : 0,
    /** Quanto o preço está acima do custo. */
    markup: cost > 0 ? round2(((price - cost) / cost) * 100) : 0,
  };
}

/** Preço à vista para atingir uma margem de lucro (%), dados custos, impostos e comissão. */
export function priceForMargin(costs: MotoCosts, marginPct: number) {
  const den = 1 - ((Number(costs.taxPct) || 0) + (Number(costs.commissionPct) || 0) + (Number(marginPct) || 0)) / 100;
  if (den <= 0) return 0;
  return Math.ceil(unitCost(costs) / den / 10) * 10 - 1;
}

/* ---------------------------------------------------------------- catálogo público */

/** Dados públicos (sem custos) que o catálogo online recebe. */
export type PublicMoto = Omit<MotoProduct, "costs" | "active" | "position">;

/** Converte o produto do CRM no formato do catálogo online. */
export function productToScooter(p: PublicMoto): Scooter {
  const s = p.specs;
  const each = installmentValue(p.price, p.installments, p.rate);
  const gallery: GalleryPhoto[] = [...(p.photo ? [{ src: p.photo, caption: "Destaque", fit: "contain" as const }] : []), ...p.gallery.filter((g) => g.src !== p.photo)];
  return {
    id: p.slug || p.id,
    name: p.name,
    kicker: p.kicker || "Scooter elétrica",
    pitch: p.pitch,
    forWho: p.forWho || "quer economizar e chegar mais rápido todos os dias.",
    image: p.photo || gallery[0]?.src || "/mob/cmp-scooter.webp",
    gallery,
    accent: p.accent || "#9FDB7C",
    specs: [
      { icon: "bolt", value: s.power || "—", sub: "motor elétrico", label: "Motor" },
      { icon: "battery", value: s.battery || "—", sub: "bateria", label: "Bateria" },
      { icon: "route", value: s.range || "—", sub: "de autonomia", label: "Autonomia" },
      { icon: "brake", value: s.brakes || "—", sub: "freios", label: "Freio" },
      { icon: "weight", value: s.load ? `Até ${s.load.replace(/^at[ée]\s*/i, "")}` : "—", sub: "de carga", label: "Carga" },
      s.security ? { icon: "lock", value: s.security, sub: "segurança", label: "Segurança" } : { icon: "gear", value: s.highlight || s.speed || "—", sub: "destaque", label: "Destaque" },
    ],
    table: {
      Motor: s.power,
      Bateria: s.battery,
      Autonomia: s.range,
      Velocidade: s.speed,
      Recarga: s.recharge,
      "Carga máx.": s.load,
      Freios: s.brakes,
      Destaque: s.highlight,
      Peso: s.weight,
    },
    installments: p.installments,
    installment: each,
    cash: p.price,
    total: round2(each * p.installments),
  };
}

/** Ficha completa dos manuais dos fornecedores. */
const MANUAL_SEED: Record<string, Partial<MotoSpecsFull>> = {
  cappuccino: {
    voltage: "60 V",
    motorType: "Motor traseiro sem escovas (brushless) de 1.000 W",
    dimensions: "165 × 45 × 87 cm",
    wheelbase: "1.285 mm",
    wheels: "10 polegadas",
    tires: "3.0 × 10 polegadas para uso urbano",
    gears: "3 velocidades + marcha ré",
    panel: "Digital com NFC",
    controller: "12 tubos",
    charger: "60V 3A bivolt (100–240V), plugue de 3 pinos padrão INMETRO",
    frame: "Aço",
    extras: "Encosto, alarme e marcha ré",
    battery: "Lítio 60V 20Ah (1.200 Wh)",
    recharge: "6 h",
    brakes: "Disco dianteiro e tambor traseiro",
  },
};

/** Os 3 modelos do catálogo de lançamento, como produtos (custos em branco). */
export function seedProducts(): MotoProduct[] {
  return SCOOTERS.map((s, i) =>
    newProduct({
      slug: s.id,
      name: s.name,
      kicker: s.kicker,
      pitch: s.pitch,
      forWho: s.forWho,
      accent: s.accent,
      photo: s.gallery.find((g) => g.fit === "contain")?.src ?? s.image,
      gallery: s.gallery,
      colors: { t1: ["Branca", "Preta", "Prata"], cappuccino: ["Creme", "Branca", "Verde menta"], mz: ["Cinza e laranja", "Preta", "Branca"] }[s.id] ?? [],
      specs: {
        power: s.table.Motor ?? "",
        battery: s.table.Bateria ?? "",
        range: s.table.Autonomia ?? "",
        speed: s.table.Velocidade ?? "",
        recharge: s.table.Recarga ?? "",
        load: s.table["Carga máx."] ?? "",
        brakes: s.table.Freios ?? "",
        weight: s.table.Peso ?? "",
        security: s.specs.find((x) => x.icon === "lock")?.value ?? "",
        highlight: s.table.Destaque ?? "",
        ...(MANUAL_SEED[s.id] ?? {}),
      },
      price: s.cash,
      position: i,
    }),
  );
}

/* ---------------------------------------------------------------- comparação */

/** Modelos de entrada comuns no mercado, para a arte comparativa (referência). */
export const WEAKER = [
  { name: "Scooter comum", power: 350, rangeKm: 30, speedKmh: 25, loadKg: 100, battery: "Chumbo 48V 12Ah", warranty: "Sem assistência local" },
  { name: "Bike elétrica comum", power: 250, rangeKm: 25, speedKmh: 25, loadKg: 90, battery: "Lítio 36V 7,8Ah", warranty: "Garantia de fábrica" },
];

/** Primeiro número de um texto ("1.000W" → 1000, "60 a 80 km" → 80, "~30 km" → 30). */
export function firstNumber(v: string, takeMax = true) {
  const nums = (v.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")));
  if (!nums.length) return 0;
  return takeMax ? Math.max(...nums) : nums[0];
}

/* ---------------------------------------------------------------- texto → produtos */

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s:;,.\-–—=>*•]+|[\s;,*]+$/g, "").trim();

/** Valor em reais escrito de qualquer jeito: "R$ 6.799,00", "6799", "4,2 mil". */
export function parseMoney(v: string) {
  const s = strip(v).replace(/r\$\s*/g, "");
  const mil = s.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  if (mil) return Math.round(Number(mil[1].replace(",", ".")) * 1000);
  const m = s.match(/\d[\d.,]*/);
  if (!m) return 0;
  let n = m[0];
  if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(n) && (n.match(/\./g) ?? []).length === 1) n = n.replace(/,/g, "");
  else n = n.replace(/[.,]/g, "");
  return Number(n) || 0;
}

const pctOf = (v: string) => Number((v.match(/\d+(?:[.,]\d+)?/)?.[0] ?? "0").replace(",", ".")) || 0;

type Key =
  | "name"
  | "kicker"
  | "pitch"
  | "forWho"
  | "colors"
  | keyof MotoSpecsFull
  | "purchase"
  | "freight"
  | "assembly"
  | "accessories"
  | "other"
  | "taxPct"
  | "commissionPct"
  | "price"
  | "installments"
  | "rate";

/** Rótulos aceitos (sem acento). A ordem importa: os mais específicos primeiro. */
const LABELS: [Key, string[]][] = [
  ["purchase", ["custo de compra", "preco de custo", "valor de compra", "custo do fornecedor", "custo unitario", "compra", "custo"]],
  ["freight", ["frete ate a loja", "frete de compra", "frete"]],
  ["assembly", ["montagem", "preparacao", "revisao de entrega"]],
  ["accessories", ["brindes", "acessorios inclusos", "acessorios"]],
  ["other", ["outros custos", "custos extras", "outros"]],
  ["taxPct", ["impostos", "imposto", "aliquota", "simples"]],
  ["commissionPct", ["comissao do vendedor", "comissao"]],
  ["rate", ["taxa do cartao", "juros ao mes", "juros", "taxa"]],
  ["installments", ["parcelas", "parcelamento", "vezes"]],
  ["price", ["preco a vista", "valor a vista", "preco de venda", "valor de venda", "a vista", "preco", "valor", "venda"]],
  ["name", ["nome do modelo", "modelo", "nome", "scooter", "moto"]],
  ["kicker", ["categoria", "linha", "tipo", "chamada", "slogan"]],
  ["pitch", ["descricao", "sobre", "apresentacao", "resumo"]],
  ["forWho", ["ideal para", "para quem", "publico"]],
  ["colors", ["cores disponiveis", "cores", "cor"]],
  ["power", ["potencia do motor", "potencia", "motor"]],
  ["battery", ["bateria"]],
  ["range", ["autonomia", "alcance"]],
  ["speed", ["velocidade maxima", "velocidade", "vel max"]],
  ["recharge", ["tempo de recarga", "recarga", "carregamento", "carga completa"]],
  ["load", ["carga maxima", "capacidade de carga", "suporta", "peso maximo", "carga max", "carga"]],
  ["brakes", ["freios", "freio"]],
  ["weight", ["peso da scooter", "peso liquido", "peso"]],
  ["security", ["seguranca", "alarme"]],
  ["highlight", ["destaque", "diferencial", "diferenciais"]],
];

function labelled(line: string): { key: Key; value: string } | null {
  const s = strip(line).replace(/^[\s*•\-–>]+/, "");
  for (const [key, labels] of LABELS) {
    for (const l of labels) {
      const esc = l.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      const m = s.match(new RegExp(`^${esc}\\s*(?:\\([^)]*\\))?\\s*(?:[:=\\-–—]|\\s(?=[\\dr$]))\\s*`));
      if (!m) continue;
      const offset = line.length - line.replace(/^[\s*•\-–>]+/, "").length;
      const value = clean(line.slice(offset + m[0].length));
      if (value) return { key, value };
    }
  }
  return null;
}

/** Linha sem rótulo que é claramente uma especificação ("1000W", "60V 20Ah", "32 km/h"…). */
function guessSpec(line: string): { key: keyof MotoSpecsFull; value: string } | null {
  const s = strip(line);
  if (/\d+\s*km\s*\/\s*h/.test(s)) return { key: "speed", value: clean(line) };
  if (/\d+\s*v\b.*\d+\s*ah|litio|grafeno|chumbo/.test(s)) return { key: "battery", value: clean(line) };
  if (/\d[\d.]*\s*w\b/.test(s)) return { key: "power", value: clean(line) };
  if (/\d+\s*(a\s*\d+\s*)?km\b/.test(s)) return { key: "range", value: clean(line) };
  if (/\d+\s*(a\s*\d+\s*)?h(oras)?\b.*(recarga|carreg)|^(\d+\s*a\s*)?\d+\s*h(oras)?$/.test(s)) return { key: "recharge", value: clean(line) };
  if (/disco|tambor|hidraulic/.test(s)) return { key: "brakes", value: clean(line) };
  if (/nfc|alarme/.test(s)) return { key: "security", value: clean(line) };
  return null;
}

const titleCase = (v: string) => (/[a-z]/.test(v) && /[A-Z]/.test(v) ? v : v.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()));

/** Divide o texto em blocos, um por modelo. */
function blocksOf(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.some((l) => l.trim())) blocks.push(cur);
    cur = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(-{3,}|={3,}|_{3,}|\*{3,})$/.test(line)) {
      flush();
      continue;
    }
    const hit = line ? labelled(line) : null;
    // Um novo "Modelo:" começa outro bloco.
    if (hit?.key === "name" && cur.some((l) => labelled(l.trim())?.key === "name")) flush();
    cur.push(line);
  }
  flush();
  // Sem rótulo "Modelo:" e separado só por linhas em branco: cada parágrafo é um modelo.
  if (blocks.length === 1) {
    const paras = text
      .replace(/\r/g, "")
      .split(/\n\s*\n/)
      .map((p) => p.split("\n").map((l) => l.trim()))
      .filter((p) => p.some(Boolean));
    const looksLikeModels = paras.length > 1 && paras.every((p) => p.filter(Boolean).length >= 3 && p.some((l) => /\d/.test(l)));
    if (looksLikeModels) return paras;
  }
  return blocks;
}

export interface ParsedProduct {
  product: MotoProduct;
  found: string[];
}

/** Lê um ou vários modelos de um texto livre (ficha do fornecedor, anotações, planilha colada). */
export function parseProducts(text: string): ParsedProduct[] {
  return blocksOf(text)
    .map((block) => {
      const p = newProduct();
      const found = new Set<string>();
      const extra: string[] = [];
      for (const line of block.filter(Boolean)) {
        const hit = labelled(line);
        if (hit) {
          found.add(hit.key);
          const v = hit.value;
          switch (hit.key) {
            case "name":
              if (!p.name) p.name = titleCase(v);
              break;
            case "kicker":
              p.kicker = v;
              break;
            case "pitch":
              p.pitch = v;
              break;
            case "forWho":
              p.forWho = v.replace(/^quem\s+/i, "");
              break;
            case "colors":
              p.colors = v
                .split(/\s*(?:,|\/|;|\be\b)\s*/i)
                .map((c) => titleCase(clean(c)))
                .filter(Boolean);
              break;
            case "purchase":
            case "freight":
            case "assembly":
            case "accessories":
            case "other":
              p.costs[hit.key] = parseMoney(v);
              break;
            case "taxPct":
            case "commissionPct":
              p.costs[hit.key] = pctOf(v);
              break;
            case "rate":
              p.rate = pctOf(v) || DEFAULT_RATE;
              break;
            case "installments":
              p.installments = Math.round(firstNumber(v, false)) || DEFAULT_INSTALLMENTS;
              break;
            case "price":
              p.price = parseMoney(v);
              break;
            default:
              p.specs[hit.key] = v;
          }
          continue;
        }
        const g = guessSpec(line);
        if (g && !found.has(g.key)) {
          p.specs[g.key] = g.value;
          found.add(g.key);
          continue;
        }
        // Primeira linha curta sem números: nome do modelo.
        if (!p.name && line.length <= 40 && !/\d{3,}/.test(line)) {
          p.name = titleCase(clean(line.replace(/^(scooter|moto)\s+(el[eé]trica\s+)?/i, "")));
          found.add("name");
          continue;
        }
        extra.push(clean(line));
      }
      if (!p.pitch && extra.length) p.pitch = extra.join(" ").slice(0, 220);
      p.slug = slugify(p.name);
      return { product: p, found: [...found] };
    })
    .filter((x) => x.product.name);
}
