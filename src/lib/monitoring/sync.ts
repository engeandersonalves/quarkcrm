import type { SupabaseClient } from "@supabase/supabase-js";
import { openCredentials } from "./crypto.ts";
import { ADAPTERS } from "./providers/index.ts";
import { evaluatePlants, loadRules, notifyAlarms, recordDevices, type NewAlarm } from "./alarm-sync.ts";
import type { AlarmRules } from "./alarms.ts";
import { SCHEMA_HINT, isSchemaError } from "./db.ts";
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
  // Quando a lista não traz hoje/mês (ex.: SolarZ), não apaga o que o detalhe já baixou
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const row: Record<string, unknown> = { ...r };
    if (row.today_kwh === null) delete row.today_kwh;
    if (row.month_kwh === null) delete row.month_kwh;
    const key = Object.keys(row).sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const idOf = new Map<string, string>();
  for (const list of groups.values()) {
    const { data, error } = await admin.from("monitoring_plants").upsert(list, { onConflict: "connection_id,external_id" }).select("id, external_id");
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { id: string; external_id: string }[]) idOf.set(r.external_id, r.id);
  }

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

/* -------------------------------------------------------------------------
 * Baixar uma vez, mostrar do banco.
 * - A lista de usinas é atualizada no máximo a cada LIST_TTL.
 * - O detalhe (dia a dia do mês, histórico, inversores) é baixado aos poucos, usina por usina,
 *   dentro de um tempo limite e com pausa entre chamadas, e fica guardado no banco.
 * - Meses passados são baixados uma única vez (monitoring_months.complete).
 * - Se o fabricante pedir calma (limite de consultas), a conexão pausa por BACKOFF.
 * ------------------------------------------------------------------------- */
export const LIST_TTL = 60 * 60_000;
export const DETAIL_TTL = 90 * 60_000; // também é o intervalo do histórico elétrico
const BACKOFF = 30 * 60_000;
const PACE = 700; // ms entre chamadas ao fabricante
const HISTORY_MONTHS = 12;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const isRateLimit = (e: unknown) => e instanceof Error && /muitas consultas|too many|frequen|rate.?limit|limite de/i.test(e.message);
const errText = (e: unknown) => (e instanceof MonitoringError ? e.message : `Falha ao sincronizar: ${e instanceof Error ? e.message : "erro desconhecido"}`);

export function monthsBack(fromMonth: string, n: number) {
  const [y, m] = fromMonth.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - (i + 1), 1)).toISOString().slice(0, 7));
}

/** Atualiza a conexão; se o banco ainda não tiver as colunas novas, grava só as antigas. */
async function updateConn(admin: SupabaseClient, id: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("monitoring_connections").update(patch).eq("id", id);
  if (error && isSchemaError(error)) {
    const { retry_after: _r, ...rest } = patch;
    await admin.from("monitoring_connections").update(rest).eq("id", id);
  }
}

type FullConn = ConnectionRow & { last_sync_at: string | null; retry_after: string | null };

async function credsOf(admin: SupabaseClient, connId: string) {
  const { data: secret, error } = await admin.from("monitoring_secrets").select("payload").eq("connection_id", connId).maybeSingle();
  if (error || !secret) throw new MonitoringError("Credenciais não encontradas. Remova e conecte de novo.");
  return openCredentials(secret.payload as string);
}

async function upsertDays(admin: SupabaseClient, plantId: string, days: { day: string; kwh: number }[]) {
  const today = todayIso();
  const rows = days.filter((d) => d.day <= today && Number.isFinite(d.kwh)).map((d) => ({ plant_id: plantId, day: d.day, kwh: round(d.kwh)! }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("monitoring_daily").upsert(rows.slice(i, i + 500), { onConflict: "plant_id,day" });
    if (error) throw new Error(error.message);
  }
}

/** Baixa o detalhe de uma usina: mês atual, um mês do histórico, meses do ano e inversores. */
async function detailOne(admin: SupabaseClient, provider: ProviderId, creds: Record<string, string>, plant: { id: string; external_id: string; devices_at: string | null }, deadline: number, rules: AlarmRules, created: NewAlarm[]) {
  const adapter = ADAPTERS[provider];
  const realFetch = (u: string, i?: RequestInit) => fetch(u, i);
  const today = todayIso();
  const month = today.slice(0, 7);
  const ext = String(plant.external_id);
  const patch: Record<string, unknown> = { details_synced_at: new Date().toISOString() };

  if (adapter.fetchDays) {
    const days = await adapter.fetchDays(creds, ext, month, realFetch);
    await upsertDays(admin, plant.id, days);
    const t = days.find((d) => d.day === today);
    patch.month_kwh = round(days.reduce((s, d) => s + d.kwh, 0));
    if (t) patch.today_kwh = round(t.kwh);
    await admin.from("monitoring_months").upsert({ plant_id: plant.id, month, kwh: patch.month_kwh, complete: false, fetched_at: new Date().toISOString() }, { onConflict: "plant_id,month" });

    // Histórico: um mês passado por rodada, do mais recente para trás, só uma vez cada
    if (Date.now() < deadline) {
      const back = monthsBack(month, HISTORY_MONTHS);
      const { data: done } = await admin.from("monitoring_months").select("month").eq("plant_id", plant.id).eq("complete", true).in("month", back);
      const doneSet = new Set(((done ?? []) as { month: string }[]).map((r) => r.month));
      const next = back.find((m) => !doneSet.has(m));
      if (next) {
        await sleep(PACE);
        const past = await adapter.fetchDays(creds, ext, next, realFetch);
        await upsertDays(admin, plant.id, past);
        const kwh = past.reduce((s, d) => s + d.kwh, 0);
        const rows = [{ plant_id: plant.id, month: next, kwh: round(kwh), complete: true, fetched_at: new Date().toISOString() }];
        // Mês vazio: a usina não existia ainda; marca os mais antigos como concluídos para não insistir
        if (kwh <= 0) for (const m of back.filter((m) => m < next && !doneSet.has(m))) rows.push({ plant_id: plant.id, month: m, kwh: 0, complete: true, fetched_at: new Date().toISOString() });
        await admin.from("monitoring_months").upsert(rows, { onConflict: "plant_id,month" });
      }
    }
  } else if (adapter.fetchMonths && Date.now() < deadline) {
    // Sem dia a dia: guarda os totais mensais do ano (1 chamada)
    const months = await adapter.fetchMonths(creds, ext, today.slice(0, 4), realFetch);
    if (months.length) await admin.from("monitoring_months").upsert(months.map((m) => ({ plant_id: plant.id, month: m.month, kwh: round(m.kwh), complete: false, fetched_at: new Date().toISOString() })), { onConflict: "plant_id,month" });
  }

  if (adapter.fetchDevices && Date.now() < deadline && (!plant.devices_at || Date.now() - new Date(plant.devices_at).getTime() > DETAIL_TTL)) {
    await sleep(PACE);
    const devices = await adapter.fetchDevices(creds, ext, realFetch);
    patch.devices = devices;
    patch.devices_at = new Date().toISOString();
    // Histórico elétrico + alarmes (sobretensão, temperatura, frequência, strings)
    created.push(...(await recordDevices(admin, plant.id, devices, rules).catch(() => [])));
  }
  await admin.from("monitoring_plants").update(patch).eq("id", plant.id);
}

/** Baixa o detalhe das usinas mais desatualizadas da conexão, dentro do prazo. */
export async function syncDetails(admin: SupabaseClient, conn: ConnectionRow, creds: Record<string, string>, opts: { deadline: number; plantIds?: string[]; force?: boolean }) {
  const adapter = ADAPTERS[conn.provider];
  if (!adapter || (!adapter.fetchDays && !adapter.fetchDevices && !adapter.fetchMonths)) return { done: 0, rateLimited: false };
  let q = admin.from("monitoring_plants").select("id, external_id, devices_at, details_synced_at").eq("connection_id", conn.id).order("details_synced_at", { ascending: true, nullsFirst: true }).limit(500);
  if (opts.plantIds?.length) q = q.in("id", opts.plantIds);
  const { data, error } = await q;
  if (error) {
    if (isSchemaError(error)) await updateConn(admin, conn.id, { last_error: SCHEMA_HINT });
    return { done: 0, rateLimited: false };
  }
  const stale = ((data ?? []) as { id: string; external_id: string; devices_at: string | null; details_synced_at: string | null }[]).filter(
    (p) => opts.force || !p.details_synced_at || Date.now() - new Date(p.details_synced_at).getTime() > DETAIL_TTL,
  );
  let done = 0;
  const rules = await loadRules(admin);
  const created: NewAlarm[] = [];
  for (const p of stale) {
    if (Date.now() > opts.deadline) break;
    try {
      await detailOne(admin, conn.provider, creds, p, opts.deadline, rules, created);
      done++;
    } catch (e) {
      if (isRateLimit(e)) {
        await updateConn(admin, conn.id, { retry_after: new Date(Date.now() + BACKOFF).toISOString(), last_error: errText(e).slice(0, 500) });
        await notifyAlarms(admin, created, rules);
        return { done, rateLimited: true };
      }
      // Uma usina com problema não trava as outras
      await admin.from("monitoring_plants").update({ details_synced_at: new Date().toISOString() }).eq("id", p.id);
    }
    await sleep(PACE);
  }
  await notifyAlarms(admin, created, rules);
  return { done, rateLimited: false };
}

/**
 * Sincroniza uma conexão: lista de usinas (se vencida) e depois o detalhe aos poucos.
 * `force` atualiza a lista mesmo dentro do intervalo (botão Atualizar), mas respeita a pausa do fabricante.
 */
export async function syncConnection(admin: SupabaseClient, conn: ConnectionRow, opts: { force?: boolean; deadline?: number } = {}) {
  if (conn.provider === "manual") return { id: conn.id, ok: true as const, plants: 0 };
  const deadline = opts.deadline ?? Date.now() + 40_000;
  const { data: row } = await admin.from("monitoring_connections").select("id, provider, label, last_sync_at, retry_after").eq("id", conn.id).maybeSingle();
  const c = (row ?? { ...conn, last_sync_at: null, retry_after: null }) as FullConn;
  if (c.retry_after && new Date(c.retry_after).getTime() > Date.now()) {
    const at = new Date(c.retry_after).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return { id: conn.id, ok: false as const, error: `O fabricante limitou as consultas. Nova tentativa automática às ${at}; os dados já baixados continuam aparecendo.` };
  }
  const listDue = opts.force ? !c.last_sync_at || Date.now() - new Date(c.last_sync_at).getTime() > 5 * 60_000 : !c.last_sync_at || Date.now() - new Date(c.last_sync_at).getTime() > LIST_TTL;
  try {
    const creds = await credsOf(admin, conn.id);
    let count: number | null = null;
    if (listDue) {
      await updateConn(admin, conn.id, { status: "syncing" });
      const plants = await ADAPTERS[conn.provider].fetchPlants(creds, (u, i) => fetch(u, i));
      count = await savePlants(admin, conn, plants);
      // Alarmes de status (offline, alarme do fabricante, sem leitura, geração baixa)
      const rules = await loadRules(admin);
      await notifyAlarms(admin, await evaluatePlants(admin, conn.id, rules).catch(() => []), rules);
      await updateConn(admin, conn.id, { status: "ok", last_error: null, retry_after: null, last_sync_at: new Date().toISOString(), plants_count: count });
    }
    const det = await syncDetails(admin, conn, creds, { deadline });
    if (det.rateLimited) return { id: conn.id, ok: false as const, error: "O fabricante limitou as consultas; continuamos mais tarde com o que falta." };
    return { id: conn.id, ok: true as const, plants: count ?? undefined, details: det.done };
  } catch (e) {
    const msg = errText(e);
    const patch: Record<string, unknown> = { status: "error", last_error: msg.slice(0, 500), last_sync_at: new Date().toISOString() };
    if (isRateLimit(e)) patch.retry_after = new Date(Date.now() + BACKOFF).toISOString();
    await updateConn(admin, conn.id, patch);
    return { id: conn.id, ok: false as const, error: msg };
  }
}

/** Todas as conexões, repartindo o tempo disponível. */
export async function syncAll(admin: SupabaseClient, opts: { budgetMs?: number; force?: boolean } = {}) {
  const { data } = await admin.from("monitoring_connections").select("id, provider, label").neq("provider", "manual").order("last_sync_at", { ascending: true, nullsFirst: true });
  const conns = (data ?? []) as ConnectionRow[];
  const end = Date.now() + (opts.budgetMs ?? 45_000);
  const out = [];
  for (let i = 0; i < conns.length; i++) {
    const share = Math.max(8_000, (end - Date.now()) / (conns.length - i));
    out.push(await syncConnection(admin, conns[i], { force: opts.force, deadline: Math.min(end, Date.now() + share) }));
    if (Date.now() > end) break;
  }
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

/**
 * Baixa, uma única vez, meses passados que faltam para um relatório (até `max` por chamada).
 * Respeita a pausa do fabricante. Devolve quantos meses foram baixados.
 */
export async function fetchMissingMonths(admin: SupabaseClient, plant: { id: string; external_id: string; connection_id: string; provider: ProviderId }, months: string[], max = 2) {
  const adapter = ADAPTERS[plant.provider];
  if (!adapter?.fetchDays || plant.provider === "manual") return { fetched: 0, limited: false };
  const current = todayIso().slice(0, 7);
  const wanted = months.filter((m) => m < current);
  if (!wanted.length) return { fetched: 0, limited: false };
  const { data: conn } = await admin.from("monitoring_connections").select("retry_after").eq("id", plant.connection_id).maybeSingle();
  if (conn?.retry_after && new Date(conn.retry_after).getTime() > Date.now()) return { fetched: 0, limited: true };
  const { data: done } = await admin.from("monitoring_months").select("month").eq("plant_id", plant.id).eq("complete", true).in("month", wanted);
  const doneSet = new Set(((done ?? []) as { month: string }[]).map((r) => r.month));
  const todo = wanted.filter((m) => !doneSet.has(m)).slice(0, max);
  if (!todo.length) return { fetched: 0, limited: false };
  const creds = await credsOf(admin, plant.connection_id);
  let fetched = 0;
  for (const m of todo) {
    try {
      const days = await adapter.fetchDays(creds, String(plant.external_id), m, (u, i) => fetch(u, i));
      await upsertDays(admin, plant.id, days);
      await admin.from("monitoring_months").upsert({ plant_id: plant.id, month: m, kwh: round(days.reduce((s, d) => s + d.kwh, 0)), complete: true, fetched_at: new Date().toISOString() }, { onConflict: "plant_id,month" });
      fetched++;
    } catch (e) {
      if (isRateLimit(e)) {
        await updateConn(admin, plant.connection_id, { retry_after: new Date(Date.now() + BACKOFF).toISOString() });
        return { fetched, limited: true };
      }
      throw e;
    }
    await sleep(PACE);
  }
  return { fetched, limited: false };
}
