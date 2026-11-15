import { NextResponse } from "next/server";
import { anonSupabase } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Login do portal do cliente: CPF/CNPJ + 4 últimos dígitos do celular da venda.
 * O banco limita as tentativas por CPF e por IP; a resposta nunca diz se o CPF existe.
 */
export async function POST(req: Request) {
  if (!hasSupabase) return NextResponse.json({ ok: false, error: "indisponivel" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { cpf?: unknown; check?: unknown } | null;
  const cpf = typeof body?.cpf === "string" ? body.cpf.slice(0, 20) : "";
  const check = typeof body?.check === "string" ? body.check.slice(0, 8) : "";
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
  const { data, error } = await anonSupabase().rpc("get_client_portal", { p_cpf: cpf, p_check: check, p_ip: ip });
  if (error) {
    const missing = /get_client_portal/.test(error.message);
    return NextResponse.json({ ok: false, error: missing ? "indisponivel" : "erro" }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json(data ?? { ok: false, error: "erro" }, { headers: { "Cache-Control": "no-store" } });
}
