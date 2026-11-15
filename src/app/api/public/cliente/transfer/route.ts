import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

/**
 * Pedido de transferência de propriedade feito pelo dono na área do cliente.
 * A verificação (CPF + 4 dígitos do celular) e todas as regras ficam no banco.
 */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  if (!hasSupabase) return NextResponse.json({ ok: false, error: "indisponivel" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const n = (body?.newOwner ?? {}) as Record<string, unknown>;
  const sale = str(body?.sale, 40);
  if (!/^[0-9a-f-]{36}$/i.test(sale)) return NextResponse.json({ ok: false, error: "venda" }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const { data, error } = await anonSupabase().rpc("request_owner_transfer", {
    p_cpf: str(body?.cpf, 20),
    p_check: str(body?.check, 8),
    p_document: sale,
    p_new: {
      name: str(n.name, 120),
      doc: str(n.doc, 20),
      phone: str(n.phone, 20),
      email: str(n.email, 120),
      cep: str(n.cep, 10),
      address: str(n.address, 200),
      city: str(n.city, 80),
      state: str(n.state, 2),
    },
    p_reason: str(body?.reason, 40),
    p_notes: str(body?.notes, 600),
    p_ip: ip,
  });
  if (error) {
    const missing = /request_owner_transfer|moto_transfers/.test(error.message);
    return NextResponse.json({ ok: false, error: missing ? "indisponivel" : "erro" }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json(data ?? { ok: false, error: "erro" }, { headers: { "Cache-Control": "no-store" } });
}
