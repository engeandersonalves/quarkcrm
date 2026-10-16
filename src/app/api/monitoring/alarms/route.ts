import { NextResponse } from "next/server";
import { DEFAULT_ALARM_RULES, mergeRules, type AlarmRules } from "@/lib/monitoring/alarms";
import { SCHEMA_HINT, isSchemaError } from "@/lib/monitoring/db";
import { monitoringContext } from "../auth";

export const runtime = "nodejs";

/** Limites atuais dos alarmes. */
export async function GET() {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { data } = await ctx.admin.from("settings").select("data").eq("id", 1).maybeSingle();
  return NextResponse.json({ rules: mergeRules((data?.data as { monitoring_alerts?: Partial<AlarmRules> } | null)?.monitoring_alerts), defaults: DEFAULT_ALARM_RULES });
}

/** Reconhecer alarmes ({ id } ou { plantId, all: true }) ou salvar limites ({ rules }, só admin). */
export async function POST(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const body = (await req.json().catch(() => ({}))) as { id?: string; plantId?: string; all?: boolean; rules?: Partial<AlarmRules> };

  if (body.rules) {
    if (!ctx.isAdmin) return NextResponse.json({ error: "Só administradores alteram os limites." }, { status: 403 });
    const clean: Partial<AlarmRules> = {};
    for (const [k, v] of Object.entries(body.rules)) {
      if (!(k in DEFAULT_ALARM_RULES)) continue;
      if (k === "email") (clean as Record<string, unknown>)[k] = !!v;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100000) (clean as Record<string, unknown>)[k] = v;
    }
    const { data } = await ctx.admin.from("settings").select("data").eq("id", 1).maybeSingle();
    const next = { ...((data?.data as Record<string, unknown>) ?? {}), monitoring_alerts: mergeRules(clean) };
    const { error } = await ctx.admin.from("settings").upsert({ id: 1, data: next });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rules: next.monitoring_alerts });
  }

  const patch = { acknowledged_at: new Date().toISOString(), acknowledged_by: ctx.user.id };
  let q = ctx.admin.from("monitoring_alarms").update(patch).is("acknowledged_at", null);
  if (body.id && /^[0-9a-f-]{36}$/i.test(body.id)) q = q.eq("id", body.id);
  else if (body.all && body.plantId && /^[0-9a-f-]{36}$/i.test(body.plantId)) q = q.eq("plant_id", body.plantId).is("resolved_at", null);
  else if (body.all) q = q.is("resolved_at", null);
  else return NextResponse.json({ error: "Informe o alarme." }, { status: 400 });
  const { error } = await q;
  if (error) return NextResponse.json({ error: isSchemaError(error) ? SCHEMA_HINT : error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
