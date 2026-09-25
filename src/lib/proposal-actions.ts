"use client";

import { supabase } from "./supabase/client";

/** Cria uma cópia da proposta como rascunho (novo número e novo link público). */
export async function duplicateProposal(id: string, userId: string): Promise<{ id: string; number: number }> {
  const sb = supabase();
  const { data: p, error } = await sb.from("proposals").select("*").eq("id", id).single();
  if (error || !p) throw new Error(error?.message ?? "Proposta não encontrada");
  const { data, error: err } = await sb
    .from("proposals")
    .insert({
      lead_id: p.lead_id,
      title: p.title ? `${p.title} (cópia)` : "Cópia",
      status: "rascunho",
      inputs: p.inputs,
      power_kwp: p.power_kwp,
      monthly_generation: p.monthly_generation,
      direct_cost: p.direct_cost,
      commission_value: p.commission_value,
      tax_value: p.tax_value,
      profit_value: p.profit_value,
      final_price: p.final_price,
      created_by: userId,
    })
    .select("id, number")
    .single();
  if (err || !data) throw new Error(err?.message ?? "Não foi possível duplicar");
  await sb.from("activities").insert({ lead_id: p.lead_id, type: "proposta", content: `Orçamento #${data.number} criado a partir do #${p.number}`, created_by: userId });
  return data as { id: string; number: number };
}
