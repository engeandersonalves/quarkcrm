import type { Cliente, Dados, Equipamento, Lancamento, Locacao } from "./types.ts";

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const digitos = (s: string) => (s || "").replace(/\D/g, "");

export interface ResultadoMescla {
  equipamentos: Equipamento[];
  clientes: Cliente[];
  locacoes: Locacao[];
  lancamentos: Lancamento[];
  /** Locações que precisaram de número novo: [antigo, novo]. */
  renumeradas: [number, number][];
}

/**
 * Junta os dados de `novo` (backup ou modo demonstração) com os que já existem em `base`,
 * sem duplicar: equipamento com o mesmo nome e cliente com o mesmo telefone (ou nome)
 * são reaproveitados, e locações com número já usado ganham o próximo número livre.
 * Devolve só o que precisa ser gravado.
 */
export function mesclarDados(base: Omit<Dados, "config">, novo: Omit<Dados, "config">): ResultadoMescla {
  const out: ResultadoMescla = { equipamentos: [], clientes: [], locacoes: [], lancamentos: [], renumeradas: [] };

  // Equipamentos
  const eqId = new Map<string, string>();
  const eqPorNome = new Map(base.equipamentos.map((e) => [norm(e.nome), e.id]));
  const eqIds = new Set(base.equipamentos.map((e) => e.id));
  for (const e of novo.equipamentos) {
    if (eqIds.has(e.id)) continue;
    const mesmo = eqPorNome.get(norm(e.nome));
    if (mesmo) {
      eqId.set(e.id, mesmo);
      continue;
    }
    out.equipamentos.push(e);
    eqIds.add(e.id);
    eqPorNome.set(norm(e.nome), e.id);
  }

  // Clientes
  const clId = new Map<string, string>();
  const clIds = new Set(base.clientes.map((c) => c.id));
  const clPorFone = new Map(base.clientes.filter((c) => digitos(c.telefone).length >= 8).map((c) => [digitos(c.telefone).slice(-8), c.id]));
  const clPorNome = new Map(base.clientes.map((c) => [norm(c.nome), c.id]));
  for (const c of novo.clientes) {
    if (clIds.has(c.id)) continue;
    const fone = digitos(c.telefone).length >= 8 ? digitos(c.telefone).slice(-8) : "";
    const mesmo = (fone && clPorFone.get(fone)) || clPorNome.get(norm(c.nome));
    if (mesmo) {
      clId.set(c.id, mesmo);
      continue;
    }
    out.clientes.push(c);
    clIds.add(c.id);
    if (fone) clPorFone.set(fone, c.id);
    clPorNome.set(norm(c.nome), c.id);
  }

  // Locações
  const locIds = new Set(base.locacoes.map((l) => l.id));
  const numeros = new Set(base.locacoes.map((l) => l.numero));
  let proximo = Math.max(0, ...base.locacoes.map((l) => l.numero || 0), ...novo.locacoes.map((l) => l.numero || 0)) + 1;
  for (const l of [...novo.locacoes].sort((a, b) => a.numero - b.numero)) {
    if (locIds.has(l.id)) continue;
    let numero = l.numero;
    if (!numero || numeros.has(numero)) {
      numero = proximo++;
      out.renumeradas.push([l.numero, numero]);
    }
    numeros.add(numero);
    locIds.add(l.id);
    out.locacoes.push({
      ...l,
      numero,
      cliente_id: l.cliente_id ? clId.get(l.cliente_id) ?? l.cliente_id : null,
      itens: l.itens.map((i) => ({ ...i, equipamento_id: eqId.get(i.equipamento_id) ?? i.equipamento_id })),
    });
  }

  // Lançamentos
  const lcIds = new Set(base.lancamentos.map((x) => x.id));
  for (const x of novo.lancamentos) {
    if (lcIds.has(x.id)) continue;
    out.lancamentos.push(x.locacao_id && !locIds.has(x.locacao_id) ? { ...x, locacao_id: null } : x);
  }
  return out;
}

/** Há algo de verdade para levar (não só o catálogo inicial)? */
export function temDadosReais(d: Omit<Dados, "config"> | null): boolean {
  return Boolean(d && (d.locacoes.length > 0 || d.clientes.length > 0 || d.lancamentos.length > 0));
}
