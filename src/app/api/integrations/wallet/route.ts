import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { checkGoogleWallet } from "@/lib/wallet-google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verifica as credenciais do Google Wallet (Configurações → Integrações). Só para a equipe logada. */
export async function GET() {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await checkGoogleWallet();
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
