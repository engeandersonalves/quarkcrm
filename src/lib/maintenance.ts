/**
 * Manutenção solar — orçamento por serviços (qtd × valor unitário) com a mesma formação de preço da solar.
 *
 * Os custos ficam em `extraCosts` e a margem em `commission`/`tax`/`profit`/`discount`/`roundTo`/`notes`,
 * chaves que a função pública da proposta remove. O cliente recebe só `clientItems`, montado ao salvar:
 * o nome do serviço, a quantidade e (se o vendedor quiser mostrar) o valor de venda de cada um.
 */
import { applyPricing, pmt, type PriceComponent } from "./pricing.ts";

export type MaintBasis = "modulo" | "string" | "inversor" | "quadro" | "sistema" | "km" | "unidade";
export type MaintCategory = "modulos" | "estrutura" | "cc" | "aterramento" | "quadro" | "inversor" | "entrega";
export type MaintIcon = "droplets" | "scan" | "thermo" | "frame" | "plug" | "gauge" | "ground" | "panel" | "shield" | "toggle" | "cable" | "cpu" | "phone" | "report" | "truck" | "ladder";

export interface MaintService {
  key: string;
  category: MaintCategory;
  label: string;
  basis: MaintBasis;
  unit: number; // custo por unidade (R$)
  on: boolean;
  /** Troca de peça: só se a vistoria mostrar necessidade. */
  conditional?: boolean;
  icon: MaintIcon;
  what: string;
  why: string;
}

export const MAINT_CATEGORIES: Record<MaintCategory, { label: string; short: string }> = {
  modulos: { label: "Módulos fotovoltaicos", short: "Módulos" },
  estrutura: { label: "Estrutura de fixação", short: "Estrutura" },
  cc: { label: "Cabos e conectores (CC)", short: "Lado CC" },
  aterramento: { label: "Aterramento", short: "Aterramento" },
  quadro: { label: "Quadro elétrico e proteções", short: "Quadro" },
  inversor: { label: "Inversor e monitoramento", short: "Inversor" },
  entrega: { label: "Logística e entrega", short: "Entrega" },
};

export const BASIS_LABEL: Record<MaintBasis, { one: string; many: string }> = {
  modulo: { one: "módulo", many: "módulos" },
  string: { one: "string", many: "strings" },
  inversor: { one: "inversor", many: "inversores" },
  quadro: { one: "quadro", many: "quadros" },
  sistema: { one: "sistema", many: "sistemas" },
  km: { one: "km", many: "km" },
  unidade: { one: "un", many: "un" },
};

export const MAINT_CATALOG: MaintService[] = [
  {
    key: "limpeza",
    category: "modulos",
    label: "Limpeza técnica dos módulos",
    basis: "modulo",
    unit: 12,
    on: true,
    icon: "droplets",
    what: "Lavagem com água desmineralizada e escovas macias próprias para vidro solar, sem produtos abrasivos. Remove poeira, fuligem, fezes de pássaros e limo.",
    why: "A sujeira bloqueia a luz e pode derrubar a geração entre 5% e 25%. Manchas localizadas ainda criam pontos quentes que envelhecem a placa.",
  },
  {
    key: "inspecao",
    category: "modulos",
    label: "Inspeção visual dos módulos",
    basis: "modulo",
    unit: 2,
    on: true,
    icon: "scan",
    what: "Verificação de trincas, quebras, delaminação, bolhas, caixas de junção, vedação e sinais de queima em cada placa.",
    why: "Defeitos encontrados cedo podem ser acionados na garantia do fabricante, antes de afetar o resto da string.",
  },
  {
    key: "termografia",
    category: "modulos",
    label: "Termografia com câmera térmica",
    basis: "sistema",
    unit: 250,
    on: false,
    icon: "thermo",
    what: "Imagens térmicas dos módulos, conectores e quadros com o sistema em plena geração.",
    why: "Revela pontos quentes invisíveis a olho nu: células danificadas, diodos de bypass queimados e conexões com mau contato.",
  },
  {
    key: "estrutura",
    category: "estrutura",
    label: "Revisão e reaperto da estrutura",
    basis: "sistema",
    unit: 150,
    on: true,
    icon: "frame",
    what: "Reaperto de parafusos, grampos e ganchos; verificação de corrosão, vedação das telhas e pontos de infiltração.",
    why: "Ventos fortes exigem a estrutura firme. Corrosão e infiltração começam justamente nos pontos soltos.",
  },
  {
    key: "conectores",
    category: "cc",
    label: "Inspeção e reaperto dos conectores",
    basis: "string",
    unit: 30,
    on: true,
    icon: "plug",
    what: "Conferência de encaixe e travas dos conectores MC4, sinais de aquecimento, oxidação e cabos ressecados ou expostos ao sol.",
    why: "Conector frouxo aquece, perde energia e é a principal causa de arco elétrico e incêndio em sistemas fotovoltaicos.",
  },
  {
    key: "troca_mc4",
    category: "cc",
    label: "Troca de conectores MC4 (par)",
    basis: "unidade",
    unit: 45,
    on: true,
    conditional: true,
    icon: "plug",
    what: "Substituição de pares danificados, derretidos ou de marcas diferentes, com crimpagem por ferramenta própria.",
    why: "Conectores de marcas misturadas ou mal crimpados estão entre as maiores causas de falha e aquecimento.",
  },
  {
    key: "medicoes",
    category: "cc",
    label: "Medição das strings (Voc, Isc e isolamento)",
    basis: "string",
    unit: 35,
    on: true,
    icon: "gauge",
    what: "Tensão de circuito aberto, corrente de curto-circuito e resistência de isolamento com megômetro, comparadas aos valores de projeto.",
    why: "Mostra se alguma placa ou string está gerando menos e detecta fuga de corrente antes que vire falha ou desligamento.",
  },
  {
    key: "aterramento",
    category: "aterramento",
    label: "Aferição do aterramento",
    basis: "sistema",
    unit: 180,
    on: true,
    icon: "ground",
    what: "Medição da resistência de aterramento com terrômetro, inspeção das hastes e conexões e da equipotencialização da estrutura e dos módulos.",
    why: "Um aterramento eficiente protege as pessoas contra choque e os equipamentos contra surtos e descargas atmosféricas.",
  },
  {
    key: "quadro",
    category: "quadro",
    label: "Manutenção do quadro elétrico",
    basis: "quadro",
    unit: 120,
    on: true,
    icon: "panel",
    what: "Limpeza interna, reaperto de bornes e barramentos, verificação de aquecimento, identificação dos circuitos e vedação contra água e insetos (string box e quadro CA).",
    why: "Bornes se afrouxam com a dilatação do dia a dia. É no quadro que surgem os principais pontos de risco elétrico.",
  },
  {
    key: "dps",
    category: "quadro",
    label: "Troca de DPS (protetor contra surtos)",
    basis: "unidade",
    unit: 160,
    on: true,
    conditional: true,
    icon: "shield",
    what: "Substituição de DPS CC ou CA com sinalizador de fim de vida ou danificado por surto, com modelo dimensionado para o sistema.",
    why: "Depois de absorver surtos, o DPS deixa de proteger. Com ele vencido, o próximo raio atinge direto o inversor.",
  },
  {
    key: "disjuntores",
    category: "quadro",
    label: "Troca de disjuntores",
    basis: "unidade",
    unit: 90,
    on: true,
    conditional: true,
    icon: "toggle",
    what: "Substituição de disjuntores aquecidos, desarmando sem motivo ou com capacidade diferente da do circuito.",
    why: "Um disjuntor desgastado pode não desarmar numa sobrecarga, ou desarmar à toa e parar a geração.",
  },
  {
    key: "terminais",
    category: "quadro",
    label: "Troca de terminais elétricos",
    basis: "unidade",
    unit: 6,
    on: true,
    conditional: true,
    icon: "cable",
    what: "Troca de terminais oxidados, mal crimpados ou escurecidos por calor por terminais tubulares ou olhal novos.",
    why: "Terminais ruins aumentam a resistência da conexão: viram calor, perda de energia e risco de queima.",
  },
  {
    key: "inversor",
    category: "inversor",
    label: "Revisão do inversor",
    basis: "inversor",
    unit: 120,
    on: true,
    icon: "cpu",
    what: "Limpeza de dissipadores e ventoinhas, leitura do histórico de alarmes, conferência dos parâmetros de rede e atualização de firmware quando disponível.",
    why: "Inversor superaquecido reduz a potência para se proteger e tem a vida útil encurtada.",
  },
  {
    key: "app",
    category: "inversor",
    label: "Conexão do aplicativo de monitoramento",
    basis: "inversor",
    unit: 90,
    on: true,
    icon: "phone",
    what: "Configuração do Wi-Fi ou datalogger, criação ou recuperação do acesso e instalação do app no celular, com orientação de uso.",
    why: "Com o app ativo você acompanha a geração todo dia e descobre uma parada na hora, não na conta de luz do mês seguinte.",
  },
  {
    key: "altura",
    category: "entrega",
    label: "Acesso em altura (andaime ou linha de vida)",
    basis: "sistema",
    unit: 250,
    on: false,
    icon: "ladder",
    what: "Montagem de andaime, linha de vida ou plataforma para acesso seguro a telhados altos ou de difícil acesso.",
    why: "Trabalho em altura com segurança, conforme a NR-35, sem risco para a equipe nem para o seu telhado.",
  },
  {
    key: "relatorio",
    category: "entrega",
    label: "Relatório técnico com fotos",
    basis: "sistema",
    unit: 0,
    on: true,
    icon: "report",
    what: "Fotos de antes e depois, medições registradas, itens corrigidos e recomendações para os próximos meses.",
    why: "Documenta o estado do sistema e serve de prova em acionamentos de garantia do fabricante.",
  },
  {
    key: "deslocamento",
    category: "entrega",
    label: "Deslocamento da equipe",
    basis: "km",
    unit: 1.8,
    on: true,
    icon: "truck",
    what: "Ida e volta da equipe técnica com veículo, ferramentas e equipamentos de medição.",
    why: "",
  },
];

export const catalogOf = (key: string) => MAINT_CATALOG.find((s) => s.key === key);

export interface MaintItem {
  id: string;
  key: string; // chave do catálogo ou "custom"
  label: string;
  qty: number; // usada nas bases "unidade" (as outras vêm do sistema)
  unit: number;
  value: number;
  on: boolean;
  basis?: MaintBasis;
  conditional?: boolean;
}

export type FindingSeverity = "ok" | "atencao" | "critico";
export interface MaintFinding {
  id: string;
  title: string;
  text: string;
  severity: FindingSeverity;
  photo: string;
}

/** O que o cliente vê de cada serviço (montado ao salvar). */
export interface MaintClientItem {
  key: string;
  label: string;
  qtyLabel: string;
  price: number | null;
  conditional: boolean;
}

export interface MaintInputs {
  product: "manutencao";
  // Sistema
  moduleQty: number;
  modulePowerW: number;
  stringQty: number;
  inverterQty: number;
  panelQty: number;
  inverterBrand: string;
  moduleBrand: string;
  structure: string;
  roofAccess: "facil" | "medio" | "dificil";
  installYear: number;
  lastCleaning: string;
  hasMonitoring: boolean;
  distanceKm: number;
  // Estimativa de perda
  soilingPct: number;
  tariff: number;
  sunHours: number;
  performanceRatio: number;
  // Diagnóstico
  findings: MaintFinding[];
  // Visita
  serviceHours: number;
  scheduleDays: number;
  // Plano recorrente
  planEnabled: boolean;
  planVisitsYear: number;
  planDiscountPct: number;
  // Custos (privados)
  extraCosts: MaintItem[];
  commission: PriceComponent;
  tax: PriceComponent;
  profit: PriceComponent;
  discount: number;
  roundTo: number;
  notes: string;
  // Proposta
  clientItems: MaintClientItem[];
  showItemPrices: boolean;
  coverImage: string;
  highlights: string[];
  validityDays: number;
  serviceWarrantyDays: number;
  paymentNotes: string;
  cardInstallments: number;
  cardRate: number;
  conditions: string[];
}

export const DEFAULT_MAINT_HIGHLIGHTS = [
  "Equipe própria com treinamento NR-10 (eletricidade) e NR-35 (altura)",
  "Água desmineralizada e escovas próprias: sem riscos no vidro nem perda de garantia",
  "Desligamento seguro do sistema antes de qualquer intervenção",
  "Instrumentos calibrados: terrômetro, megômetro, multímetro e alicate amperímetro",
];

export const DEFAULT_MAINT_CONDITIONS = [
  "Peças marcadas como “se necessário” (DPS, disjuntores, conectores e terminais) só são trocadas com a sua aprovação, após a vistoria, e cobradas pela quantidade realmente usada.",
  "Defeitos de fabricação encontrados nos módulos ou no inversor são documentados no relatório para acionamento da garantia junto ao fabricante.",
  "A visita depende de condições de tempo seguras: com chuva ou ventos fortes, ela é reagendada sem custo.",
  "A garantia do serviço não cobre danos por descargas atmosféricas, intervenção de terceiros ou eventos externos.",
];

export function defaultMaintItems(): MaintItem[] {
  return MAINT_CATALOG.map((s) => ({ id: s.key, key: s.key, label: s.label, qty: s.basis === "unidade" ? (s.key === "terminais" ? 8 : s.key === "troca_mc4" ? 2 : 1) : 1, unit: s.unit, value: 0, on: s.on, basis: s.basis, conditional: s.conditional }));
}

export const DEFAULT_MAINT: MaintInputs = {
  product: "manutencao",
  moduleQty: 12,
  modulePowerW: 550,
  stringQty: 2,
  inverterQty: 1,
  panelQty: 1,
  inverterBrand: "",
  moduleBrand: "",
  structure: "Telhado cerâmico",
  roofAccess: "medio",
  installYear: 0,
  lastCleaning: "",
  hasMonitoring: false,
  distanceKm: 20,
  soilingPct: 12,
  tariff: 0.95,
  sunHours: 5,
  performanceRatio: 0.8,
  findings: [],
  serviceHours: 4,
  scheduleDays: 5,
  planEnabled: true,
  planVisitsYear: 2,
  planDiscountPct: 15,
  extraCosts: defaultMaintItems(),
  commission: { mode: "percent", value: 5 },
  tax: { mode: "percent", value: 6 },
  profit: { mode: "percent", value: 25 },
  discount: 0,
  roundTo: 10,
  notes: "",
  clientItems: [],
  showItemPrices: false,
  coverImage: "",
  highlights: DEFAULT_MAINT_HIGHLIGHTS,
  validityDays: 10,
  serviceWarrantyDays: 90,
  paymentNotes: "À vista (Pix ou espécie) após a execução, ou cartão de crédito.",
  cardInstallments: 6,
  cardRate: 1.99,
  conditions: DEFAULT_MAINT_CONDITIONS,
};

/** Junta padrões + salvos. Serviços novos do catálogo entram desligados em orçamentos antigos. */
export function mergeMaint(...parts: (Partial<MaintInputs> | null | undefined)[]): MaintInputs {
  const merged = Object.assign({}, DEFAULT_MAINT, ...parts.map((p) => p ?? {})) as MaintInputs;
  const items = Array.isArray(merged.extraCosts) && merged.extraCosts.length ? merged.extraCosts : defaultMaintItems();
  const missing = MAINT_CATALOG.filter((s) => !items.some((it) => it.key === s.key)).map((s) => ({ ...defaultMaintItems().find((d) => d.key === s.key)!, on: false }));
  return { ...merged, extraCosts: [...items, ...missing], product: "manutencao" };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const kwpOf = (i: Pick<MaintInputs, "moduleQty" | "modulePowerW">) => (n(i.moduleQty) * n(i.modulePowerW)) / 1000;

export function basisOf(it: MaintItem): MaintBasis {
  return it.basis ?? catalogOf(it.key)?.basis ?? "unidade";
}

/** Quantidade efetiva de um item: as bases do sistema acompanham os dados informados. */
export function qtyOf(it: MaintItem, i: MaintInputs) {
  switch (basisOf(it)) {
    case "modulo":
      return n(i.moduleQty);
    case "string":
      return Math.max(1, n(i.stringQty));
    case "inversor":
      return Math.max(1, n(i.inverterQty));
    case "quadro":
      return Math.max(1, n(i.panelQty));
    case "sistema":
      return 1;
    case "km":
      return n(i.distanceKm) * 2; // ida e volta
    default:
      return n(it.qty);
  }
}

export function qtyLabel(it: MaintItem, i: MaintInputs) {
  const b = basisOf(it);
  const q = qtyOf(it, i);
  if (b === "sistema") return "Sistema completo";
  if (b === "km") return `${fmt(q)} km (ida e volta)`;
  const l = BASIS_LABEL[b];
  return `${fmt(q)} ${q === 1 ? l.one : l.many}`;
}

export const activeMaintItems = (i: MaintInputs) => (i.extraCosts ?? []).filter((it) => it.on);

export function calcMaint(i: MaintInputs) {
  const lines = activeMaintItems(i).map((it) => {
    const qty = qtyOf(it, i);
    return { key: it.id, label: it.label || "Serviço", detail: qty !== 1 ? `${fmt(qty)} × ${fmtBRL(n(it.unit))}` : undefined, value: qty * n(it.unit), item: it };
  });
  const directCost = lines.reduce((s, l) => s + l.value, 0);
  const p = applyPricing(directCost, i);
  // Valor de venda de cada serviço: o custo dele na mesma proporção do preço final
  const factor = directCost > 0 && p.valid ? p.finalPrice / directCost : 0;
  let acc = 0;
  const priced = lines.map((l, idx) => {
    const isLast = idx === lines.length - 1;
    const price = isLast ? Math.max(0, Math.round((p.finalPrice - acc) * 100) / 100) : Math.round(l.value * factor * 100) / 100;
    acc += price;
    return { ...l, price };
  });
  return { lines: priced, ...p };
}

/** Itens que vão para a proposta pública (sem custos). O deslocamento entra no total, mas não como linha. */
export function buildClientItems(i: MaintInputs, result: ReturnType<typeof calcMaint>): MaintClientItem[] {
  return result.lines
    .filter((l) => l.item.key !== "deslocamento")
    .map((l) => ({
      key: l.item.key,
      label: l.label,
      qtyLabel: qtyLabel(l.item, i),
      price: i.showItemPrices ? l.price : null,
      conditional: !!(l.item.conditional ?? catalogOf(l.item.key)?.conditional),
    }));
}

/** Estimativa da energia que a sujeira está levando. */
export function soilingLoss(i: Pick<MaintInputs, "moduleQty" | "modulePowerW" | "sunHours" | "performanceRatio" | "soilingPct" | "tariff">) {
  const monthlyKwh = kwpOf(i) * n(i.sunHours) * 30 * n(i.performanceRatio);
  const lostKwh = monthlyKwh * (n(i.soilingPct) / 100);
  return { monthlyKwh, lostKwh, lostMonth: lostKwh * n(i.tariff), lostYear: lostKwh * 12 * n(i.tariff) };
}

/** Plano recorrente: preço por visita com desconto e total anual. */
export function planOf(price: number, i: Pick<MaintInputs, "planEnabled" | "planVisitsYear" | "planDiscountPct" | "roundTo">) {
  if (!i.planEnabled || n(i.planVisitsYear) < 2) return null;
  const step = n(i.roundTo) > 0 ? n(i.roundTo) : 1;
  const perVisit = Math.ceil((price * (1 - n(i.planDiscountPct) / 100)) / step) * step;
  const year = perVisit * n(i.planVisitsYear);
  return { perVisit, year, monthly: year / 12, saving: price * n(i.planVisitsYear) - year, visits: n(i.planVisitsYear) };
}

export function maintCardInstallment(price: number, i: Pick<MaintInputs, "cardInstallments" | "cardRate">) {
  return i.cardInstallments > 1 ? pmt(price, i.cardRate, i.cardInstallments) : 0;
}

export const SEVERITY: Record<FindingSeverity, { label: string; color: string; bg: string }> = {
  ok: { label: "Em ordem", color: "#2C7A52", bg: "#E9F5EE" },
  atencao: { label: "Atenção", color: "#9A6A00", bg: "#FDF4DC" },
  critico: { label: "Crítico", color: "#B42318", bg: "#FDECEA" },
};

export const ACCESS_LABEL: Record<MaintInputs["roofAccess"], string> = { facil: "Fácil", medio: "Médio", dificil: "Difícil (altura)" };

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/** Seções da proposta pública que o rastreamento acompanha (id → nome). */
export const MAINT_SECTIONS: { id: string; label: string }[] = [
  { id: "capa", label: "Capa" },
  { id: "perda", label: "Quanto a sujeira custa" },
  { id: "diagnostico", label: "Diagnóstico da vistoria" },
  { id: "mapa", label: "Mapa do sistema" },
  { id: "servicos", label: "Serviços inclusos" },
  { id: "visita", label: "Como é a visita" },
  { id: "entregas", label: "O que você recebe" },
  { id: "investimento", label: "Investimento" },
  { id: "plano", label: "Plano preventivo" },
  { id: "condicoes", label: "Garantia e condições" },
];

export const TRACK_CLICKS: Record<string, string> = {
  aceitar: "Abriu o aceite",
  aceite: "Aceitou a proposta",
  whatsapp: "Chamou no WhatsApp",
  pdf: "Baixou o PDF",
  plano: "Viu os detalhes do plano",
};
