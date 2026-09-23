import { supabase } from "./supabase/client";

/** Envia uma imagem para o Supabase Storage (bucket público "media") e devolve a URL pública. */
export async function uploadImage(file: File, folder = "geral"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem (JPG, PNG ou WEBP).");
  if (file.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 8 MB).");
  const blob = await shrink(file);
  const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const sb = supabase();
  const { error } = await sb.storage.from("media").upload(path, blob, { cacheControl: "31536000", upsert: false, contentType: blob.type });
  if (error) {
    if (/bucket/i.test(error.message)) throw new Error("Armazenamento de fotos não configurado: rode novamente o supabase/schema.sql no SQL Editor.");
    throw new Error(error.message);
  }
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Reduz fotos grandes de celular para no máx. 2000 px (carrega rápido na proposta). */
async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 2000;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const keepAlpha = file.type === "image/png";
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), keepAlpha ? "image/webp" : "image/jpeg", 0.86));
  } catch {
    return file;
  }
}
