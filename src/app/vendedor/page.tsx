import type { Metadata, Viewport } from "next";
import { SellerPortal } from "@/components/vendedor/seller-portal";
import { SCOOTERS } from "@/lib/catalog-mobilidade";
import { loadCatalogModels, loadCatalogPhotos } from "@/lib/catalog-photos";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Área do vendedor · Quark Mobilidade" },
  description: "Catálogo para divulgar, indicações e comissões dos vendedores parceiros da Quark Mobilidade.",
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#F7F9F4" };

export default async function VendedorPage() {
  const [company, models, photos] = await Promise.all([loadCompany(), loadCatalogModels(), loadCatalogPhotos()]);
  return (
    <div translate="no" className="notranslate">
      <SellerPortal models={models.length ? models : SCOOTERS} photos={photos as Record<string, { url: string; caption: string | null }[]>} whatsapp={company.whatsapp ?? null} />
    </div>
  );
}
