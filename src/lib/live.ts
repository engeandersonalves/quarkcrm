"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase/client";

/* ------------------------------------------------------------------ cache */

/**
 * Cache em memória por consulta: ao voltar para uma tela, os dados aparecem na hora
 * e são atualizados em segundo plano (stale-while-revalidate).
 */
const cache = new Map<string, unknown>();

/* --------------------------------------------------------------- realtime */

/** Um único canal Realtime para o app inteiro; cada tela só registra ouvintes. */
const listeners = new Map<string, Set<() => void>>();
let channel: RealtimeChannel | null = null;
let channelTables = "";

function syncChannel() {
  const tables = [...listeners.entries()].filter(([, set]) => set.size > 0).map(([t]) => t).sort();
  const key = tables.join(",");
  if (key === channelTables) return;
  const sb = supabase();
  if (channel) sb.removeChannel(channel);
  channel = null;
  channelTables = key;
  if (!tables.length) return;
  const ch = sb.channel(`live-${Date.now()}`);
  for (const table of tables) {
    ch.on("postgres_changes", { event: "*", schema: "public", table }, () => listeners.get(table)?.forEach((fn) => fn()));
  }
  ch.subscribe();
  channel = ch;
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync() {
  // Agrupa montagens/desmontagens de uma mesma navegação numa única troca de canal.
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncChannel, 50);
}

function subscribe(tables: string[], fn: () => void) {
  for (const t of tables) {
    if (!listeners.has(t)) listeners.set(t, new Set());
    listeners.get(t)!.add(fn);
  }
  scheduleSync();
  return () => {
    for (const t of tables) listeners.get(t)?.delete(fn);
    scheduleSync();
  };
}

/* ------------------------------------------------------------------- hook */

/**
 * Busca dados e recarrega automaticamente quando qualquer uma das tabelas
 * informadas muda no banco (Supabase Realtime).
 */
export function useLive<T>(fetcher: () => Promise<T>, deps: unknown[], tables: string[], opts: { fresh?: boolean } = {}) {
  // A chave identifica a consulta: o código da função + os parâmetros.
  // `fresh`: sempre busca do banco antes de mostrar (telas de edição).
  const key = fetcher.toString() + JSON.stringify(deps);
  const fresh = !!opts.fresh;
  const [data, setDataState] = useState<T | null>(() => (fresh ? null : ((cache.get(key) as T | undefined) ?? null)));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => fresh || !cache.has(key));
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;

  const load = useCallback(async () => {
    const k = keyRef.current;
    try {
      const result = await fetchRef.current();
      if (k !== keyRef.current) return; // parâmetros mudaram enquanto buscava
      cache.set(k, result);
      setDataState(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (k === keyRef.current) setLoading(false);
    }
  }, []);

  const setData: typeof setDataState = useCallback((v) => {
    setDataState((prev) => {
      const next = typeof v === "function" ? (v as (p: T | null) => T | null)(prev) : v;
      cache.set(keyRef.current, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const cached = fresh ? undefined : (cache.get(key) as T | undefined);
    if (cached !== undefined) {
      setDataState(cached);
      setLoading(false);
    } else {
      setDataState(null);
      setLoading(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const tableKey = tables.join(",");
  useEffect(() => {
    if (!tableKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe(tableKey.split(","), () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [tableKey, load]);

  return { data, setData, error, loading, reload: load };
}

/** Lança o erro do Supabase para ser tratado pelo chamador. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function notify(type: "lead" | "task", id: string) {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
  } catch {
    // notificação é "best effort": nunca bloqueia o usuário.
  }
}
