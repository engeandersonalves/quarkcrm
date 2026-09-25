import type { ProposalInputs } from "./pricing.ts";
import type { SaveInputs } from "./save.ts";

export interface CompanySettings {
  company_name: string;
  legal_name: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  city: string;
  logo_url: string;
  instagram: string;
  about: string;
  seller_name: string;
  tech_name: string; // responsável técnico (assinatura das propostas)
  tech_registry: string; // registro profissional (CFT / CREA)
  notify_emails: string;
  warranty_modules_years: number;
  warranty_modules_performance_years: number;
  warranty_inverter_years: number;
  warranty_installation_years: number;
  warranty_structure_years: number;
  defaults: Partial<ProposalInputs>;
  /** Padrões do orçamento S.A.V.E (privado: contém custos). */
  saveDefaults: Partial<SaveInputs>;
  /** Kits salvos para preencher orçamentos com um clique (privado: nunca vai para a proposta). */
  kits: KitPreset[];
  /** Preferências do app: abertura, meta, frases e imagens (privado). */
  app: AppPrefs;
  /** O que aparece na proposta do cliente (público). */
  proposal: ProposalPrefs;
  /** Página de captura (pública): fotos dos telhados e condições de pagamento. */
  capture: CapturePrefs;
}

export type RoofKey = "ceramic" | "fiber" | "metal" | "slab" | "ground";

export interface CapturePrefs {
  roofImages: Partial<Record<RoofKey, string>>;
  paymentTitle: string;
  payments: { title: string; text: string }[];
}

/** Fotos padrão dos telhados (Wikimedia Commons, licenças livres). Troque pelas fotos das suas obras em Configurações → Captura. */
export const DEFAULT_ROOF_IMAGES: Record<RoofKey, string> = {
  ceramic: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Terracotta_clay_tile_%28Unsplash%29.jpg/500px-Terracotta_clay_tile_%28Unsplash%29.jpg",
  fiber: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Corrugated-fibro-roofing.jpg/500px-Corrugated-fibro-roofing.jpg",
  metal: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Corrugated_metal_roof.jpg/500px-Corrugated_metal_roof.jpg",
  slab: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Hatil_rooftop_solar_panels.jpg/500px-Hatil_rooftop_solar_panels.jpg",
  ground: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Ground_mounted_solar_panels.gk.jpg/500px-Ground_mounted_solar_panels.gk.jpg",
};

export const DEFAULT_CAPTURE: CapturePrefs = {
  roofImages: {},
  paymentTitle: "Condições que cabem no seu bolso",
  payments: [
    { title: "À vista", text: "Desconto especial no pagamento à vista" },
    { title: "Cartão de crédito", text: "Parcele no cartão" },
    { title: "Financiamento em até 72x", text: "Com a primeira parcela em até 3 meses" },
  ],
};

export interface KitPreset {
  id: string;
  name: string;
  kitPrice: number;
  moduleBrand: string;
  moduleModel: string;
  modulePowerW: number;
  moduleQty: number;
  inverterBrand: string;
  inverterModel: string;
  inverterPowerKw: number;
  inverterQty: number;
  structureType: string;
  moduleImage?: string;
  inverterImage?: string;
}

export type SplashMode = "always" | "daily" | "off";

export interface AppPrefs {
  splash: SplashMode;
  monthlyGoal: number; // R$ vendidos no mês
  monthlyGoalDeals: number; // nº de contratos no mês
  showTips: boolean;
  celebrate: boolean;
  useDefaultQuotes: boolean;
  customQuotes: { text: string; author: string }[];
  images: string[]; // URLs de imagens próprias para a abertura e o painel
}

export interface ProposalSections {
  howItWorks: boolean;
  bill: boolean;
  payback: boolean;
  generation: boolean;
  equipment: boolean;
  warranties: boolean;
  timeline: boolean;
  planet: boolean;
  faq: boolean;
  about: boolean;
}

export interface ProposalPrefs {
  coverImage: string; // foto da capa
  moduleImage: string; // foto padrão das placas
  inverterImage: string; // foto padrão do inversor
  gallery: string[]; // fotos de obras realizadas
  saveCoverImage: string; // capa da proposta S.A.V.E
  chargerImage: string; // foto padrão do carregador veicular
  headline: string; // título da capa (usa {nome})
  sections: ProposalSections;
  timeline: { day: number; title: string; text: string }[];
  faq: { q: string; a: string }[];
}

export const DEFAULT_INPUTS: ProposalInputs = {
  kitPrice: 0,
  inverterBrand: "",
  inverterModel: "",
  inverterPowerKw: 0,
  inverterQty: 1,
  moduleBrand: "",
  moduleModel: "",
  modulePowerW: 0,
  moduleQty: 0,
  structureType: "Telhado cerâmico",
  moduleImage: "",
  inverterImage: "",
  laborPerModule: 110,
  electricalPerKwp: 120,
  extraCosts: [],
  commission: { mode: "percent", value: 5 },
  tax: { mode: "percent", value: 6 },
  profit: { mode: "percent", value: 20 },
  discount: 0,
  roundTo: 10,
  consumptionKwh: 0,
  tariff: 0.95,
  connectionType: "bi",
  sunHours: 5.0,
  performanceRatio: 0.8,
  tariffIncrease: 6,
  degradation: 0.5,
  selfConsumption: 30,
  fioBTariff: 0.28,
  publicLighting: 25,
  financingRate: 1.49,
  financingTerms: [12, 24, 36, 48, 60, 72],
  cardInstallments: 12,
  cardRate: 1.99,
  validityDays: 10,
  installationDays: 40,
  paymentNotes: "",
  notes: "",
};

export const DEFAULT_SETTINGS: CompanySettings = {
  company_name: "Quark Energia",
  legal_name: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  address: "",
  city: "",
  logo_url: "",
  instagram: "",
  about:
    "Projetamos e instalamos sistemas de energia solar e pontos de recarga para veículos elétricos, com engenharia própria, equipamentos de primeira linha e acompanhamento do início ao fim.",
  seller_name: "",
  tech_name: "",
  tech_registry: "",
  notify_emails: "",
  warranty_modules_years: 12,
  warranty_modules_performance_years: 25,
  warranty_inverter_years: 10,
  warranty_installation_years: 1,
  warranty_structure_years: 12,
  defaults: {},
  saveDefaults: {},
  kits: [],
  app: {
    splash: "daily",
    monthlyGoal: 150000,
    monthlyGoalDeals: 6,
    showTips: true,
    celebrate: true,
    useDefaultQuotes: true,
    customQuotes: [],
    images: [],
  },
  proposal: {
    coverImage: "",
    moduleImage: "",
    inverterImage: "",
    gallery: [],
    saveCoverImage: "",
    chargerImage: "",
    headline: "",
    sections: {
      howItWorks: true,
      bill: true,
      payback: true,
      generation: true,
      equipment: true,
      warranties: true,
      timeline: true,
      planet: true,
      faq: true,
      about: true,
    },
    timeline: [],
    faq: [],
  },
  capture: DEFAULT_CAPTURE,
};

type StoredDefaults = Partial<ProposalInputs> & { kits?: KitPreset[]; app?: Partial<AppPrefs>; save?: Partial<SaveInputs> };

/**
 * Converte o JSON salvo no banco em configurações completas.
 * Kits e preferências do app ficam guardados dentro de "defaults" — chave que a função
 * pública da proposta remove — para que preços de kit e metas nunca cheguem ao cliente.
 */
export function mergeSettings(s: Partial<CompanySettings> | null | undefined): CompanySettings {
  const stored = (s?.defaults ?? {}) as StoredDefaults;
  const { kits, app, save, ...defaults } = stored;
  const proposal = (s?.proposal ?? {}) as Partial<ProposalPrefs>;
  return {
    ...DEFAULT_SETTINGS,
    ...(s ?? {}),
    defaults,
    kits: kits ?? s?.kits ?? [],
    saveDefaults: save ?? {},
    app: { ...DEFAULT_SETTINGS.app, ...(s?.app ?? {}), ...(app ?? {}) },
    capture: { ...DEFAULT_CAPTURE, ...((s?.capture ?? {}) as Partial<CapturePrefs>) },
    proposal: {
      ...DEFAULT_SETTINGS.proposal,
      ...proposal,
      sections: { ...DEFAULT_SETTINGS.proposal.sections, ...(proposal.sections ?? {}) },
    },
  };
}

/** Formato para salvar no banco (inverso de mergeSettings). */
export function toStoredSettings(s: CompanySettings) {
  const { kits, app, saveDefaults, defaults, ...rest } = s;
  return { ...rest, defaults: { ...defaults, kits, app, save: saveDefaults } };
}

export function mergeInputs(...parts: (Partial<ProposalInputs> | null | undefined)[]): ProposalInputs {
  return Object.assign({}, DEFAULT_INPUTS, ...parts.map((p) => p ?? {}));
}
