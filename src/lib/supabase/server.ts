import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // chamado a partir de um Server Component — o middleware renova a sessão.
        }
      },
    },
  });
}

/** Cliente anônimo (sem cookies) — usado pelas rotas públicas via funções RPC. */
export function anonSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente com service role — apenas no servidor (cron). Retorna null se a chave não estiver configurada. */
export function adminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key.trim(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Confere se SUPABASE_SERVICE_ROLE_KEY é mesmo a chave secreta (service_role).
 * Erro comum: colar a chave anon/publishable no lugar — aí o banco aplica as regras de
 * segurança (RLS) e recusa as gravações. Nunca devolve a chave, só o diagnóstico.
 */
export function serviceKeyIssue(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const fix = "Na Vercel, em Settings → Environment Variables, troque SUPABASE_SERVICE_ROLE_KEY pela chave service_role (Supabase → Project Settings → API Keys) e faça um novo deploy.";
  if (!key) return `A variável SUPABASE_SERVICE_ROLE_KEY não está configurada. ${fix}`;
  if (key === SUPABASE_ANON_KEY.trim()) return `SUPABASE_SERVICE_ROLE_KEY está com a chave anon (pública), igual à NEXT_PUBLIC_SUPABASE_ANON_KEY. ${fix}`;
  if (key.startsWith("sb_publishable_")) return `SUPABASE_SERVICE_ROLE_KEY está com a chave publishable (pública). Use a chave secreta (sb_secret_…) ou a service_role. ${fix}`;
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: string; ref?: string };
      if (payload.role && payload.role !== "service_role") return `SUPABASE_SERVICE_ROLE_KEY está com uma chave de papel "${payload.role}", não service_role. ${fix}`;
      const ref = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
      if (payload.ref && ref && payload.ref !== ref) return `SUPABASE_SERVICE_ROLE_KEY é de outro projeto do Supabase (${payload.ref}), diferente do configurado (${ref}). ${fix}`;
    } catch {
      // formato desconhecido: deixa o banco decidir
    }
  }
  return null;
}

/** Traduz a recusa por RLS numa instrução clara. */
export function explainDbError(message: string | undefined) {
  if (message && /row-level security/i.test(message)) return serviceKeyIssue() ?? "O banco recusou a gravação (RLS). Confira se SUPABASE_SERVICE_ROLE_KEY na Vercel é a chave service_role deste projeto e rode o supabase/schema.sql.";
  return message;
}
