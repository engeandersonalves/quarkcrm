import { NextResponse } from "next/server";
import { missingCredentials, PROVIDERS, providerInfo } from "@/lib/monitoring/catalog";
import { sealCredentials } from "@/lib/monitoring/crypto";
import { fetchProviderPlants, savePlants } from "@/lib/monitoring/sync";
import { MonitoringError, type ProviderId } from "@/lib/monitoring/types";
import { monitoringContext } from "../auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Conecta uma conta: testa as credenciais no fabricante, guarda criptografado e importa as usinas. */
export async function POST(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Só administradores conectam contas de inversores." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { provider?: string; label?: string; credentials?: Record<string, unknown> };
  const info = providerInfo(String(body.provider ?? ""));
  if (!info) return NextResponse.json({ error: "Escolha um fabricante." }, { status: 400 });
  if (info.manual) return NextResponse.json({ error: "Usinas de outros fabricantes são cadastradas pela planilha." }, { status: 400 });

  // Só os campos conhecidos do fabricante, como texto
  const creds: Record<string, string> = {};
  for (const f of info.fields) {
    const v = String(body.credentials?.[f.key] ?? "").slice(0, 4000);
    creds[f.key] = f.type === "password" ? v : v.trim();
    if (f.type === "select" && !f.options?.some((o) => o.value === creds[f.key])) creds[f.key] = f.options?.[0]?.value ?? "";
  }
  const miss = missingCredentials(info.id, creds);
  if (miss.length) return NextResponse.json({ error: `Preencha: ${miss.join(", ")}.` }, { status: 400 });

  let plants;
  try {
    plants = await fetchProviderPlants(info.id as ProviderId, creds);
  } catch (e) {
    const msg = e instanceof MonitoringError ? e.message : `Não foi possível conectar à ${info.platform}.`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const label = String(body.label ?? "").trim().slice(0, 80) || `${info.name} · ${info.platform}`;
  const { data: conn, error } = await ctx.admin
    .from("monitoring_connections")
    .insert({ provider: info.id, label, status: "ok", last_sync_at: new Date().toISOString(), plants_count: plants.length, created_by: ctx.user.id })
    .select("id, provider, label")
    .single();
  if (error || !conn) return NextResponse.json({ error: error?.message ?? "Falha ao salvar." }, { status: 500 });

  try {
    const { error: e2 } = await ctx.admin.from("monitoring_secrets").insert({ connection_id: conn.id, payload: sealCredentials(creds) });
    if (e2) throw new Error(e2.message);
    await savePlants(ctx.admin, conn as { id: string; provider: ProviderId; label: string }, plants);
  } catch (e) {
    await ctx.admin.from("monitoring_connections").delete().eq("id", conn.id);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao salvar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: conn.id, plants: plants.length });
}

/** Remove a conexão (as usinas e o histórico dela saem junto). */
export async function DELETE(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Só administradores removem conexões." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Conexão inválida." }, { status: 400 });
  const { error } = await ctx.admin.from("monitoring_connections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ providers: PROVIDERS.map((p) => p.id) });
}
