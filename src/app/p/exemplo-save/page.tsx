import type { Metadata } from "next";
import type { PublicProposal } from "@/components/proposal/document";
import { SaveDocument } from "@/components/save/document";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export const metadata: Metadata = { title: "Exemplo de proposta S.A.V.E", robots: { index: false } };

const example: PublicProposal = {
  proposal: {
    number: 225,
    title: "Carregador 22 kW",
    status: "enviada",
    final_price: 8997,
    power_kwp: 22,
    valid_until: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    accepted_at: null,
    accepted_by: null,
    inputs: {
      product: "save",
      chargerPowerKw: 22,
      phases: "tri",
      currentA: 32,
      connector: "Tipo 2",
      chargerBrands: "Belenus, Joult ou Riseon",
      distanceM: 50,
      includePanel: true,
      includeEmergency: true,
      includeSocket: true,
      executionDays: 5,
      validityDays: 7,
      installWarrantyMonths: 6,
      factoryWarrantyYears: 1,
      paymentNotes: "À vista (espécie ou Pix) ou cartão de crédito em até 12x.",
      cardInstallments: 12,
      cardRate: 1.99,
    },
  },
  lead: { name: "Morais Construções", city: "Maceió", state: "AL", address: null },
  seller: { name: "Anderson Alves", email: null, phone: null },
  settings: {
    ...DEFAULT_SETTINGS,
    company_name: "Quark Energia",
    whatsapp: "82991831476",
    instagram: "quarkenergia",
    city: "Maceió – AL",
    tech_name: "Eletrotécnico José Anderson da Silva Alves",
    tech_registry: "CFT 08496016498",
  },
};

export default function ExampleSavePage() {
  return <SaveDocument data={example} token={null} />;
}
