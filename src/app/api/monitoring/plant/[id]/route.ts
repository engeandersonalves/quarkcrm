import { NextResponse } from "next/server";
import { fetchMissingMonths, syncDetails, type ConnectionRow } from "@/lib/monitoring/sync";
import { openCredentials } from "@/lib/monitoring/crypto";
import { MonitoringError, type DayValue, type DeviceData, type MonthValue, type ProviderId } from "@/lib/monitoring/types";
import { todayIso } from "@/lib/monitoring/units";
import { monitoringContext } from "../../auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const isDay = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (let i = 0; i < 60; i++) {
    const mm = `${y}-${String(m).padStart(2, "0")}`;
    out.push(mm);
    if (mm >= end) break;
    m++;
    if (m > 12) [y, m] = [y + 1, 1];
  }
  return out;
};
const lastDayOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * Detalhe de uma usina lido do banco (nada é consultado no fabricante aqui, exceto
 * meses passados que ainda faltam quando `fetch=1` — e cada um só é baixado uma vez).
 * Parâmetros: from/to (AAAA-MM-DD) ou month (AAAA-MM); year para o histórico mensal.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;
  const url = new URL(req.url);
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : today.slice(0, 7);
  const from = isDay(url.searchParams.get("from")) ? url.searchParams.get("from")! : `${month}-01`;
  const to = isDay(url.searchParams.get("to")) ? url.searchParams.get("to")! : lastDayOf(month);
  const year = /^\d{4}$/.test(url.searchParams.get("year") ?? "") ? url.searchParams.get("year")! : to.slice(0, 4);
  if (from > to) return NextResponse.json({ error: "A data inicial precisa ser antes da final." }, { status: 400 });

  const { data: plant } = await ctx.admin.from("monitoring_plants").select("id, external_id, connection_id, provider, devices, devices_at, details_synced_at").eq("id", id).maybeSingle();
  if (!plant) return NextResponse.json({ error: "Usina não encontrada." }, { status: 404 });
  const notes: Record<string, string> = {};

  // Meses do período que ainda não foram baixados por completo
  const rangeMonths = monthsBetween(from, to);
  if (url.searchParams.get("fetch") === "1") {
    try {
      const r = await fetchMissingMonths(ctx.admin, plant as { id: string; external_id: string; connection_id: string; provider: ProviderId }, rangeMonths, 3);
      if (r.limited) notes.geral = "O fabricante limitou as consultas agora. O que falta será baixado automaticamente mais tarde.";
    } catch (e) {
      notes.geral = e instanceof MonitoringError ? e.message : "Não foi possível baixar o histórico agora.";
    }
  }

  const yStart = `${year}-01-01` < from ? `${year}-01-01` : from;
  const yEnd = `${year}-12-31` > to ? `${year}-12-31` : to;
  const [{ data: daily }, { data: monthRows }, { data: conn }] = await Promise.all([
    ctx.admin.from("monitoring_daily").select("day, kwh").eq("plant_id", id).gte("day", yStart).lte("day", yEnd).order("day").limit(4000),
    ctx.admin.from("monitoring_months").select("month, kwh, complete").eq("plant_id", id).gte("month", yStart.slice(0, 7)).lte("month", yEnd.slice(0, 7)),
    ctx.admin.from("monitoring_connections").select("retry_after, last_sync_at").eq("id", plant.connection_id).maybeSingle(),
  ]);
  const dayRows = ((daily ?? []) as { day: string; kwh: number }[]).map((r) => ({ day: r.day, kwh: Number(r.kwh) }));
  const mRows = (monthRows ?? []) as { month: string; kwh: number | null; complete: boolean }[];

  const days: DayValue[] = dayRows.filter((d) => d.day >= from && d.day <= to);
  // Mês: soma do dia a dia; se não houver dias, usa o total mensal do fabricante
  const byMonth = new Map<string, number>();
  for (const d of dayRows) if (d.day.startsWith(year)) byMonth.set(d.day.slice(0, 7), (byMonth.get(d.day.slice(0, 7)) ?? 0) + d.kwh);
  for (const r of mRows) if (r.month.startsWith(year) && !byMonth.has(r.month) && r.kwh !== null) byMonth.set(r.month, Number(r.kwh));
  const months: MonthValue[] = [...byMonth.entries()].sort().map(([m, kwh]) => ({ month: m, kwh: Math.round(kwh * 100) / 100 }));

  // Totais por mês dentro do período: dia a dia quando houver; senão o total mensal guardado
  const mKwh = new Map(mRows.map((r) => [r.month, r.kwh === null ? null : Number(r.kwh)]));
  const rangeMonthly = rangeMonths.map((m) => {
    const ds = days.filter((d) => d.day.startsWith(m));
    if (ds.length) return { month: m, kwh: Math.round(ds.reduce((t, d) => t + d.kwh, 0) * 100) / 100, fromDays: true };
    const whole = from <= `${m}-01` && to >= lastDayOf(m);
    return { month: m, kwh: whole ? (mKwh.get(m) ?? 0) : 0, fromDays: false };
  });

  const completeSet = new Set(mRows.filter((r) => r.complete).map((r) => r.month));
  const pending = plant.provider === "manual" ? [] : rangeMonths.filter((m) => m < today.slice(0, 7) && !completeSet.has(m));

  return NextResponse.json({
    days,
    months,
    devices: (plant.devices as DeviceData[] | null) ?? null,
    devicesAt: plant.devices_at,
    syncedAt: plant.details_synced_at,
    retryAfter: conn?.retry_after && new Date(conn.retry_after).getTime() > Date.now() ? conn.retry_after : null,
    pending,
    rangeMonthly,
    notes,
    from,
    to,
  });
}

/** Atualizar agora esta usina (respeita intervalo mínimo e a pausa do fabricante). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await monitoringContext();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;
  const { data: plant } = await ctx.admin.from("monitoring_plants").select("id, connection_id, provider, details_synced_at").eq("id", id).maybeSingle();
  if (!plant) return NextResponse.json({ error: "Usina não encontrada." }, { status: 404 });
  if (plant.provider === "manual") return NextResponse.json({ ok: true, skipped: "manual" });
  if (plant.details_synced_at && Date.now() - new Date(plant.details_synced_at).getTime() < 10 * 60_000) return NextResponse.json({ ok: true, skipped: "recent" });
  const { data: conn } = await ctx.admin.from("monitoring_connections").select("id, provider, label, retry_after").eq("id", plant.connection_id).maybeSingle();
  if (!conn) return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  if (conn.retry_after && new Date(conn.retry_after).getTime() > Date.now()) return NextResponse.json({ ok: false, error: "O fabricante limitou as consultas. Tentaremos de novo automaticamente." });
  const { data: secret } = await ctx.admin.from("monitoring_secrets").select("payload").eq("connection_id", conn.id).maybeSingle();
  if (!secret) return NextResponse.json({ error: "Credenciais não encontradas: conecte a conta de novo." }, { status: 400 });
  const r = await syncDetails(ctx.admin, conn as ConnectionRow, openCredentials(secret.payload as string), { deadline: Date.now() + 25_000, plantIds: [id], force: true });
  return NextResponse.json({ ok: !r.rateLimited, error: r.rateLimited ? "O fabricante limitou as consultas. O que faltou será baixado mais tarde." : undefined });
}
