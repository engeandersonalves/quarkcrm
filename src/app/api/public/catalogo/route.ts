import { NextResponse } from "next/server";
import { notifyNewLead } from "@/lib/notifications";
import { adminSupabase, anonSupabase } from "@/lib/supabase/server";
import { fireWebhook, leadPayload } from "@/lib/webhooks";

/**
 * Catálogo com acesso por cadastro.
 *  - { action: "register", catalog, name, phone, email, owner } → cria/reaproveita o lead e devolve o token
 *  - { action: "visit", token }                                → conta mais uma visita
 *  - { action: "track", token, kind, detail, value }          → seção vista, tempo, clique ou interesse
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const anon = anonSupabase();
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

  if (body.action === "register") {
    // Anti-robô: campo invisível preenchido ou envio rápido demais
    if (str(body.website) || (typeof body.elapsed === "number" && body.elapsed < 1500)) return NextResponse.json({ error: "Tente novamente." }, { status: 400 });
    const { data, error } = await anon.rpc("catalog_register", {
      p: {
        catalog: str(body.catalog, 60),
        name: str(body.name, 120),
        phone: str(body.phone, 30),
        email: str(body.email, 160),
        owner: uuid(body.owner) ?? "",
        device: str(body.device, 20),
        segment: "mobilidade",
        source: "Catálogo Mobilidade",
      },
    });
    if (error) {
      const msg = /obrigat|inválid/i.test(error.message) ? error.message.replace(/^.*?:\s*/, "") : "Não conseguimos liberar o acesso agora. Tente de novo.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const r = data as { token: string; visits: number; returning: boolean; lead?: Record<string, unknown> & { duplicate?: boolean } };
    // Lead novo: avisa a equipe (e-mail/webhook), como no formulário do site
    if (r.lead && !r.lead.duplicate) {
      const admin = adminSupabase();
      await Promise.all([
        notifyNewLead(admin ?? anon, r.lead as never, admin ? undefined : "").catch(() => {}),
        fireWebhook(anon, "lead.created", leadPayload(r.lead as never, "captura")).catch(() => {}),
      ]);
    }
    return NextResponse.json({ token: r.token, visits: r.visits });
  }

  const token = uuid(body.token);
  if (!token) return NextResponse.json({ error: "invalid" }, { status: 400 });

  if (body.action === "visit") {
    const { data } = await anon.rpc("catalog_visit", { p_token: token, p_device: str(body.device, 20) || null });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(data);
  }

  if (body.action === "track") {
    await anon.rpc("catalog_track", { p_token: token, p_kind: str(body.kind, 20), p_detail: str(body.detail, 80) || null, p_value: Math.round(Number(body.value) || 0) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid" }, { status: 400 });
}
