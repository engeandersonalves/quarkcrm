import { NextResponse } from "next/server";
import { syncConnection, type ConnectionRow } from "@/lib/monitoring/sync";
import { monitoringContext } from "../auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Atualiza as usinas agora (uma conexão ou todas). */
export async function POST(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { connectionId } = (await req.json().catch(() => ({}))) as { connectionId?: string };
  let q = ctx.admin.from("monitoring_connections").select("id, provider, label").order("created_at");
  if (connectionId) q = q.eq("id", connectionId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results = [];
  for (const c of (data ?? []) as ConnectionRow[]) results.push(await syncConnection(ctx.admin, c));
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
