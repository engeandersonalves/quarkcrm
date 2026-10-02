"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { productOf } from "@/lib/constants";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

type Row = { id: string; number: number; view_count: number; inputs: Record<string, unknown> | null; lead: { name: string } | null };

/**
 * Avisa na hora, em qualquer tela, quando um cliente abre uma proposta
 * (solar ou S.A.V.E). Compara a contagem de visualizações a cada mudança em tempo real.
 */
export function useProposalViewAlerts() {
  const router = useRouter();
  const seen = useRef<Map<string, number> | null>(null);
  const { data } = useLive<Row[]>(
    async () => {
      const sb = supabase();
      const q = (order: string) => sb.from("proposals").select("id,number,view_count,inputs,lead:leads(name)").gt("view_count", 0).order(order, { ascending: false, nullsFirst: false }).limit(80);
      let res = await q("last_viewed_at");
      if (res.error) res = await q("viewed_at");
      return (res.data ?? []) as unknown as Row[];
    },
    [],
    ["proposals"],
  );

  useEffect(() => {
    if (!data) return;
    const prev = seen.current;
    const next = new Map(data.map((r) => [r.id, r.view_count]));
    seen.current = next;
    if (!prev) return; // primeira carga: só registra
    for (const r of data) {
      const before = prev.get(r.id) ?? 0;
      if (r.view_count <= before) continue;
      const save = productOf(r.inputs) === "save";
      const who = r.lead?.name?.split(" ")[0] ?? "O cliente";
      toast(`👀 ${who} abriu a proposta ${save ? "S.A.V.E " : ""}#${r.number}`, {
        description: before === 0 ? "Primeira visualização: ótima hora para chamar no WhatsApp." : `Já são ${r.view_count} aberturas.`,
        duration: 9000,
        action: { label: "Ver", onClick: () => router.push(`/propostas/${r.id}`) },
      });
    }
  }, [data, router]);
}
