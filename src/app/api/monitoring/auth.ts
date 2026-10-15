import { adminSupabase, serverSupabase } from "@/lib/supabase/server";

/** Quem está chamando (membro ativo) + cliente service role para gravar. */
export async function monitoringContext() {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Faça login novamente.", status: 401 as const };
  const { data: profile } = await sb.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!profile?.active) return { error: "Seu acesso ainda não foi liberado.", status: 403 as const };
  const admin = adminSupabase();
  if (!admin) return { error: "Configure a variável SUPABASE_SERVICE_ROLE_KEY na Vercel para usar o monitoramento.", status: 500 as const };
  return { user, admin, isAdmin: profile.role === "admin" };
}
