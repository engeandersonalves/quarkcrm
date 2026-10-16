import type { SupabaseClient } from "@supabase/supabase-js";
import { ALARM_LABEL, evaluateDevice, evaluatePlant, mergeRules, readingOf, type AlarmKind, type AlarmRules, type Finding } from "./alarms.ts";
import type { DeviceData, PlantStatus } from "./types.ts";

const DEVICE_KINDS: AlarmKind[] = ["sobretensao", "subtensao", "temperatura", "frequencia", "string_desigual"];
const PLANT_KINDS: AlarmKind[] = ["offline", "alarme_fabricante", "sem_leitura", "geracao_baixa"];

export type NewAlarm = Finding & { plant_id: string };

/** Limites cadastrados (ou os padrões). */
export async function loadRules(admin: SupabaseClient): Promise<AlarmRules> {
  const { data } = await admin.from("settings").select("data").eq("id", 1).maybeSingle();
  return mergeRules((data?.data as { monitoring_alerts?: Partial<AlarmRules> } | null)?.monitoring_alerts);
}

/**
 * Abre, atualiza e resolve alarmes de uma usina para um conjunto de tipos.
 * Um alarme fica aberto enquanto a condição aparecer; some da leitura → resolvido.
 */
async function applyAlarms(admin: SupabaseClient, plantId: string, kinds: AlarmKind[], findings: Finding[], deviceSns: string[] | null): Promise<NewAlarm[]> {
  const { data: open, error } = await admin.from("monitoring_alarms").select("id, device_sn, kind, severity").eq("plant_id", plantId).is("resolved_at", null).in("kind", kinds);
  if (error) return []; // banco sem a tabela ainda
  const now = new Date().toISOString();
  const openRows = (open ?? []) as { id: string; device_sn: string; kind: AlarmKind; severity: string }[];
  const key = (sn: string, kind: string) => `${sn}|${kind}`;
  const openMap = new Map(openRows.map((o) => [key(o.device_sn, o.kind), o]));
  const created: NewAlarm[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    const k = key(f.deviceSn, f.kind);
    seen.add(k);
    const cur = openMap.get(k);
    if (cur) {
      await admin.from("monitoring_alarms").update({ last_seen_at: now, value: f.value, message: f.message, severity: cur.severity === "critical" ? "critical" : f.severity, threshold: f.threshold }).eq("id", cur.id);
    } else {
      const { error: e } = await admin.from("monitoring_alarms").insert({ plant_id: plantId, device_sn: f.deviceSn, kind: f.kind, severity: f.severity, message: f.message, value: f.value, threshold: f.threshold, started_at: now, last_seen_at: now });
      if (!e) created.push({ ...f, plant_id: plantId });
    }
  }
  const toResolve = openRows.filter((o) => !seen.has(key(o.device_sn, o.kind)) && (deviceSns === null || deviceSns.includes(o.device_sn)));
  if (toResolve.length) await admin.from("monitoring_alarms").update({ resolved_at: now }).in("id", toResolve.map((o) => o.id));
  return created;
}

/** Guarda a leitura de cada inversor no histórico e avalia os alarmes elétricos. */
export async function recordDevices(admin: SupabaseClient, plantId: string, devices: DeviceData[], rules: AlarmRules) {
  if (!devices.length) return [];
  const at = new Date().toISOString();
  await admin.from("monitoring_readings").insert(devices.map((d) => ({ plant_id: plantId, at, ...readingOf(d) })));
  const findings = devices.flatMap((d) => evaluateDevice(d, rules));
  return applyAlarms(admin, plantId, DEVICE_KINDS, findings, devices.map((d) => d.sn));
}

/** Alarmes de status/geração para as usinas de uma conexão. */
export async function evaluatePlants(admin: SupabaseClient, connectionId: string, rules: AlarmRules) {
  const { data } = await admin.from("monitoring_plants").select("id, status, today_kwh, capacity_kwp, last_update_at, provider").eq("connection_id", connectionId);
  const hour = Number(new Date(Date.now() - 3 * 3600_000).toISOString().slice(11, 13));
  const created: NewAlarm[] = [];
  for (const p of (data ?? []) as { id: string; status: PlantStatus; today_kwh: number | null; capacity_kwp: number | null; last_update_at: string | null; provider: string }[]) {
    if (p.provider === "manual") continue;
    created.push(...(await applyAlarms(admin, p.id, PLANT_KINDS, evaluatePlant(p, rules, hour), null)));
  }
  return created;
}

/** E-mail com os alarmes novos (um por rodada), para os endereços de Configurações. */
export async function notifyAlarms(admin: SupabaseClient, created: NewAlarm[], rules: AlarmRules) {
  if (!created.length || !rules.email) return;
  try {
    const { sendEmail, recipientsFrom, emailTemplate, appUrl } = await import("../email.ts");
    const { data: s } = await admin.from("settings").select("data").eq("id", 1).maybeSingle();
    const to = recipientsFrom((s?.data as { notify_emails?: string } | null)?.notify_emails ?? "");
    if (!to.length) return;
    const ids = [...new Set(created.map((c) => c.plant_id))];
    const { data: plants } = await admin.from("monitoring_plants").select("id, name").in("id", ids);
    const nameOf = new Map(((plants ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
    const crit = created.filter((c) => c.severity === "critical").length;
    await sendEmail({
      to,
      subject: `${crit ? "🚨" : "⚠️"} ${created.length} ${created.length === 1 ? "alarme novo" : "alarmes novos"} no monitoramento`,
      html: emailTemplate({
        eyebrow: "Monitoramento",
        title: crit ? `${crit} ${crit === 1 ? "alarme crítico" : "alarmes críticos"}` : "Novos alarmes nas usinas",
        intro: "Confira as usinas abaixo. Os alarmes se resolvem sozinhos quando a condição volta ao normal.",
        rows: created.slice(0, 12).map((c) => [`${nameOf.get(c.plant_id) ?? "Usina"} · ${ALARM_LABEL[c.kind]}`, c.message] as [string, string]),
        cta: { label: "Abrir alarmes", url: appUrl("/monitoramento/alarmes") },
      }),
    });
    await admin.from("monitoring_alarms").update({ notified_at: new Date().toISOString() }).in("plant_id", ids).is("notified_at", null).is("resolved_at", null);
  } catch (e) {
    console.error("[alarmes] aviso por e-mail", e);
  }
}
