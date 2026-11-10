import type { Metadata } from "next";
import { Suspense } from "react";
import { Store } from "@/components/store/store";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Loja · Energia solar, eletropostos e motos elétricas · Quark Energia" },
  description: "Kits de energia solar para casa, comércio e rural, eletropostos, motos elétricas e material elétrico. Monte seu sistema em 1 minuto e peça sua cotação grátis.",
  openGraph: { title: "Monte seu sistema solar em 1 minuto", description: "Kits prontos, eletropostos e motos elétricas. Cotação grátis.", images: ["/brand/icon-512.png"] },
  other: { google: "notranslate" },
};

export const viewport = { themeColor: "#000000" };

export default async function LojaPage() {
  const company = await loadCompany();
  return (
    <div translate="no" className="notranslate">
      <Suspense>
        <Store company={company} />
      </Suspense>
    </div>
  );
}
