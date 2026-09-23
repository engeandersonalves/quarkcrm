import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProposalDocument, type PublicProposal } from "@/components/proposal/document";
import { anonSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const load = cache(async (token: string) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const { data } = await anonSupabase().rpc("get_public_proposal", { p_token: token });
  return (data as PublicProposal | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data) return { title: "Proposta não encontrada" };
  const company = (data.settings?.company_name as string) || "Energia Solar";
  return {
    title: { absolute: `Proposta #${data.proposal.number} · ${data.lead.name} — ${company}` },
    description: `Proposta de energia solar de ${Number(data.proposal.power_kwp).toLocaleString("pt-BR")} kWp preparada por ${company}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  return <ProposalDocument data={data} token={token} />;
}
