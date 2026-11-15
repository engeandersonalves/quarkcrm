import { NextResponse } from "next/server";
import type { MotoData } from "@/lib/moto-sale";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";
import { googleWalletConfig, googleWalletLink } from "@/lib/wallet-google";
import { walletCard } from "@/lib/wallet-pass";

export const runtime = "nodejs";

type PortalSale = { id: string; status: string; signed_at?: string | null; data: MotoData };
type Portal = { ok: boolean; error?: string; sales?: PortalSale[]; company?: Record<string, string | null> | null };

/**
 * Link "Salvar no Google Wallet" com o cartão da scooter. O cliente prova quem é
 * com os mesmos dados do login da área do cliente (CPF + 4 dígitos do celular).
 */
export async function POST(req: Request) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
  const google = googleWalletConfig();
  if (!google) return fail("O cartão do Google Wallet ainda não foi ativado pela Quark.", 503);
  if (!hasSupabase) return fail("Indisponível no momento.", 503);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const { data, error } = await anonSupabase().rpc("get_client_portal", { p_cpf: String(body.cpf ?? "").slice(0, 20), p_check: String(body.check ?? "").slice(0, 8), p_ip: ip });
  const portal = data as Portal | null;
  if (error || !portal?.ok) return fail("Não foi possível confirmar os seus dados. Entre de novo na área do cliente.", 401);
  const sale = portal.sales?.find((s) => s.id === body.sale);
  if (!sale || (sale.status !== "assinado" && !sale.signed_at)) return fail("O cartão fica disponível depois que o contrato é assinado.", 404);

  const origin = new URL(req.url).origin;
  const c = portal.company ?? {};
  const company = { name: sale.data.contractor?.name || c.legal_name || c.company_name || "Quark Mobilidade", cnpj: sale.data.contractor?.doc || c.cnpj || "", whatsapp: c.whatsapp || c.phone || "", instagram: c.instagram || "", city: c.city || "" };
  try {
    const url = googleWalletLink(walletCard(sale.data, sale.id, company, `${origin}/cliente`), google, origin);
    return NextResponse.json({ ok: true, url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Não foi possível gerar o cartão agora. Tente de novo em instantes.", 500);
  }
}
