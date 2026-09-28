"use client";

import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

export interface NavBadges {
  /** Tarefas minhas para hoje (inclui atrasadas). */
  tasks: number;
  late: number;
  /** Leads novos ainda sem contato. */
  leads: number;
  /** Propostas vistas pelo cliente aguardando resposta. */
  proposals: number;
  /** Documentos aguardando assinatura. */
  documents: number;
}

const count = (r: { count: number | null; error: unknown }) => (r.error ? 0 : (r.count ?? 0));

/** Números dos "sinalizadores" do menu, atualizados em tempo real. */
export function useNavBadges(userId: string): NavBadges {
  const { data } = useLive<NavBadges>(
    async () => {
      const sb = supabase();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const now = new Date().toISOString();
      const mine = `assigned_to.eq.${userId},assigned_to.is.null`;
      const [tasks, late, leads, proposals, documents] = await Promise.all([
        sb.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lte("due_at", end.toISOString()).or(mine),
        sb.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lt("due_at", now).or(mine),
        sb.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo").or(`owner_id.eq.${userId},owner_id.is.null`),
        sb.from("proposals").select("id", { count: "exact", head: true }).eq("status", "visualizada"),
        sb.from("documents").select("id", { count: "exact", head: true }).eq("status", "enviado"),
      ]);
      return { tasks: count(tasks), late: count(late), leads: count(leads), proposals: count(proposals), documents: count(documents) };
    },
    [userId],
    ["tasks", "leads", "proposals", "documents"],
  );
  return data ?? { tasks: 0, late: 0, leads: 0, proposals: 0, documents: 0 };
}
