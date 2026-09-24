"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mesclarConfig } from "./defaults";
import type { Config, Dados, Tabela } from "./types";

/**
 * Duas formas de guardar os dados, com a mesma interface:
 *  - "nuvem": Supabase (vários aparelhos, login da equipe, tempo real);
 *  - "local": este navegador (modo demonstração, funciona sem configurar nada).
 */
export interface Backend {
  modo: "nuvem" | "local";
  carregar(): Promise<Dados>;
  salvar<T extends { id: string }>(tabela: Tabela, linha: T): Promise<void>;
  excluir(tabela: Tabela, id: string): Promise<void>;
  salvarConfig(cfg: Config): Promise<void>;
  /** Avisa quando outro aparelho alterou algo. Retorna a função para parar de ouvir. */
  ouvir(cb: () => void): () => void;
}

const TABELAS: Tabela[] = ["equipamentos", "clientes", "locacoes", "lancamentos"];

function limparUrl(url: string) {
  if (!url) return "";
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

const SUPABASE_URL = limparUrl(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "");
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
export const temNuvem = Boolean(SUPABASE_URL && SUPABASE_KEY);

let sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!sb) sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  return sb;
}

/* ------------------------------------------------------------------ Supabase */

function nuvem(): Backend {
  const c = supabase();
  const must = <T,>(r: { data: T | null; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };
  return {
    modo: "nuvem",
    async carregar() {
      const [equipamentos, clientes, locacoes, lancamentos, cfg] = await Promise.all([
        c.from("equipamentos").select("*").order("nome"),
        c.from("clientes").select("*").order("nome"),
        c.from("locacoes").select("*").order("numero", { ascending: false }),
        c.from("lancamentos").select("*").order("data", { ascending: false }),
        c.from("config").select("dados").eq("id", 1).maybeSingle(),
      ]);
      return {
        equipamentos: must(equipamentos),
        clientes: must(clientes),
        locacoes: must(locacoes),
        lancamentos: must(lancamentos),
        config: mesclarConfig((must(cfg) as { dados: Partial<Config> } | null)?.dados),
      };
    },
    async salvar(tabela, linha) {
      must(await c.from(tabela).upsert(linha));
    },
    async excluir(tabela, id) {
      must(await c.from(tabela).delete().eq("id", id));
    },
    async salvarConfig(cfg) {
      must(await c.from("config").upsert({ id: 1, dados: cfg }));
    },
    ouvir(cb) {
      let t: ReturnType<typeof setTimeout> | undefined;
      const ch = c.channel(`quark-${Math.random().toString(36).slice(2)}`);
      for (const tabela of [...TABELAS, "config"]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => {
          clearTimeout(t);
          t = setTimeout(cb, 300);
        });
      }
      ch.subscribe();
      return () => {
        clearTimeout(t);
        c.removeChannel(ch);
      };
    },
  };
}

/* ------------------------------------------------------------------ Navegador */

const CHAVE = "quark-locacoes:v1";

function lerLocal(): Dados | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Dados>;
    return {
      equipamentos: d.equipamentos ?? [],
      clientes: d.clientes ?? [],
      locacoes: d.locacoes ?? [],
      lancamentos: d.lancamentos ?? [],
      config: mesclarConfig(d.config),
    };
  } catch {
    return null;
  }
}

function gravarLocal(d: Dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(d));
  } catch {
    // armazenamento cheio ou bloqueado: os dados ficam só na memória desta aba.
  }
}

function local(): Backend {
  let mem: Dados | null = null;
  const atual = () => (mem ??= lerLocal() ?? { equipamentos: [], clientes: [], locacoes: [], lancamentos: [], config: mesclarConfig(null) });
  return {
    modo: "local",
    async carregar() {
      mem = lerLocal() ?? atual();
      return structuredClone(mem);
    },
    async salvar(tabela, linha) {
      const d = atual();
      const lista = d[tabela] as unknown as { id: string }[];
      const i = lista.findIndex((x) => x.id === linha.id);
      if (i >= 0) lista[i] = linha;
      else lista.push(linha);
      gravarLocal(d);
    },
    async excluir(tabela, id) {
      const d = atual();
      const lista = d[tabela] as unknown as { id: string }[];
      const i = lista.findIndex((x) => x.id === id);
      if (i >= 0) lista.splice(i, 1);
      gravarLocal(d);
    },
    async salvarConfig(cfg) {
      const d = atual();
      d.config = cfg;
      gravarLocal(d);
    },
    ouvir(cb) {
      // Outra aba do mesmo navegador alterou os dados.
      const h = (e: StorageEvent) => {
        if (e.key === CHAVE) {
          mem = null;
          cb();
        }
      };
      window.addEventListener("storage", h);
      return () => window.removeEventListener("storage", h);
    },
  };
}

export function criarBackend(): Backend {
  return temNuvem ? nuvem() : local();
}
