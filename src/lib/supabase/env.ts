/**
 * Lê a URL e a chave pública do Supabase.
 * A URL é normalizada para só o domínio (https://xxxx.supabase.co): se alguém colar
 * "https://xxxx.supabase.co/rest/v1/" o Supabase responde "Invalid path specified in request URL".
 */
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";

function origin(url: string) {
  if (!url) return "";
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

export const SUPABASE_URL = origin(rawUrl);
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
