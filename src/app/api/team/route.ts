import { NextResponse } from "next/server";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";

/** Confere se quem chama é administrador ativo da equipe. */
async function requireAdmin() {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  return data?.role === "admin" && data.active !== false ? user : null;
}

const NO_KEY = {
  error: "no_service_key",
  message: "Para cadastrar usuários direto pelo app, configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente da Vercel.",
};

/** Cadastra um usuário com acesso já liberado. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden", message: "Apenas administradores cadastram usuários." }, { status: 403 });
  const admin = adminSupabase();
  if (!admin) return NextResponse.json(NO_KEY, { status: 501 });

  const body = (await req.json().catch(() => ({}))) as { full_name?: string; email?: string; password?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const full_name = body.full_name?.trim();
  if (!email || !full_name || !body.password || body.password.length < 6)
    return NextResponse.json({ error: "invalid", message: "Informe nome, e-mail e uma senha com pelo menos 6 caracteres." }, { status: 400 });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: { invited: true },
  });
  if (error || !data.user) {
    const msg = /already|registered|exists/i.test(error?.message ?? "") ? "Já existe um usuário com este e-mail." : (error?.message ?? "Não foi possível cadastrar.");
    return NextResponse.json({ error: "create_failed", message: msg }, { status: 400 });
  }
  // O gatilho do banco cria o perfil; aqui garantimos nome, papel e acesso.
  await admin
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name, role: body.role === "admin" ? "admin" : "vendedor", active: true }, { onConflict: "id" });
  return NextResponse.json({ ok: true, id: data.user.id });
}

/** Define uma nova senha para um usuário. */
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden", message: "Apenas administradores." }, { status: 403 });
  const admin = adminSupabase();
  if (!admin) return NextResponse.json(NO_KEY, { status: 501 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; password?: string };
  if (!body.id || !body.password || body.password.length < 6) return NextResponse.json({ error: "invalid", message: "Senha com pelo menos 6 caracteres." }, { status: 400 });
  const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
  if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
