import type { SupabaseClient } from "@supabase/supabase-js";

/** Mensagem quando o banco ainda não recebeu as tabelas/colunas novas. */
export const SCHEMA_HINT = "Atualize o banco: rode o arquivo supabase/schema.sql no Supabase (SQL Editor) para ativar o histórico, os alarmes e o download controlado.";

export const isSchemaError = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === "42703" || e.code === "42P01" || e.code === "PGRST204" || e.code === "PGRST205" || /column .* does not exist|relation .* does not exist|schema cache|Could not find/i.test(e.message ?? ""));

export type PlantRecord = {
  id: string;
  external_id: string;
  connection_id: string;
  provider: string;
  devices?: unknown;
  devices_at?: string | null;
  details_synced_at?: string | null;
};

/**
 * Lê uma usina pelo id. Se o banco ainda não tiver as colunas novas, tenta de novo só com
 * as básicas (em vez de responder "não encontrada") e avisa que falta atualizar o banco.
 */
export async function getPlant(admin: SupabaseClient, id: string): Promise<{ plant: PlantRecord | null; outdated: boolean; error: string | null }> {
  const full = await admin.from("monitoring_plants").select("id, external_id, connection_id, provider, devices, devices_at, details_synced_at").eq("id", id).maybeSingle();
  if (!full.error) return { plant: (full.data as PlantRecord | null) ?? null, outdated: false, error: null };
  if (isSchemaError(full.error)) {
    const basic = await admin.from("monitoring_plants").select("id, external_id, connection_id, provider").eq("id", id).maybeSingle();
    if (!basic.error) return { plant: (basic.data as PlantRecord | null) ?? null, outdated: true, error: null };
    return { plant: null, outdated: true, error: basic.error.message };
  }
  return { plant: null, outdated: false, error: full.error.message };
}
