"use client";

import { must, useLive } from "./live";
import { emptyCosts, emptySpecs, newProduct, seedProducts, slugify, type MotoProduct } from "./moto-products";
import { supabase } from "./supabase/client";

type Row = {
  id: string;
  slug: string;
  name: string;
  kicker: string;
  pitch: string;
  for_who: string;
  accent: string;
  photo: string;
  gallery: MotoProduct["gallery"];
  colors: string[];
  specs: Partial<MotoProduct["specs"]>;
  costs: Partial<MotoProduct["costs"]>;
  price: number | string;
  installments: number;
  rate: number | string;
  active: boolean;
  position: number;
  stock?: number | null;
};

export const rowToProduct = (r: Row): MotoProduct =>
  newProduct({
    id: r.id,
    slug: r.slug,
    name: r.name,
    kicker: r.kicker,
    pitch: r.pitch,
    forWho: r.for_who,
    accent: r.accent,
    photo: r.photo,
    gallery: Array.isArray(r.gallery) ? r.gallery : [],
    colors: r.colors ?? [],
    specs: { ...emptySpecs(), ...(r.specs ?? {}) },
    costs: { ...emptyCosts(), ...(r.costs ?? {}) },
    price: Number(r.price) || 0,
    installments: Number(r.installments) || 21,
    rate: Number(r.rate),
    active: r.active,
    position: r.position,
    stock: r.stock == null ? null : Number(r.stock),
  });

export const productToRow = (p: MotoProduct) => ({
  slug: p.slug || slugify(p.name),
  name: p.name.trim(),
  kicker: p.kicker.trim(),
  pitch: p.pitch.trim(),
  for_who: p.forWho.trim(),
  accent: p.accent,
  photo: p.photo,
  gallery: p.gallery,
  colors: p.colors,
  specs: p.specs,
  costs: p.costs,
  price: p.price,
  installments: p.installments,
  rate: p.rate,
  active: p.active,
  position: p.position,
  // Só manda o estoque quando informado (funciona antes de rodar o schema novo).
  ...(p.stock != null ? { stock: p.stock } : {}),
  updated_at: new Date().toISOString(),
});

/**
 * Modelos cadastrados. Sem nada no banco (ou antes de rodar o schema), mostra os 3 do
 * catálogo de lançamento como ponto de partida (`fromSeed`).
 */
export function useMotoProducts() {
  const live = useLive(
    async () => (must(await supabase().from("moto_products").select("*").order("position").order("name")) as Row[]).map(rowToProduct),
    [],
    [],
    { fresh: true },
  );
  const fromSeed = !live.loading && (!!live.error || !(live.data ?? []).length);
  return { ...live, products: fromSeed ? seedProducts() : (live.data ?? []), fromSeed, tableMissing: !!live.error };
}

/** Grava (cria ou atualiza pelo slug) e devolve o id. */
export async function saveProduct(p: MotoProduct): Promise<string> {
  const sb = supabase();
  const row = productToRow(p);
  if (p.id) {
    const { error } = await sb.from("moto_products").update(row).eq("id", p.id);
    if (error) throw new Error(error.message);
    return p.id;
  }
  const { data, error } = await sb.from("moto_products").upsert(row, { onConflict: "slug" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function saveProducts(list: MotoProduct[]) {
  const sb = supabase();
  const { error } = await sb.from("moto_products").upsert(
    list.map((p) => productToRow(p)),
    { onConflict: "slug" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase().from("moto_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Modelo pelo slug (banco ou, na falta, catálogo de lançamento). Nunca lança erro. */
export async function fetchProduct(slug: string): Promise<MotoProduct | null> {
  try {
    const { data } = await supabase().from("moto_products").select("*").eq("slug", slug).maybeSingle();
    if (data) return rowToProduct(data as Row);
  } catch {
    /* sem tabela ou sem rede: usa o catálogo de lançamento */
  }
  return seedProducts().find((p) => p.slug === slug) ?? null;
}
