import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { monitoringContext } from "../auth";

export const runtime = "nodejs";

/** Garante a "conexão" que agrupa as usinas cadastradas à mão. */
async function manualConnection(admin: NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").adminSupabase>>>, userId: string) {
  const { data } = await admin.from("monitoring_connections").select("id").eq("provider", "manual").limit(1).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await admin.from("monitoring_connections").insert({ provider: "manual", label: "Outros fabricantes (planilha)", status: "ok", created_by: userId }).select("id").single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

/** Cadastra uma usina de fabricante sem API. */
export async function POST(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const b = (await req.json().catch(() => ({}))) as { name?: string; capacityKwp?: number; address?: string; brand?: string; leadId?: string };
  const name = String(b.name ?? "").trim().slice(0, 200);
  if (!name) return NextResponse.json({ error: "Informe o nome da usina." }, { status: 400 });
  const capacity = Number(b.capacityKwp);
  try {
    const connId = await manualConnection(ctx.admin, ctx.user.id);
    const { data, error } = await ctx.admin
      .from("monitoring_plants")
      .insert({
        connection_id: connId,
        provider: "manual",
        external_id: randomUUID(),
        name,
        capacity_kwp: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
        address: [String(b.brand ?? "").trim(), String(b.address ?? "").trim()].filter(Boolean).join(" · ").slice(0, 300) || null,
        lead_id: /^[0-9a-f-]{36}$/i.test(String(b.leadId ?? "")) ? b.leadId : null,
        status: "unknown",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { count } = await ctx.admin.from("monitoring_plants").select("id", { count: "exact", head: true }).eq("connection_id", connId);
    await ctx.admin.from("monitoring_connections").update({ plants_count: count ?? 0, last_sync_at: new Date().toISOString() }).eq("id", connId);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao salvar." }, { status: 500 });
  }
}

/** Remove uma usina cadastrada à mão. */
export async function DELETE(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Só administradores removem usinas." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const { error } = await ctx.admin.from("monitoring_plants").delete().eq("id", id).eq("provider", "manual");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
