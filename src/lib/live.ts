"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase/client";

let channelSeq = 0;

/**
 * Busca dados e recarrega automaticamente quando qualquer uma das tabelas
 * informadas muda no banco (Supabase Realtime).
 */
export function useLive<T>(fetcher: () => Promise<T>, deps: unknown[], tables: string[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const load = useCallback(async () => {
    try {
      const result = await fetchRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const tableKey = tables.join(",");
  useEffect(() => {
    if (!tableKey) return;
    const sb = supabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = sb.channel(`live-${tableKey}-${++channelSeq}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 250);
      });
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      sb.removeChannel(channel);
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
