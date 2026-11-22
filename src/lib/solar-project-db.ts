"use client";

/**
 * Arquivos do projeto fotovoltaico no bucket privado "projetos": envio, link temporário
 * para abrir e download dos bytes (para juntar na pasta em PDF).
 */
import type { ProjectFile } from "./solar-project";
import { supabase } from "./supabase/client";

const BUCKET = "projetos";
const friendly = (m: string) =>
  /bucket|not found|row-level|schema cache|solar_/i.test(m) ? "Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar os projetos." : m;

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "arquivo";

export async function uploadProjectFile(folder: string, key: string, file: File | Blob, name: string): Promise<ProjectFile> {
  const path = `${folder}/${key}-${Date.now().toString(36)}-${safeName(name)}`;
  const type = file.type || "application/octet-stream";
  const { error } = await supabase().storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false });
  if (error) throw new Error(friendly(error.message));
  return { path, name, type, size: file.size, at: new Date().toISOString() };
}

export async function removeProjectFile(path: string) {
  await supabase().storage.from(BUCKET).remove([path]);
}

/** Link temporário (10 min) para abrir o arquivo. */
export async function projectFileUrl(path: string, download?: string) {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(path, 600, download ? { download } : undefined);
  if (error || !data) throw new Error(friendly(error?.message ?? "Arquivo não encontrado"));
  return data.signedUrl;
}

export async function projectFileBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(friendly(error?.message ?? "Arquivo não encontrado"));
  return new Uint8Array(await data.arrayBuffer());
}

export { friendly as projectError };
