import type { Metadata, Viewport } from "next";
import { MobilidadeCatalog } from "@/components/mobilidade/catalog";
import { loadCatalogPhotos } from "@/lib/catalog-photos";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Catálogo Black Friday · Quark Mobilidade" },
  description: "Scooters elétricas 1.000W com garantia e entrega montada: T1, Cappuccino e MZ em 21x no cartão. Preço de Black Friday até 27/11.",
  openGraph: {
    title: "Escolha a sua. Pague em 21x. · Quark Mobilidade",
    description: "Scooters elétricas 1.000W T1, Cappuccino e MZ com preço de Black Friday.",
    images: ["/mob/trio.jpg"],
  },
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#050706" };

export default async function CatalogoMobilidadePage() {
  const [company, photos] = await Promise.all([loadCompany(), loadCatalogPhotos()]);
  return (
    <div translate="no" className="notranslate">
      <MobilidadeCatalog whatsapp={company.whatsapp ?? null} photos={photos} />
    </div>
  );
}
