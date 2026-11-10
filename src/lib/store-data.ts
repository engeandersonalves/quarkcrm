import "server-only";
import { anonSupabase } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { defaultProducts, toProduct, type Campaign, type Coupon, type StoreProduct } from "@/lib/store";

export interface StoreData {
  products: StoreProduct[];
  campaign: Campaign | null;
  coupons: Coupon[];
  /** true = ainda sem produtos cadastrados (mostrando o catálogo padrão). */
  fallback: boolean;
}

/** Produtos ativos, campanha no ar e cupons públicos. Nunca falha: cai no catálogo padrão. */
export async function loadStore(): Promise<StoreData> {
  const empty: StoreData = { products: defaultProducts(), campaign: null, coupons: [], fallback: true };
  if (!hasSupabase) return empty;
  try {
    const sb = anonSupabase();
    const now = new Date().toISOString();
    const [p, c, k] = await Promise.all([
      sb.from("store_products").select("*").eq("active", true).order("position").order("created_at").limit(500),
      sb.from("store_campaigns").select("*").eq("active", true).lte("starts_at", now).gt("ends_at", now).order("ends_at").limit(1),
      sb.rpc("store_public_coupons"),
    ]);
    const products = ((p.data ?? []) as Record<string, unknown>[]).map(toProduct).filter((x): x is StoreProduct => !!x);
    return {
      products: products.length ? products : empty.products,
      fallback: !products.length,
      campaign: ((c.data ?? [])[0] as Campaign | undefined) ?? null,
      coupons: ((k.data ?? []) as Coupon[]).filter((x) => x && typeof x.code === "string"),
    };
  } catch {
    return empty;
  }
}
