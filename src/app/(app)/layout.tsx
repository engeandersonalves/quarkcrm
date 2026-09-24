import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { Shell } from "@/components/app/shell";
import { serverSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Lê id e e-mail do token da sessão (sem ida à rede). */
function userFromToken(token: string): User | null {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (!claims.sub) return null;
    return { id: claims.sub, email: claims.email, app_metadata: {}, user_metadata: claims.user_metadata ?? {}, aud: claims.aud, created_at: "" } as User;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A sessão já foi validada/renovada pelo middleware; aqui basta ler o cookie.
  // Os dados continuam protegidos pelo RLS: sem token válido, o banco não devolve nada.
  const sb = await serverSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  let user = session ? userFromToken(session.access_token) : null;
  // Token ilegível (cookie corrompido): confirma com o servidor de autenticação.
  if (!user && session) user = (await sb.auth.getUser()).data.user;
  if (!user) redirect("/login");
  return <Shell user={user}>{children}</Shell>;
}
