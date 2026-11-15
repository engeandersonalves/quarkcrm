import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";
import type { MotoData } from "@/lib/moto-sale";
import { appleWalletConfig, applePass } from "@/lib/wallet-apple";
import { googleWalletConfig, googleWalletLink } from "@/lib/wallet-google";
import { walletCard } from "@/lib/wallet-pass";

export const runtime = "nodejs";

type PortalSale = { id: string; status: string; data: MotoData };
type Portal = { ok: boolean; error?: string; sales?: PortalSale[]; company?: Record<string, string | null> | null };

/**
 * Cartão da scooter na Apple Wallet ou no Google Wallet. O cliente prova quem é
 * com os mesmos dados do login da área do cliente (CPF + 4 dígitos do celular).
 */
export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  let body: Record<string, string> = {};
  if (type.includes("application/json")) body = ((await req.json().catch(() => ({}))) as Record<string, string>) ?? {};
  else {
    const form = await req.formData().catch(() => null);
    form?.forEach((v, k) => typeof v === "string" && (body[k] = v));
  }
  const kind = body.kind === "google" ? "google" : "apple";
  const fail = (msg: string, status = 400) =>
    kind === "google" ? NextResponse.json({ ok: false, error: msg }, { status }) : new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:16px system-ui;padding:24px">${msg} <a href="/cliente">Voltar</a></p>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

  const apple = appleWalletConfig();
  const google = googleWalletConfig();
  if ((kind === "apple" && !apple) || (kind === "google" && !google)) return fail("O cartão da Wallet ainda não foi ativado pela Quark.", 503);
  if (!hasSupabase) return fail("Indisponível no momento.", 503);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const { data, error } = await anonSupabase().rpc("get_client_portal", { p_cpf: String(body.cpf ?? "").slice(0, 20), p_check: String(body.check ?? "").slice(0, 8), p_ip: ip });
  const portal = data as Portal | null;
  if (error || !portal?.ok) return fail("Não foi possível confirmar os seus dados. Entre de novo na área do cliente.", 401);
  const sale = portal.sales?.find((s) => s.id === body.sale);
  if (!sale || sale.status !== "assinado") return fail("O cartão fica disponível depois que o contrato é assinado.", 404);

  const origin = new URL(req.url).origin;
  const c = portal.company ?? {};
  const company = { name: sale.data.contractor?.name || c.legal_name || c.company_name || "Quark Mobilidade", cnpj: sale.data.contractor?.doc || c.cnpj || "", whatsapp: c.whatsapp || c.phone || "", instagram: c.instagram || "", city: c.city || "" };
  const card = walletCard(sale.data, sale.id, company, `${origin}/cliente`);

  try {
    if (kind === "google") return NextResponse.json({ ok: true, url: googleWalletLink(card, google!, origin) }, { headers: { "Cache-Control": "no-store" } });
    const buf = await applePass(card, apple!, origin, c.company_name || company.name);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="Quark-${card.model.replace(/[^A-Za-z0-9]/g, "")}.pkpass"`, "Cache-Control": "no-store" },
    });
  } catch {
    return fail("Não foi possível gerar o cartão agora. Tente de novo em instantes.", 500);
  }
}
