import { randomUUID } from "node:crypto";
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
    // Anti-robô: só o campo invisível (o preenchimento automático do celular é rápido demais para medir tempo)
    if (str(body.website)) return NextResponse.json({ error: "Tente novamente." }, { status: 400 });
    const name = str(body.name, 120);
    const phone = str(body.phone, 30);
    const email = str(body.email, 160);
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe seu nome e o WhatsApp com DDD." }, { status: 400 });
    const p = { catalog: str(body.catalog, 60), name, phone, email, owner: uuid(body.owner) ?? "", device: str(body.device, 20), segment: "mobilidade", source: "Catálogo Mobilidade" };
    const { data, error } = await anon.rpc("catalog_register", { p });
    if (error) {
      if (/obrigat|inválid/i.test(error.message) && !/function|schema|exist/i.test(error.message)) {
        return NextResponse.json({ error: error.message.replace(/^.*?:\s*/, "") }, { status: 400 });
      }
      // Banco sem as funções do catálogo (schema.sql não rodado) ou outra falha:
      // o cliente entra mesmo assim e o lead é criado pelo formulário público de sempre.
      console.error("[catalogo] catalog_register falhou; liberando acesso sem controle de visitas:", error.message);
      const { data: lead, error: leadErr } = await anon.rpc("create_public_lead", {
        p: { name, phone, email, owner: p.owner, segment: "mobilidade", source: "Catálogo Mobilidade", temperature: "morno", notes: `Abriu o catálogo ${p.catalog}` },
      });
      if (leadErr && /segment|check/i.test(leadErr.message)) {
        // Banco ainda sem o segmento "mobilidade": registra como solar, com a origem do catálogo
        await anon.rpc("create_public_lead", { p: { name, phone, email, owner: p.owner, source: "Catálogo Mobilidade", temperature: "morno", notes: `Abriu o catálogo ${p.catalog} (scooters)` } });
      } else if (leadErr) console.error("[catalogo] lead não criado:", leadErr.message);
      else if (lead && !(lead as { duplicate?: boolean }).duplicate) {
        const admin = adminSupabase();
        await notifyNewLead(admin ?? anon, lead as never, admin ? undefined : "").catch(() => {});
      }
      return NextResponse.json({ token: randomUUID(), visits: 1, offline: true });
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
