import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

/**
 * Área do vendedor parceiro. Toda chamada leva telefone + código; a conferência,
 * o limite de tentativas e as regras ficam no banco.
 */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  if (!hasSupabase) return NextResponse.json({ ok: false, error: "indisponivel" }, { status: 503 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const phone = str(b?.phone, 24);
  const pin = str(b?.pin, 8);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const sb = anonSupabase();
  const action = str(b?.action, 12);

  let res;
  if (action === "login") res = await sb.rpc("seller_portal", { p_phone: phone, p_pin: pin, p_ip: ip });
  else if (action === "refer")
    res = await sb.rpc("seller_refer", { p_phone: phone, p_pin: pin, p_name: str(b?.name, 120), p_client_phone: str(b?.clientPhone, 24), p_model: str(b?.model, 60), p_notes: str(b?.notes, 600), p_ip: ip });
  else if (action === "photo") {
    const photo = typeof b?.photo === "string" ? b.photo : null;
    if (photo && (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 700_000)) return NextResponse.json({ ok: false, error: "imagem" }, { status: 400 });
    res = await sb.rpc("seller_set_photo", { p_phone: phone, p_pin: pin, p_photo: photo, p_ip: ip });
  } else return NextResponse.json({ ok: false, error: "acao" }, { status: 400 });

  if (res.error) {
    const missing = /seller_|moto_sellers|moto_referrals/.test(res.error.message);
    return NextResponse.json({ ok: false, error: missing ? "indisponivel" : "erro" }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json(res.data ?? { ok: false, error: "erro" }, { headers: { "Cache-Control": "no-store" } });
}
