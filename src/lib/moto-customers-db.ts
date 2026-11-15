"use client";

import type { MotoCustomer, SaleInfo } from "./moto-overrides";
import { supabase } from "./supabase/client";

const missing = (msg: string) => /moto_customers|moto_sale_info|does not exist|schema cache/i.test(msg);
const friendly = (msg: string) => (missing(msg) ? "Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar a ficha do cliente." : msg);

/** Salva (cria ou atualiza) a ficha do cliente. */
export async function saveCustomer(key: string, patch: Partial<Omit<MotoCustomer, "key">>) {
  const { error } = await supabase()
    .from("moto_customers")
    .upsert({ key, ...patch, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(friendly(error.message));
}

/** Salva os dados pós-venda de uma scooter (números e entrega). */
export async function saveSaleInfo(documentId: string, patch: Partial<Omit<SaleInfo, "document_id">>) {
  const { error } = await supabase()
    .from("moto_sale_info")
    .upsert({ document_id: documentId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "document_id" });
  if (error) throw new Error(friendly(error.message));
}

/** Foto 3/4 do cliente: a da ficha ou, na falta, a selfie da assinatura mais recente. */
export async function fetchCustomerPhoto(key: string, documentIds: string[]): Promise<{ photo: string | null; fromSelfie: boolean }> {
  try {
    const { data } = await supabase().from("moto_customers").select("photo").eq("key", key).maybeSingle();
    if (data?.photo) return { photo: data.photo as string, fromSelfie: false };
  } catch {
    /* sem a tabela: segue para a selfie */
  }
  if (!documentIds.length) return { photo: null, fromSelfie: false };
  const { data } = await supabase()
    .from("document_signers")
    .select("selfie, signed_at")
    .in("document_id", documentIds)
    .eq("role", "comprador")
    .not("selfie", "is", null)
    .order("signed_at", { ascending: false })
    .limit(1);
  const selfie = (data?.[0] as { selfie?: string } | undefined)?.selfie ?? null;
  return { photo: selfie, fromSelfie: !!selfie };
}

/** Recorta a foto em 3:4 (rosto centralizado) e reduz para ficar leve. */
export async function toPortrait(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const W = 600;
    const H = 800;
    const scale = Math.max(W / img.width, H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d")!.drawImage(img, (W - w) / 2, Math.min(0, (H - h) * 0.35), w, h);
    return c.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
