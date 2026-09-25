import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureFunnel, type PublicCompany } from "@/components/capture/funnel";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Quanto o sol pode colocar no seu bolso? · Quark Energia" },
  description: "Descubra em 30 segundos quanto você economiza com energia solar ou com um carregador para carro elétrico. Estudo grátis.",
  openGraph: { title: "Quanto o sol pode colocar no seu bolso?", description: "Simulação grátis em 30 segundos.", images: ["/brand/icon-512.png"] },
};

async function loadCompany(): Promise<PublicCompany> {
  if (!hasSupabase) return {};
  const { data } = await anonSupabase().rpc("get_public_company");
  return (data as PublicCompany | null) ?? {};
}

export default async function CapturePage() {
  const company = await loadCompany();
  return (
    <Suspense>
      <CaptureFunnel company={company} />
    </Suspense>
  );
}
