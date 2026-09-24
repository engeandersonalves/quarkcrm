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
  /** Maior número de locação já gravado no servidor (para resolver números repetidos). */
  maiorNumero(): Promise<number>;
  /** Nuvem: confirma que o e-mail logado faz parte da equipe (o 1º a entrar vira administrador). */
  entrarEquipe(): Promise<boolean>;
  equipe(): Promise<string[]>;
  adicionarEquipe(email: string): Promise<void>;
  removerEquipe(email: string): Promise<void>;
  /** Avisa quando outro aparelho alterou algo. Retorna a função para parar de ouvir. */
  ouvir(cb: () => void): () => void;
}

/** Erro do banco com o código do Postgres (ex.: 23505 = valor repetido). */
export class ErroBanco extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Falha de conexão (sem internet, servidor fora): vale tentar de novo depois. */
export function ehErroDeRede(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|ECONN|\b50[234]\b/i.test(msg);
}

const TABELAS: Tabela[] = ["equipamentos", "clientes", "locacoes", "lancamentos"];

/* ------------------------------------------------------------------ Configuração da nuvem */

export interface ConexaoNuvem {
  url: string;
  chave: string;
}

const CHAVE_CONEXAO = "quark-locacoes:nuvem";

export function limparUrl(url: string) {
  const u = (url || "").trim();
  if (!u) return "";
  try {
    return new URL(u.includes("://") ? u : `https://${u}`).origin;
  } catch {
    return u.replace(/\/+$/, "");
  }
}

const ENV: ConexaoNuvem = {
  url: limparUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
  chave: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
};

/** Link "#conectar=…" (gerado em Ajustes) configura a nuvem em outro aparelho. */
export function codificarConexao(c: ConexaoNuvem) {
  return btoa(JSON.stringify({ u: c.url, k: c.chave })).replace(/=+$/, "");
}

function decodificarConexao(s: string): ConexaoNuvem | null {
  try {
    const j = JSON.parse(atob(s));
    if (typeof j.u === "string" && typeof j.k === "string" && j.u && j.k) return { url: limparUrl(j.u), chave: j.k.trim() };
  } catch {
    /* link inválido */
  }
  return null;
}

/**
 * De onde vem a conexão: variáveis da Vercel (preferência) ou a salva neste aparelho
 * (Ajustes → Nuvem, ou o link/QR Code de conexão).
 */
export function conexaoAtual(): (ConexaoNuvem & { origem: "vercel" | "aparelho" }) | null {
  if (ENV.url && ENV.chave) return { ...ENV, origem: "vercel" };
  if (typeof window === "undefined") return null;
  try {
    const m = window.location.hash.match(/conectar=([A-Za-z0-9+/_-]+)/);
    if (m) {
      const c = decodificarConexao(m[1]);
      if (c) localStorage.setItem(CHAVE_CONEXAO, JSON.stringify(c));
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const raw = localStorage.getItem(CHAVE_CONEXAO);
    if (raw) {
      const c = JSON.parse(raw) as ConexaoNuvem;
      if (c.url && c.chave) return { ...c, origem: "aparelho" };
    }
  } catch {
    /* armazenamento bloqueado */
  }
  return null;
}

export function salvarConexao(c: ConexaoNuvem | null) {
  try {
    if (c) localStorage.setItem(CHAVE_CONEXAO, JSON.stringify({ url: limparUrl(c.url), chave: c.chave.trim() }));
    else localStorage.removeItem(CHAVE_CONEXAO);
  } catch {
    /* armazenamento bloqueado */
  }
}

/** Testa URL e chave antes de salvar e explica em português o que está errado. */
export async function testarConexao(c: ConexaoNuvem): Promise<{ ok: true } | { ok: false; erro: string }> {
  const url = limparUrl(c.url);
  if (!/^https:\/\/.+/.test(url)) return { ok: false, erro: "A URL deve começar com https:// (ex.: https://abcd.supabase.co)." };
  if (c.chave.trim().length < 20) return { ok: false, erro: "A chave parece incompleta. Copie a chave pública (anon / publishable) inteira." };
  try {
    const cli = createClient(url, c.chave.trim(), { auth: { persistSession: false, autoRefreshToken: false } });
    const r = await cli.from("config").select("id").limit(1);
    if (!r.error) return { ok: true };
    const msg = r.error.message || "";
    if (/does not exist|schema cache|Could not find the table/i.test(msg)) return { ok: false, erro: "Conectou, mas o banco ainda não tem as tabelas. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase." };
    if (/Invalid API key|JWT|apikey|No API key/i.test(msg)) return { ok: false, erro: "A chave não é aceita por este projeto. Confira se copiou a chave pública do MESMO projeto da URL." };
    return { ok: false, erro: msg };
  } catch (e) {
    return { ok: false, erro: ehErroDeRede(e) ? "Não foi possível falar com esse endereço. Confira a URL e a internet." : e instanceof Error ? e.message : String(e) };
  }
}

let sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!sb) {
    const c = conexaoAtual();
    if (!c) throw new Error("Nuvem não configurada");
    sb = createClient(c.url, c.chave);
  }
  return sb;
}

/* ------------------------------------------------------------------ Supabase */

function nuvem(): Backend {
  const c = supabase();
  const must = <T,>(r: { data: T | null; error: { message: string; code?: string } | null }) => {
    if (r.error) throw new ErroBanco(r.error.message, r.error.code);
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
    async maiorNumero() {
      const r = must(await c.from("locacoes").select("numero").order("numero", { ascending: false }).limit(1)) as { numero: number }[];
      return r[0]?.numero ?? 0;
    },
    async entrarEquipe() {
      const r = await c.rpc("entrar_equipe");
      if (r.error) {
        if (ehErroDeRede(new Error(r.error.message))) throw new ErroBanco(r.error.message);
        // Banco criado com a versão antiga do schema (sem a função): não bloqueia.
        return true;
      }
      return Boolean(r.data);
    },
    async equipe() {
      return (must(await c.from("equipe").select("email").order("criado_em")) as { email: string }[]).map((x) => x.email);
    },
    async adicionarEquipe(email) {
      must(await c.from("equipe").upsert({ email: email.trim().toLowerCase() }));
    },
    async removerEquipe(email) {
      must(await c.from("equipe").delete().eq("email", email));
    },
    ouvir(cb) {
      let t: ReturnType<typeof setTimeout> | undefined;
      const ch = c.channel(`quark-${Math.random().toString(36).slice(2)}`);
      for (const tabela of [...TABELAS, "config"]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => {
          clearTimeout(t);
          t = setTimeout(cb, 400);
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

export const CHAVE_LOCAL = "quark-locacoes:v1";

export function lerLocal(): Dados | null {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
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
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(d));
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
    async maiorNumero() {
      return atual().locacoes.reduce((m, l) => Math.max(m, l.numero || 0), 0);
    },
    entrarEquipe: async () => true,
    equipe: async () => [],
    adicionarEquipe: async () => {},
    removerEquipe: async () => {},
    ouvir(cb) {
      // Outra aba do mesmo navegador alterou os dados.
      const h = (e: StorageEvent) => {
        if (e.key === CHAVE_LOCAL) {
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
  return conexaoAtual() ? nuvem() : local();
}
