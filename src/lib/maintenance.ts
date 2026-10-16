/**
 * Manutenção solar — orçamento direto: valor por placa × número de placas, tudo incluso.
 * Serviços aparecem como "incluso"; peças de troca aparecem como "se necessário", sem quantidade.
 */

export type MaintIcon = "droplets" | "scan" | "thermo" | "frame" | "plug" | "gauge" | "ground" | "panel" | "shield" | "toggle" | "cable" | "cpu" | "phone" | "report" | "truck" | "ladder";

export interface MaintService {
  key: string;
  label: string;
  short: string;
  icon: MaintIcon;
  /** Vem marcado em orçamentos novos. */
  on: boolean;
}

/** Serviços inclusos na visita. */
export const MAINT_SERVICES: MaintService[] = [
  { key: "limpeza", label: "Limpeza das placas", short: "Água desmineralizada e escovas macias, sem riscar o vidro.", icon: "droplets", on: true },
  { key: "inspecao", label: "Inspeção dos módulos", short: "Trincas, bolhas, caixas de junção e sinais de queima.", icon: "scan", on: true },
  { key: "conectores", label: "Reaperto dos conectores", short: "Conectores MC4 firmes, sem aquecimento nem oxidação.", icon: "plug", on: true },
  { key: "estrutura", label: "Reaperto da estrutura", short: "Parafusos e grampos firmes, sem corrosão.", icon: "frame", on: true },
  { key: "aterramento", label: "Aferição do aterramento", short: "Medição com terrômetro e revisão das conexões.", icon: "ground", on: true },
  { key: "quadro", label: "Manutenção do quadro elétrico", short: "Limpeza e reaperto de bornes, barramentos e proteções.", icon: "panel", on: true },
  { key: "medicoes", label: "Medição das strings", short: "Tensão, corrente e isolamento conferidos.", icon: "gauge", on: true },
  { key: "inversor", label: "Revisão do inversor", short: "Ventilação, alarmes e parâmetros de rede.", icon: "cpu", on: true },
  { key: "app", label: "Conexão do aplicativo", short: "Monitoramento configurado no seu celular.", icon: "phone", on: true },
  { key: "termografia", label: "Termografia", short: "Câmera térmica para achar pontos quentes.", icon: "thermo", on: false },
  { key: "relatorio", label: "Relatório com fotos", short: "Antes e depois, medições e recomendações.", icon: "report", on: true },
  { key: "deslocamento", label: "Deslocamento", short: "Equipe, ferramentas e instrumentos até você.", icon: "truck", on: true },
];

/** Peças trocadas só se a vistoria mostrar necessidade. */
export const MAINT_PARTS: MaintService[] = [
  { key: "dps", label: "DPS", short: "Protetor contra surtos", icon: "shield", on: true },
  { key: "disjuntores", label: "Disjuntores", short: "Proteção dos circuitos", icon: "toggle", on: true },
  { key: "mc4", label: "Conectores MC4", short: "Conexões das placas", icon: "plug", on: true },
  { key: "terminais", label: "Terminais elétricos", short: "Pontas dos cabos", icon: "cable", on: true },
];

export const serviceOf = (key: string) => MAINT_SERVICES.find((s) => s.key === key) ?? MAINT_PARTS.find((s) => s.key === key);

export type FindingSeverity = "ok" | "atencao" | "critico";
export interface MaintFinding {
  id: string;
  title: string;
  text: string;
  severity: FindingSeverity;
  photo: string;
}

export interface MaintInputs {
  product: "manutencao";
  // Sistema
  moduleQty: number;
  modulePowerW: number;
  inverterQty: number;
  inverterBrand: string;
  // Escopo
  services: string[];
  parts: string[];
  findings: MaintFinding[];
  // Valor
  pricePerModule: number;
  cardInstallments: number;
  paymentNotes: string;
  // Condições
  validityDays: number;
  scheduleDays: number;
  serviceWarrantyDays: number;
  conditions: string[];
  coverImage: string;
  // Estimativa de perda (opcional)
  showLoss: boolean;
  soilingPct: number;
  tariff: number;
  sunHours: number;
  performanceRatio: number;
  // Privado
  notes: string;
}

export const DEFAULT_MAINT_CONDITIONS = [
  "Itens marcados como “se necessário” só são trocados se a vistoria indicar, com a sua aprovação antes.",
  "Com chuva ou ventos fortes, a visita é reagendada sem custo.",
  "A garantia não cobre descargas atmosféricas nem intervenção de terceiros.",
];

export const DEFAULT_MAINT: MaintInputs = {
  product: "manutencao",
  moduleQty: 12,
  modulePowerW: 550,
  inverterQty: 1,
  inverterBrand: "",
  services: MAINT_SERVICES.filter((s) => s.on).map((s) => s.key),
  parts: MAINT_PARTS.map((s) => s.key),
  findings: [],
  pricePerModule: 25,
  cardInstallments: 3,
  paymentNotes: "",
  validityDays: 10,
  scheduleDays: 5,
  serviceWarrantyDays: 90,
  conditions: DEFAULT_MAINT_CONDITIONS,
  coverImage: "",
  showLoss: true,
  soilingPct: 12,
  tariff: 0.95,
  sunHours: 5,
  performanceRatio: 0.8,
  notes: "",
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function mergeMaint(...parts: (Partial<MaintInputs> | null | undefined)[]): MaintInputs {
  const merged = Object.assign({}, DEFAULT_MAINT, ...parts.map((p) => p ?? {})) as MaintInputs;
  return {
    ...merged,
    services: Array.isArray(merged.services) ? merged.services : DEFAULT_MAINT.services,
    parts: Array.isArray(merged.parts) ? merged.parts : DEFAULT_MAINT.parts,
    findings: Array.isArray(merged.findings) ? merged.findings : [],
    conditions: Array.isArray(merged.conditions) ? merged.conditions : DEFAULT_MAINT_CONDITIONS,
    product: "manutencao",
  };
}

export const kwpOf = (i: Pick<MaintInputs, "moduleQty" | "modulePowerW">) => (n(i.moduleQty) * n(i.modulePowerW)) / 1000;

/** Valor final: placas × valor por placa. */
export const maintTotal = (i: Pick<MaintInputs, "moduleQty" | "pricePerModule">) => Math.round(n(i.moduleQty) * n(i.pricePerModule) * 100) / 100;

/** Estimativa da energia que a sujeira está levando. */
export function soilingLoss(i: Pick<MaintInputs, "moduleQty" | "modulePowerW" | "sunHours" | "performanceRatio" | "soilingPct" | "tariff">) {
  const monthlyKwh = kwpOf(i) * n(i.sunHours) * 30 * n(i.performanceRatio);
  const lostKwh = monthlyKwh * (n(i.soilingPct) / 100);
  return { monthlyKwh, lostKwh, lostMonth: lostKwh * n(i.tariff), lostYear: lostKwh * 12 * n(i.tariff) };
}

export const SEVERITY: Record<FindingSeverity, { label: string; color: string; bg: string }> = {
  ok: { label: "Em ordem", color: "#2C7A52", bg: "#E9F5EE" },
  atencao: { label: "Atenção", color: "#9A6A00", bg: "#FDF4DC" },
  critico: { label: "Crítico", color: "#B42318", bg: "#FDECEA" },
};

/** Seções da proposta pública que o rastreamento acompanha (id → nome). */
export const MAINT_SECTIONS: { id: string; label: string }[] = [
  { id: "capa", label: "Capa" },
  { id: "servicos", label: "O que está incluso" },
  { id: "investimento", label: "Valor" },
  { id: "diagnostico", label: "Diagnóstico da vistoria" },
  { id: "mapa", label: "Mapa do sistema" },
  { id: "visita", label: "Como funciona" },
  { id: "condicoes", label: "Garantia e condições" },
];

export const TRACK_CLICKS: Record<string, string> = {
  aceitar: "Abriu o aceite",
  aceite: "Aceitou a proposta",
  whatsapp: "Chamou no WhatsApp",
  pdf: "Baixou o PDF",
};
