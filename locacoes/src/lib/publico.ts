"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { codificarConexao, conexaoAtual, limparUrl, type ConexaoNuvem } from "./backend";
import type { TermoCongelado } from "./types";

/**
 * Página pública (cliente assinando pelo link): não usa login.
 * A conexão vem das variáveis da Vercel ou do próprio link (#c=…).
 */
function conexaoPublica(): ConexaoNuvem | null {
  const env = { url: limparUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""), chave: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() };
  if (env.url && env.chave) return env;
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/[#&]c=([A-Za-z0-9+/_-]+)/);
  if (!m) return null;
  try {
    const j = JSON.parse(atob(m[1]));
    return j.u && j.k ? { url: limparUrl(j.u), chave: j.k } : null;
  } catch {
    return null;
  }
}

let cli: SupabaseClient | null = null;
function cliente() {
  if (!cli) {
    const c = conexaoPublica();
    if (!c) throw new Error("Link incompleto. Peça um novo link à empresa.");
    cli = createClient(c.url, c.chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return cli;
}

export interface TermoPublico {
  termo: TermoCongelado;
  assinado_em: string | null;
  nome: string | null;
}

export async function termoPublico(token: string): Promise<TermoPublico | null> {
  const r = await cliente().rpc("termo_para_assinar", { p_token: token });
  if (r.error) throw new Error(r.error.message);
  return (r.data as TermoPublico | null) ?? null;
}

export async function assinarPublico(token: string, dados: { nome: string; documento: string; imagem: string; selfie: string; hash: string; dispositivo: string; geo: string }): Promise<boolean> {
  const r = await cliente().rpc("assinar_termo", { p_token: token, p_dados: dados });
  if (r.error) throw new Error(r.error.message);
  return Boolean(r.data);
}

/** Link que vai para o cliente (leva a conexão junto quando ela foi feita pelo app, não pela Vercel). */
export function linkAssinatura(token: string): string {
  const c = conexaoAtual();
  const base = `${window.location.origin}/assinar/${token}`;
  return c?.origem === "aparelho" ? `${base}#c=${codificarConexao(c)}` : base;
}

/** SHA-256 do termo: prova de que o texto assinado é exatamente este. */
export async function hashTermo(t: TermoCongelado): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(t));
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
