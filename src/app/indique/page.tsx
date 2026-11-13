import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { ReferralForm } from "@/components/indicacao/form";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Indique um amigo · Quark Energia" },
  description:
    "Conhece alguém que paga caro na conta de luz? Indique em 1 minuto: fazemos o estudo de energia solar sem custo.",
  openGraph: {
    title: "Indique quem merece economizar na conta de luz",
    description:
      "Leva 1 minuto. A Quark Energia faz o estudo de energia solar sem custo.",
    images: ["/brand/icon-512.png"],
  },
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#050706" };

export default async function IndiquePage() {
  const company = await loadCompany();
  return (
    <div translate="no" className="notranslate">
      <Suspense>
        <ReferralForm
          company={{
            company_name: company.company_name ?? null,
            whatsapp: company.whatsapp ?? null,
          }}
        />
      </Suspense>
    </div>
  );
}
