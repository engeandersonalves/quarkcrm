import { NextResponse } from "next/server";
import { openCredentials } from "@/lib/monitoring/crypto";
import { ADAPTERS } from "@/lib/monitoring/providers/index";
import { MonitoringError, type DayValue, type DeviceData, type MonthValue, type ProviderId } from "@/lib/monitoring/types";
import { todayIso } from "@/lib/monitoring/units";
import { monitoringContext } from "../../auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type Result = { days: DayValue[]; months: MonthValue[]; devices: DeviceData[] | null; notes: Record<string, string>; at: number };
const cache = new Map<string, Result>();
const fresh = (r: Result | undefined, ms: number) => r && Date.now() - r.at < ms;
const why = (e: unknown) => (e instanceof MonitoringError ? e.message : "O fabricante não respondeu agora.");

/**
 * Detalhe de uma usina: geração por dia (mês escolhido), por mês (ano escolhido)
 * e leituras elétricas dos inversores, buscadas no fabricante na hora.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;
  const url = new URL(req.url);
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : today.slice(0, 7);
  const year = /^\d{4}$/.test(url.searchParams.get("year") ?? "") ? url.searchParams.get("year")! : month.slice(0, 4);
  const wantDevices = url.searchParams.get("devices") !== "0";

  const { data: plant } = await ctx.admin.from("monitoring_plants").select("id, external_id, connection_id, provider").eq("id", id).maybeSingle();
  if (!plant) return NextResponse.json({ error: "Usina não encontrada." }, { status: 404 });

  const key = `${id}:${month}:${year}:${wantDevices}`;
  const hit = cache.get(key);
  if (fresh(hit, 5 * 60_000)) return NextResponse.json(hit);

  const provider = plant.provider as ProviderId;
  const adapter = ADAPTERS[provider];
  const notes: Record<string, string> = {};
  let days: DayValue[] | null = null;
  let months: MonthValue[] | null = null;
  let devices: DeviceData[] | null = null;

  if (provider !== "manual" && adapter) {
    const { data: secret } = await ctx.admin.from("monitoring_secrets").select("payload").eq("connection_id", plant.connection_id).maybeSingle();
    if (!secret) notes.geral = "Credenciais não encontradas: remova e conecte a conta de novo.";
    else {
      const creds = openCredentials(secret.payload as string);
      const realFetch = (u: string, i?: RequestInit) => fetch(u, i);
      const ext = String(plant.external_id);
      // Em sequência: várias APIs limitam chamadas por segundo
      if (adapter.fetchDays) days = await adapter.fetchDays(creds, ext, month, realFetch).catch((e) => ((notes.dias = why(e)), null));
      if (adapter.fetchMonths) months = await adapter.fetchMonths(creds, ext, year, realFetch).catch((e) => ((notes.meses = why(e)), null));
      if (wantDevices && adapter.fetchDevices) devices = await adapter.fetchDevices(creds, ext, realFetch).catch((e) => ((notes.eletrica = why(e)), null));
    }
  }

  // Guarda os dias que vieram do fabricante (o histórico local cresce e alimenta os relatórios)
  if (days?.length) {
    const rows = days.filter((d) => d.day <= today).map((d) => ({ plant_id: id, day: d.day, kwh: Math.round(d.kwh * 1000) / 1000 }));
    if (rows.length) await ctx.admin.from("monitoring_daily").upsert(rows, { onConflict: "plant_id,day" });
  }

  // Sem histórico do fabricante: usa o que já foi gravado
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const { data: stored } = await ctx.admin.from("monitoring_daily").select("day, kwh").eq("plant_id", id).gte("day", `${year < month.slice(0, 4) ? year : month.slice(0, 4)}-01-01`).lte("day", `${year > month.slice(0, 4) ? year : month.slice(0, 4)}-12-31`).limit(1000);
  const map = new Map(((stored ?? []) as { day: string; kwh: number }[]).map((r) => [r.day, Number(r.kwh)]));
  if (!days?.length) days = Array.from({ length: lastDay }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter((d) => map.has(d)).map((d) => ({ day: d, kwh: map.get(d)! }));
  if (!months?.length) {
    const agg = new Map<string, number>();
    for (const [d, kwh] of map) if (d.startsWith(year)) agg.set(d.slice(0, 7), (agg.get(d.slice(0, 7)) ?? 0) + kwh);
    months = [...agg.entries()].sort().map(([mm, kwh]) => ({ month: mm, kwh }));
  }

  const out: Result = { days: days.sort((a, b) => a.day.localeCompare(b.day)), months: months.sort((a, b) => a.month.localeCompare(b.month)), devices, notes, at: Date.now() };
  if (!Object.keys(notes).length) cache.set(key, out);
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return NextResponse.json(out);
}
