import type { Metadata } from "next";
import { Suspense } from "react";
import { Shop } from "@/components/store/shop";
import { loadCompany } from "@/lib/public-company";
import { loadStore } from "@/lib/store-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Loja Quark Energia · Kits solares, eletropostos e motos elétricas com desconto" },
  description: "Ofertas em kits de energia solar para casa, comércio e rural, eletropostos, motos elétricas e material elétrico. Cupons, descontos e cotação grátis.",
  openGraph: { title: "Loja Quark Energia: ofertas em energia solar", description: "Kits solares, eletropostos e motos elétricas com desconto. Cotação grátis.", images: ["/brand/icon-512.png"] },
  other: { google: "notranslate" },
};

export const viewport = { themeColor: "#000000" };

export default async function LojaPage() {
  const [company, store] = await Promise.all([loadCompany(), loadStore()]);
  return (
    <div translate="no" className="notranslate">
      <Suspense>
        <Shop company={company} products={store.products} campaign={store.campaign} coupons={store.coupons} />
      </Suspense>
    </div>
  );
}
