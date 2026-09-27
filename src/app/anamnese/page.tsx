import type { Metadata } from "next";
import { Suspense } from "react";
import { Diagnostic } from "@/components/anamnese/diagnostic";
import { TrackingScripts } from "@/components/capture/tracking";
import { loadCompany } from "@/lib/public-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Diagnóstico energético gratuito · Quark Energia" },
  description: "Responda 6 perguntas e descubra quanto você economiza com energia solar, o sistema ideal para o seu imóvel e as formas de pagamento.",
  openGraph: {
    title: "Quanto dinheiro está escapando pela sua conta de luz?",
    description: "Diagnóstico energético gratuito em 2 minutos.",
    images: ["/brand/icon-512.png"],
  },
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export default async function AnamnesePage() {
  const company = await loadCompany();
  return (
    <>
      <TrackingScripts metaPixelId={company.metaPixelId} gaId={company.gaId} />
      <Suspense>
        <Diagnostic company={company} />
      </Suspense>
    </>
  );
}
