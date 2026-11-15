import type { Metadata, Viewport } from "next";
import { BioLanding } from "@/components/mobilidade/bio-landing";
import { loadCatalogModels } from "@/lib/catalog-photos";
import { SCOOTERS } from "@/lib/catalog-mobilidade";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Scooters elétricas com garantia · Quark Mobilidade" },
  description: "Scooters elétricas 1.000W sem CNH e sem placa, com garantia, contrato, comprovante de propriedade e cartão do proprietário com QR. Desde 2020 em Maceió.",
  openGraph: {
    title: "Scooters elétricas com garantia e documento · Quark Mobilidade",
    description: "Sem gasolina, sem CNH e sem placa. Garantia, contrato e cartão do proprietário com verificação oficial. Desde 2020.",
    images: ["/mob/trio.jpg"],
  },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default async function ScootersPage() {
  const [company, models] = await Promise.all([loadCompany(), loadCatalogModels()]);
  return (
    <div translate="no" className="notranslate">
      <BioLanding models={models.length ? models : SCOOTERS} whatsapp={company.whatsapp ?? null} instagram={company.instagram ?? null} city={company.city ?? null} />
    </div>
  );
}
