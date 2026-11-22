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
 *  - { action: "live", catalog }                              → estoque atual e últimas reservas (sem dados pessoais)
 *  - { action: "reserve", name, phone, model, color, pay }    → cadastra/reaproveita o lead, reserva e desconta do estoque
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const anon = anonSupabase();
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

  if (body.action === "live") {
    const { data, error } = await anon.rpc("catalog_live", { p_catalog: str(body.catalog, 60) || "mobilidade-black" });
    if (error || !data) return NextResponse.json({ stock: {}, recent: [] });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action === "reserve") {
    if (str(body.website)) return NextResponse.json({ error: "Tente novamente." }, { status: 400 });
    const name = str(body.name, 120);
    const phone = str(body.phone, 30);
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe seu nome e o WhatsApp com DDD." }, { status: 400 });
    const catalog = str(body.catalog, 60) || "mobilidade-black";
    const model = str(body.model, 60);
    const modelName = str(body.modelName, 60) || model;
    const color = str(body.color, 40);
    const pay = str(body.pay, 20);
    // Mesmo cadastro do catálogo: cria o lead (ou reaproveita pelo telefone) e devolve o token.
    let token = uuid(body.token);
    const reg = await anon.rpc("catalog_register", { p: { catalog, name, phone, email: str(body.email, 160), owner: uuid(body.owner) ?? "", device: str(body.device, 20), segment: "mobilidade", source: "Catálogo Mobilidade" } });
    if (!reg.error && reg.data) {
      const r = reg.data as { token: string; lead?: Record<string, unknown> & { duplicate?: boolean } };
      token = r.token;
      if (r.lead && !r.lead.duplicate) {
        const admin = adminSupabase();
        await Promise.all([
          notifyNewLead(admin ?? anon, r.lead as never, admin ? undefined : "").catch(() => {}),
          fireWebhook(anon, "lead.created", leadPayload(r.lead as never, "captura")).catch(() => {}),
        ]);
      }
    } else {
      console.error("[catalogo] reserva sem cadastro do catálogo:", reg.error?.message);
      await anon.rpc("create_public_lead", { p: { name, phone, segment: "mobilidade", source: "Catálogo Mobilidade", temperature: "quente", notes: `Reservou a scooter ${modelName}${color ? ` (${color})` : ""} · ${pay}` } });
      return NextResponse.json({ ok: true, offline: true });
    }
    if (!token) return NextResponse.json({ ok: true, offline: true });
    // Nota na ficha do lead + lead quente
    await anon.rpc("catalog_track", { p_token: token, p_kind: "interest", p_detail: `${modelName}${color ? ` (${color})` : ""} · reserva · ${pay}`.slice(0, 80), p_value: 0 });
    const res = await anon.rpc("catalog_reserve", { p_token: token, p_model: model, p_color: color || null, p_pay: pay || null });
    if (res.error) {
      console.error("[catalogo] catalog_reserve:", res.error.message);
      return NextResponse.json({ ok: true, token });
    }
    const out = res.data as { ok: boolean; error?: string; stock?: number | null; duplicate?: boolean };
    if (!out.ok && out.error === "esgotado") return NextResponse.json({ error: "Esse modelo acabou de esgotar. Fale com a gente no WhatsApp para a próxima remessa.", stock: 0, token }, { status: 409 });
    return NextResponse.json({ ok: true, token, stock: out.stock ?? null, duplicate: !!out.duplicate });
  }

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
