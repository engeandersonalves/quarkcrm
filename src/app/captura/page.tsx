import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureFunnel } from "@/components/capture/funnel";
import { TrackingScripts } from "@/components/capture/tracking";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Simulação de energia solar · Quark Energia" },
  description: "Descubra em menos de 1 minuto quanto você economiza com energia solar ou com um carregador para carro elétrico. Estudo gratuito.",
  openGraph: { title: "Quanto você economiza com energia solar?", description: "Simulação gratuita em menos de 1 minuto.", images: ["/brand/icon-512.png"] },
  // Tradução automática do navegador altera o texto da página e pode quebrar a navegação entre as etapas.
  other: { google: "notranslate" },
};

export default async function CapturePage() {
  const company = await loadCompany();
  return (
    <div translate="no" className="notranslate">
      <TrackingScripts metaPixelId={company.metaPixelId} gaId={company.gaId} />
      <Suspense>
        <CaptureFunnel company={company} />
      </Suspense>
    </div>
  );
}
