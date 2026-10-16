import type { Metadata } from "next";
import { MaintenanceDocument } from "@/components/maintenance/document";
import type { PublicProposal } from "@/components/proposal/document";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { buildClientItems, calcMaint, mergeMaint } from "@/lib/maintenance";

export const metadata: Metadata = { title: "Exemplo de proposta de manutenção", robots: { index: false } };

const inputs = mergeMaint({
  moduleQty: 16,
  modulePowerW: 550,
  stringQty: 2,
  inverterQty: 1,
  panelQty: 2,
  inverterBrand: "Growatt MIN 8000TL-X",
  moduleBrand: "Canadian Solar",
  installYear: 2021,
  lastCleaning: "Nunca foi feita",
  distanceKm: 18,
  showItemPrices: true,
  findings: [
    { id: "f1", title: "Módulos com sujeira acumulada", text: "Película de poeira e fezes de pássaros nas placas da parte de baixo.", severity: "atencao", photo: "" },
    { id: "f2", title: "DPS com sinalizador de fim de vida", text: "O DPS CC da string box está com a janela vermelha: não protege mais contra surtos.", severity: "critico", photo: "" },
    { id: "f3", title: "Estrutura firme e sem corrosão", text: "", severity: "ok", photo: "" },
  ],
});
const result = calcMaint(inputs);
const example: PublicProposal = {
  proposal: {
    number: 318,
    title: "Manutenção preventiva",
    status: "enviada",
    final_price: result.finalPrice,
    power_kwp: 8.8,
    valid_until: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    accepted_at: null,
    accepted_by: null,
    inputs: { ...inputs, clientItems: buildClientItems(inputs, result), extraCosts: undefined } as unknown as PublicProposal["proposal"]["inputs"],
  },
  lead: { name: "Residência Ana Paula", city: "Maceió", state: "AL", address: "Ponta Verde" },
  seller: { name: "Anderson Alves", email: null, phone: null },
  settings: { ...DEFAULT_SETTINGS, company_name: "Quark Energia", whatsapp: "82991831476", instagram: "quarkenergia", city: "Maceió – AL" },
};

export default function ExampleMaintenancePage() {
  return <MaintenanceDocument data={example} token={null} />;
}
