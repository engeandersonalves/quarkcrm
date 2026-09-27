import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { fireWebhook } from "@/lib/webhooks";

/** Envia um lead de exemplo para o webhook informado (botão "Testar" em Configurações → Integrações). */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https:\/\//i.test(url)) return NextResponse.json({ ok: false, message: "Use um endereço que comece com https://" }, { status: 400 });
  const r = await fireWebhook(
    sb,
    "test",
    { origin: "teste", lead: { id: "00000000-0000-0000-0000-000000000000", name: "Lead de teste", phone: "(82) 99999-0000", email: "teste@exemplo.com", city: "Maceió", state: "AL", segment: "solar", source: "Teste", avg_bill: 600 } },
    url,
  );
  return NextResponse.json({ ok: !!("ok" in r && r.ok), status: "status" in r ? r.status : 0 });
}
