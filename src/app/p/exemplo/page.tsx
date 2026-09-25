import type { Metadata } from "next";
import { ProposalDocument, type PublicProposal } from "@/components/proposal/document";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export const metadata: Metadata = { title: "Exemplo de proposta", robots: { index: false } };

const example: PublicProposal = {
  proposal: {
    number: 1024,
    title: "Residência",
    status: "enviada",
    final_price: 18990,
    power_kwp: 5.45,
    valid_until: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    accepted_at: null,
    accepted_by: null,
    inputs: {
      moduleBrand: "JA Solar",
      moduleModel: "JAM72D40 Bifacial",
      modulePowerW: 605,
      moduleQty: 9,
      inverterBrand: "Growatt",
      inverterModel: "MIN 5000TL-X",
      inverterPowerKw: 5,
      inverterQty: 1,
      structureType: "Telhado cerâmico",
      consumptionKwh: 600,
      tariff: 0.98,
      connectionType: "bi",
      sunHours: 5.2,
      performanceRatio: 0.8,
      tariffIncrease: 6,
      degradation: 0.5,
      selfConsumption: 30,
      fioBTariff: 0.28,
      publicLighting: 28,
      financingRate: 1.49,
      financingTerms: [24, 36, 48, 60, 72],
      cardInstallments: 18,
      cardRate: 1.99,
      validityDays: 10,
      installationDays: 40,
      paymentNotes: "Entrada via PIX com 3% de desconto adicional. Aceitamos cartão em até 18x e financiamento pelos principais bancos.",
    },
  },
  lead: { name: "Mariana Albuquerque", city: "Campinas", state: "SP", address: null },
  seller: { name: "Carlos Mendes", email: null, phone: null },
  settings: { ...DEFAULT_SETTINGS, company_name: "Quark Energia", whatsapp: "11999999999", email: "contato@quarkenergia.com.br", cnpj: "00.000.000/0001-00" },
};

export default function ExamplePage() {
  return <ProposalDocument data={example} token={null} />;
}
