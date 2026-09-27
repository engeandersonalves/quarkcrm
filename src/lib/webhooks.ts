import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WebhookEvent = "lead.created" | "proposal.accepted" | "document.signed" | "test";

/**
 * Envia um evento para o webhook configurado em Configurações → Integrações
 * (Zapier, Make, n8n, RD Station…). Nunca bloqueia nem quebra o fluxo principal.
 */
export async function fireWebhook(sb: SupabaseClient, event: WebhookEvent, data: Record<string, unknown>, urlOverride?: string) {
  try {
    const url = urlOverride ?? ((await sb.rpc("get_webhook_url")).data as string | null);
    if (!url || !/^https:\/\//i.test(url)) return { skipped: true as const };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "QuarkCRM-Webhook/1.0" },
      body: JSON.stringify({ event, sent_at: new Date().toISOString(), data }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("[webhook]", event, e instanceof Error ? e.message : e);
    return { ok: false, status: 0 };
  }
}

/** Campos do lead enviados às integrações (sem dados internos). */
export function leadPayload(lead: Record<string, unknown>, source: "captura" | "app") {
  const pick = ["id", "name", "phone", "email", "city", "state", "segment", "source", "status", "temperature", "avg_bill", "consumption_kwh", "roof_type", "notes", "created_at"];
  return { origin: source, lead: Object.fromEntries(pick.map((k) => [k, lead[k] ?? null])) };
}
