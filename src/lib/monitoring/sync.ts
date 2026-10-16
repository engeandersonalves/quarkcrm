import type { SupabaseClient } from "@supabase/supabase-js";
import { openCredentials } from "./crypto.ts";
import { ADAPTERS } from "./providers/index.ts";
import { MonitoringError, type PlantData, type ProviderId } from "./types.ts";
import { todayIso } from "./units.ts";

export interface ConnectionRow {
  id: string;
  provider: ProviderId;
  label: string;
}

const round = (v: number | null, d = 3) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Busca as usinas no fabricante (sem gravar nada). */
export async function fetchProviderPlants(provider: ProviderId, creds: Record<string, string>) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new MonitoringError("Fabricante não suportado.");
  return adapter.fetchPlants(creds, (url, init) => fetch(url, init));
}

/** Grava usinas e geração do dia (e o histórico, quando o fabricante devolve). */
export async function savePlants(admin: SupabaseClient, conn: ConnectionRow, plants: PlantData[]) {
  const now = new Date().toISOString();
  const rows = plants
    .filter((p) => p.externalId)
    .map((p) => ({
      connection_id: conn.id,
      provider: conn.provider,
      external_id: p.externalId,
      name: p.name.slice(0, 200),
      capacity_kwp: round(p.capacityKwp),
      power_kw: round(p.powerKw),
      today_kwh: round(p.todayKwh),
      month_kwh: round(p.monthKwh),
      total_kwh: round(p.totalKwh),
      status: p.status,
      last_update_at: p.lastUpdate,
      address: p.address?.slice(0, 300) ?? null,
      synced_at: now,
    }));
  if (!rows.length) return 0;
  const { data, error } = await admin.from("monitoring_plants").upsert(rows, { onConflict: "connection_id,external_id" }).select("id, external_id");
  if (error) throw new Error(error.message);
  const idOf = new Map((data ?? []).map((r: { id: string; external_id: string }) => [r.external_id, r.id]));

  const today = todayIso();
  const daily: { plant_id: string; day: string; kwh: number }[] = [];
  for (const p of plants) {
    const id = idOf.get(p.externalId);
    if (!id) continue;
    for (const d of p.daily ?? []) daily.push({ plant_id: id, day: d.day, kwh: round(d.kwh)! });
    if (p.todayKwh !== null && !(p.daily ?? []).some((d) => d.day === today)) daily.push({ plant_id: id, day: today, kwh: round(p.todayKwh)! });
  }
  for (let i = 0; i < daily.length; i += 500) {
    const { error: e } = await admin.from("monitoring_daily").upsert(daily.slice(i, i + 500), { onConflict: "plant_id,day" });
    if (e) throw new Error(e.message);
  }
  return rows.length;
}

/** Sincroniza uma conexão: abre as credenciais, consulta o fabricante e grava. */
export async function syncConnection(admin: SupabaseClient, conn: ConnectionRow) {
  if (conn.provider === "manual") return { id: conn.id, ok: true as const, plants: 0 };
  await admin.from("monitoring_connections").update({ status: "syncing" }).eq("id", conn.id);
  try {
    const { data: secret, error } = await admin.from("monitoring_secrets").select("payload").eq("connection_id", conn.id).maybeSingle();
    if (error || !secret) throw new MonitoringError("Credenciais não encontradas. Remova e conecte de novo.");
    const plants = await fetchProviderPlants(conn.provider, openCredentials(secret.payload as string));
    const count = await savePlants(admin, conn, plants);
    await admin.from("monitoring_connections").update({ status: "ok", last_error: null, last_sync_at: new Date().toISOString(), plants_count: count }).eq("id", conn.id);
    return { id: conn.id, ok: true as const, plants: count };
  } catch (e) {
    const msg = e instanceof MonitoringError ? e.message : `Falha ao sincronizar: ${e instanceof Error ? e.message : "erro desconhecido"}`;
    await admin.from("monitoring_connections").update({ status: "error", last_error: msg.slice(0, 500), last_sync_at: new Date().toISOString() }).eq("id", conn.id);
    return { id: conn.id, ok: false as const, error: msg };
  }
}

export async function syncAll(admin: SupabaseClient) {
  const { data } = await admin.from("monitoring_connections").select("id, provider, label").neq("provider", "manual").order("created_at");
  const out = [];
  for (const c of (data ?? []) as ConnectionRow[]) out.push(await syncConnection(admin, c));
  return out;
}

/** Recalcula hoje/mês/total de uma usina a partir do histórico gravado (usinas por planilha). */
export async function refreshManualTotals(admin: SupabaseClient, plantId: string) {
  const { data } = await admin.from("monitoring_daily").select("day, kwh").eq("plant_id", plantId).order("day").limit(20000);
  const rows = (data ?? []) as { day: string; kwh: number }[];
  const today = todayIso();
  const month = today.slice(0, 7);
  const total = rows.reduce((t, r) => t + Number(r.kwh), 0);
  const monthKwh = rows.filter((r) => r.day.startsWith(month)).reduce((t, r) => t + Number(r.kwh), 0);
  const last = rows[rows.length - 1];
  await admin
    .from("monitoring_plants")
    .update({
      total_kwh: round(total),
      month_kwh: round(monthKwh),
      today_kwh: rows.find((r) => r.day === today) ? round(Number(rows.find((r) => r.day === today)!.kwh)) : null,
      last_update_at: last ? `${last.day}T12:00:00-03:00` : null,
      synced_at: new Date().toISOString(),
    })
    .eq("id", plantId);
}
