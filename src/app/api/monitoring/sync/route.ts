import { NextResponse } from "next/server";
import { syncConnection, type ConnectionRow } from "@/lib/monitoring/sync";
import { monitoringContext } from "../auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Atualiza as usinas agora (uma conexão ou todas). */
export async function POST(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { connectionId, auto } = (await req.json().catch(() => ({}))) as { connectionId?: string; auto?: boolean };
  let q = ctx.admin.from("monitoring_connections").select("id, provider, label").order("created_at");
  if (connectionId) q = q.eq("id", connectionId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Abertura da tela (auto) só sincroniza o que venceu; o botão força a lista (com intervalo mínimo)
  const conns = (data ?? []) as ConnectionRow[];
  const end = Date.now() + 45_000;
  const results = [];
  for (let i = 0; i < conns.length; i++) {
    const share = Math.max(8_000, (end - Date.now()) / (conns.length - i));
    results.push(await syncConnection(ctx.admin, conns[i], { force: !auto, deadline: Math.min(end, Date.now() + share) }));
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
