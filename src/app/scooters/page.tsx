import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BioLanding } from "@/components/mobilidade/bio-landing";
import { SCOOTERS } from "@/lib/catalog-mobilidade";
import { loadCatalogModels, loadCatalogPhotos } from "@/lib/catalog-photos";
import { defaultMoto } from "@/lib/moto-sale";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Scooters elétricas com garantia · Quark Mobilidade" },
  description: "Scooters elétricas 1.000W sem CNH e sem placa, com garantia, contrato, comprovante de propriedade e cartão do proprietário com QR. Desde 2020 em Maceió. Vendemos para revenda.",
  openGraph: {
    title: "Chega de gasolina. Vá de scooter elétrica · Quark Mobilidade",
    description: "Sem CNH e sem placa. Garantia, contrato e cartão do proprietário com verificação oficial. Desde 2020.",
    images: ["/mob/vida-1.jpg"],
  },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

/** Cartão do proprietário de exemplo, com dados fictícios, para mostrar o documento que o cliente recebe. */
async function sampleCard(origin: string, companyName: string, whatsapp: string | null) {
  try {
    const d = defaultMoto({
      contractor: { name: companyName, doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" },
      model: "t1",
    });
    d.client = { ...d.client, name: "Seu Nome Completo", doc: "00000000000" };
    d.color = "Preta";
    d.year = new Date().getFullYear();
    d.chassis = "QK25T1000123";
    d.motorNo = "MT1000-00001";
    d.date = new Date().toISOString().slice(0, 10);
    const QR = await import("qrcode");
    const qr = await QR.toDataURL(`${origin}/verificar`, { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: "#0B1A12", light: "#FFFFFF" } });
    const n = (whatsapp ?? "").replace(/\D/g, "");
    const contact = n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : "";
    return { d, qr, contact };
  } catch {
    return null;
  }
}

export default async function ScootersPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;
  const [company, models, photos] = await Promise.all([loadCompany(), loadCatalogModels(), loadCatalogPhotos()]);
  const sample = await sampleCard(origin, company.company_name || "Quark Mobilidade", company.whatsapp ?? null);
  return (
    <div translate="no" className="notranslate">
      <BioLanding models={models.length ? models : SCOOTERS} photos={photos as Record<string, { url: string; caption: string | null }[]>} whatsapp={company.whatsapp ?? null} instagram={company.instagram ?? null} city={company.city ?? null} sample={sample} />
    </div>
  );
}
