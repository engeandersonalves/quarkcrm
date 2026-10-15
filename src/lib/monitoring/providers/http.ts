import { MonitoringError, type Fetch } from "../types.ts";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lê o JSON da resposta ou explica o erro de forma clara. */
export async function readJson(res: Response, who: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new MonitoringError(`${who}: acesso negado. Confira as chaves e se a API está liberada para a sua conta.`);
  if (res.status === 408) throw new MonitoringError(`${who}: relógio fora de sincronia com o servidor (erro 408). Tente de novo.`);
  if (res.status === 429) throw new MonitoringError(`${who}: muitas consultas seguidas. Tente de novo em alguns minutos.`);
  if (!res.ok) throw new MonitoringError(`${who}: o servidor respondeu ${res.status}.`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new MonitoringError(`${who}: resposta inesperada do servidor.`);
  }
}

export async function call(fetch: Fetch, url: string, init: RequestInit, who: string) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch (e) {
    const timeout = e instanceof Error && /timeout|abort/i.test(e.name + e.message);
    throw new MonitoringError(`${who}: ${timeout ? "o servidor demorou demais para responder" : "não foi possível conectar ao servidor"}.`);
  }
  return res;
}

/** Executa em paralelo com limite (respeita os limites de taxa das APIs). */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
export const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
export const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** Primeiro dia do mês e hoje (AAAA-MM-DD) no fuso de Brasília. */
export function monthRange(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  return { start: `${local.slice(0, 8)}01`, end: local };
}
