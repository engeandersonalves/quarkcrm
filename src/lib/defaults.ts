import type { ProposalInputs } from "./pricing.ts";

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
  notify_emails: string;
  warranty_modules_years: number;
  warranty_modules_performance_years: number;
  warranty_inverter_years: number;
  warranty_installation_years: number;
  defaults: Partial<ProposalInputs>;
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
  simultaneity: 100,
  financingRate: 1.49,
  financingTerms: [12, 24, 36, 48, 60, 72],
  cardInstallments: 12,
  cardRate: 1.99,
  validityDays: 10,
  installationDays: 30,
  paymentNotes: "",
  notes: "",
};

export const DEFAULT_SETTINGS: CompanySettings = {
  company_name: "Quark Energia Solar",
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
    "Projetamos e instalamos sistemas fotovoltaicos com engenharia própria, equipamentos de primeira linha e acompanhamento do início ao fim — da análise da sua conta até a homologação na concessionária.",
  seller_name: "",
  notify_emails: "",
  warranty_modules_years: 12,
  warranty_modules_performance_years: 25,
  warranty_inverter_years: 10,
  warranty_installation_years: 1,
  defaults: {},
};

export function mergeSettings(s: Partial<CompanySettings> | null | undefined): CompanySettings {
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), defaults: { ...(s?.defaults ?? {}) } };
}

export function mergeInputs(...parts: (Partial<ProposalInputs> | null | undefined)[]): ProposalInputs {
  return Object.assign({}, DEFAULT_INPUTS, ...parts.map((p) => p ?? {}));
}
