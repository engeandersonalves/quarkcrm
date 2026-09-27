import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { CaptureFunnel, type PublicCompany } from "@/components/capture/funnel";
import { DEFAULT_CAPTURE, type CapturePrefs, type RoofKey } from "@/lib/defaults";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Simulação de energia solar · Quark Energia" },
  description: "Descubra em menos de 1 minuto quanto você economiza com energia solar ou com um carregador para carro elétrico. Estudo gratuito.",
  openGraph: { title: "Quanto você economiza com energia solar?", description: "Simulação gratuita em menos de 1 minuto.", images: ["/brand/icon-512.png"] },
  // Tradução automática do navegador altera o texto da página e pode quebrar a navegação entre as etapas.
  other: { google: "notranslate" },
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Normaliza o que vem do banco: qualquer campo ausente, nulo ou fora do formato vira o padrão. */
function sanitize(raw: unknown): PublicCompany {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cap = (r.capture && typeof r.capture === "object" ? r.capture : {}) as Record<string, unknown>;
  const roofRaw = (cap.roofImages && typeof cap.roofImages === "object" ? cap.roofImages : {}) as Record<string, unknown>;
  const roofImages: CapturePrefs["roofImages"] = {};
  for (const k of ["ceramic", "fiber", "metal", "slab", "ground"] as RoofKey[]) {
    const u = str(roofRaw[k]);
    if (u && /^https?:\/\//.test(u)) roofImages[k] = u;
  }
  const payments = (Array.isArray(cap.payments) ? cap.payments : [])
    .map((p) => (p && typeof p === "object" ? { title: str((p as Record<string, unknown>).title) ?? "", text: str((p as Record<string, unknown>).text) ?? "" } : null))
    .filter((p): p is { title: string; text: string } => !!p && !!p.title);
  return {
    company_name: str(r.company_name),
    whatsapp: str(r.whatsapp),
    instagram: str(r.instagram),
    city: str(r.city),
    tech_name: str(r.tech_name),
    warranty_modules_performance_years: num(r.warranty_modules_performance_years),
    tariff: num(r.tariff),
    sunHours: num(r.sunHours),
    fioBTariff: num(r.fioBTariff),
    publicLighting: typeof r.publicLighting === "number" ? r.publicLighting : num(r.publicLighting),
    metaPixelId: /^\d{5,20}$/.test(String(r.metaPixelId ?? "").trim()) ? String(r.metaPixelId).trim() : null,
    gaId: /^G-[A-Z0-9]{4,15}$/i.test(String(r.gaId ?? "").trim()) ? String(r.gaId).trim().toUpperCase() : null,
    capture: {
      roofImages,
      paymentTitle: str(cap.paymentTitle) ?? DEFAULT_CAPTURE.paymentTitle,
      payments: payments.length ? payments : DEFAULT_CAPTURE.payments,
    },
  };
}

async function loadCompany(): Promise<PublicCompany> {
  if (!hasSupabase) return sanitize(null);
  try {
    const { data } = await anonSupabase().rpc("get_public_company");
    return sanitize(data);
  } catch {
    return sanitize(null);
  }
}

export default async function CapturePage() {
  const company = await loadCompany();
  return (
    <div translate="no" className="notranslate">
      {/* IDs validados no servidor (só dígitos / formato G-XXXX): nada vindo do banco entra cru no script. */}
      {company.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${company.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {company.gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${company.gaId}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${company.gaId}');`}
          </Script>
        </>
      )}
      <Suspense>
        <CaptureFunnel company={company} />
      </Suspense>
    </div>
  );
}
