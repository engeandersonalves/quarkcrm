import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProposalDocument, type PublicProposal } from "@/components/proposal/document";
import { SaveDocument } from "@/components/save/document";
import { productOf } from "@/lib/constants";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const load = cache(async (token: string) => {
  if (!hasSupabase) return null;
  const { data } = await anonSupabase().rpc("get_public_proposal", { p_token: token });
  return (data as PublicProposal | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data) return { title: "Proposta não encontrada" };
  const company = (data.settings?.company_name as string) || "Energia Solar";
  const save = productOf(data.proposal.inputs) === "save";
  return {
    title: { absolute: `Proposta #${data.proposal.number} · ${data.lead.name} — ${company}` },
    description: save
      ? `Proposta de carregador veicular (S.A.V.E) de ${Number(data.proposal.power_kwp).toLocaleString("pt-BR")} kW preparada por ${company}.`
      : `Proposta de energia solar de ${Number(data.proposal.power_kwp).toLocaleString("pt-BR")} kWp preparada por ${company}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  if (productOf(data.proposal.inputs) === "save") return <SaveDocument data={data} token={token} />;
  return <ProposalDocument data={data} token={token} />;
}
