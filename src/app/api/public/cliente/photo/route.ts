import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

/**
 * O cliente salva a foto 3/4 do cartão do proprietário. Mesma verificação do login
 * da área do cliente (CPF + 4 dígitos do celular), feita no banco.
 */
export async function POST(req: Request) {
  if (!hasSupabase) return NextResponse.json({ ok: false, error: "indisponivel" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { cpf?: unknown; check?: unknown; photo?: unknown } | null;
  const photo = typeof body?.photo === "string" ? body.photo : null;
  if (photo && (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 700_000)) return NextResponse.json({ ok: false, error: "imagem" }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const { data, error } = await anonSupabase().rpc("set_client_photo", { p_cpf: String(body?.cpf ?? "").slice(0, 20), p_check: String(body?.check ?? "").slice(0, 8), p_photo: photo, p_ip: ip });
  if (error) {
    const missing = /set_client_photo|moto_customers/.test(error.message);
    return NextResponse.json({ ok: false, error: missing ? "indisponivel" : "erro" }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json(data ?? { ok: false, error: "erro" }, { headers: { "Cache-Control": "no-store" } });
}
