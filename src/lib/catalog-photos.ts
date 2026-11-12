import "server-only";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";
import { CATALOG_ID, type ModelId } from "@/lib/catalog-mobilidade";

export type CatalogPhotos = Partial<
  Record<ModelId, { url: string; caption: string | null }[]>
>;

/** Fotos extras (vários ângulos) que a equipe enviou pelo CRM. Sem banco ou sem tabela: nenhuma. */
export async function loadCatalogPhotos(): Promise<CatalogPhotos> {
  if (!hasSupabase) return {};
  try {
    const { data, error } = await anonSupabase()
      .from("catalog_photos")
      .select("model,url,caption,position")
      .eq("catalog", CATALOG_ID)
      .order("position", { ascending: true })
      .limit(120);
    if (error || !data) return {};
    const out: CatalogPhotos = {};
    for (const r of data as {
      model: ModelId;
      url: string;
      caption: string | null;
    }[]) {
      if (!/^https?:\/\//.test(r.url)) continue;
      (out[r.model] ??= []).push({ url: r.url, caption: r.caption });
    }
    return out;
  } catch {
    return {};
  }
}
