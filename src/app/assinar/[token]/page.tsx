import type { Metadata } from "next";
import { Great_Vibes } from "next/font/google";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SignFlow, type PublicDocument } from "@/components/docs/sign-flow";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const script = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap" });

const load = cache(async (token: string) => {
  if (!hasSupabase || !/^[a-f0-9]{16,64}$/.test(token)) return null;
  const { data } = await anonSupabase().rpc("get_public_document", { p_token: token });
  return (data as PublicDocument | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  const company = data?.company?.company_name || "Quark Energia";
  return {
    title: { absolute: data?.document ? `Assinar: ${data.document.title} — ${company}` : "Documento não encontrado" },
    description: `Documento enviado por ${company} para assinatura eletrônica.`,
    robots: { index: false, follow: false },
  };
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  return <SignFlow data={data} token={token} scriptFont={script.style.fontFamily} />;
}
