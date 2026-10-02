import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureFunnel } from "@/components/capture/funnel";
import { CaptureLanding } from "@/components/capture/landing";
import { TrackingScripts } from "@/components/capture/tracking";
import { loadCompany } from "@/lib/public-company";
import type { Segment } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Energia solar, carregador veicular e gestão de energia · Quark Energia" },
  description: "Reduza até 95% da conta de luz com energia solar. Carregador para carro elétrico, eletroposto, limpeza de usinas e gestão de créditos. Simulação gratuita em 1 minuto.",
  openGraph: { title: "Sua conta de luz pode cair até 95%", description: "Simulação gratuita em 1 minuto.", images: ["/brand/icon-512.png"] },
  // Tradução automática do navegador altera o texto da página e pode quebrar a navegação entre as etapas.
  other: { google: "notranslate" },
};

const SEGMENTS: Segment[] = ["solar", "save", "ambos", "eletroposto", "manutencao", "gestao"];

export default async function CapturePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [company, params] = await Promise.all([loadCompany(), searchParams]);
  const embed = params.embed === "1";
  const interesse = typeof params.interesse === "string" && SEGMENTS.includes(params.interesse as Segment) ? (params.interesse as Segment) : null;
  return (
    <div translate="no" className="notranslate">
      <TrackingScripts metaPixelId={company.metaPixelId} gaId={company.gaId} />
      <Suspense>{embed ? <CaptureFunnel company={company} /> : <CaptureLanding company={company} initialSegment={interesse} />}</Suspense>
    </div>
  );
}
