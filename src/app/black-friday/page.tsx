import type { Metadata, Viewport } from "next";
import { BlackFridayLanding } from "@/components/bf/landing";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Black Friday Quark · Energia solar, wallbox e moto elétrica" },
  description: "De 13 a 27 de novembro: kits solares instalados em até 30 dias, wallbox e moto elétrica com preço de Black. 72x sem entrada e 21x no cartão.",
  openGraph: {
    title: "Black Friday Quark: preço de Black, sol o ano inteiro",
    description: "Energia solar, wallbox e moto elétrica. Instalação em até 30 dias, 72x sem entrada.",
    images: ["/bf/placa.png"],
  },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#050706" };

export default async function BlackFridayPage() {
  const company = await loadCompany();
  return (
    <div translate="no" className="notranslate">
      <BlackFridayLanding whatsapp={company.whatsapp ?? null} companyName={company.company_name || "Quark Energia"} />
    </div>
  );
}
