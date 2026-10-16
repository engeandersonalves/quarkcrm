import { explainDbError } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { refreshManualTotals } from "@/lib/monitoring/sync";
import { todayIso } from "@/lib/monitoring/units";
import { monitoringContext } from "../../auth";

export const runtime = "nodejs";

/** Importa a geração diária (planilha já lida no navegador) de uma usina manual. */
export async function POST(req: Request) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const b = (await req.json().catch(() => ({}))) as { plantId?: string; rows?: { day?: string; kwh?: number }[] };
  const { data: plant } = await ctx.admin.from("monitoring_plants").select("id, provider").eq("id", String(b.plantId ?? "")).maybeSingle();
  if (!plant) return NextResponse.json({ error: "Usina não encontrada." }, { status: 404 });
  if (plant.provider !== "manual") return NextResponse.json({ error: "Esta usina é sincronizada pelo fabricante." }, { status: 400 });
  const today = todayIso();
  const rows = (Array.isArray(b.rows) ? b.rows : [])
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(String(r.day)) && String(r.day) <= today && Number.isFinite(Number(r.kwh)) && Number(r.kwh) >= 0 && Number(r.kwh) < 1e7)
    .slice(0, 4000)
    .map((r) => ({ plant_id: plant.id, day: String(r.day), kwh: Math.round(Number(r.kwh) * 1000) / 1000 }));
  if (!rows.length) return NextResponse.json({ error: "Nenhuma linha válida (data e kWh) encontrada." }, { status: 400 });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await ctx.admin.from("monitoring_daily").upsert(rows.slice(i, i + 500), { onConflict: "plant_id,day" });
    if (error) return NextResponse.json({ error: explainDbError(error.message) }, { status: 500 });
  }
  await refreshManualTotals(ctx.admin, plant.id);
  return NextResponse.json({ ok: true, imported: rows.length });
}
