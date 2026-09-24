"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { criarBackend, supabase, temNuvem, type Backend } from "./backend";
import { addDias, hoje, uid } from "./format";
import { catalogoInicial, mesclarConfig } from "./defaults";
import { descreverModalidade, diasDaLocacao, totalLocacao } from "./pricing";
import type { Cliente, Config, Dados, Equipamento, Lancamento, Locacao, Tabela } from "./types";

export interface SaldoEstoque {
  total: number;
  manutencao: number;
  /** Na obra (entregue e ainda não recolhido). */
  naObra: number;
  /** Aprovado, aguardando entrega. */
  reservado: number;
  /** Em orçamentos abertos (não bloqueia o estoque). */
  emOrcamento: number;
  disponivel: number;
}

interface Ctx {
  dados: Dados;
  carregando: boolean;
  modo: Backend["modo"];
  session: Session | null;
  authPronto: boolean;
  estoque: Record<string, SaldoEstoque>;
  recarregar(): Promise<void>;
  salvarEquipamento(e: Equipamento): Promise<void>;
  excluirEquipamento(id: string): Promise<void>;
  salvarCliente(c: Cliente): Promise<void>;
  excluirCliente(id: string): Promise<void>;
  salvarLocacao(l: Locacao, evento?: string): Promise<Locacao>;
  excluirLocacao(id: string): Promise<void>;
  salvarLancamento(l: Lancamento): Promise<void>;
  excluirLancamento(id: string): Promise<void>;
  salvarConfig(c: Config): Promise<void>;
  importar(d: Dados): Promise<void>;
  proximoNumero(): number;
  /* fluxo da locação */
  aprovar(l: Locacao): Promise<void>;
  marcarEntregue(l: Locacao): Promise<void>;
  marcarRecolhido(l: Locacao): Promise<void>;
  renovar(l: Locacao): Promise<void>;
  sair(): Promise<void>;
}

const C = createContext<Ctx | null>(null);

const VAZIO: Dados = { equipamentos: [], clientes: [], locacoes: [], lancamentos: [], config: mesclarConfig(null) };

export function calcularEstoque(d: Dados): Record<string, SaldoEstoque> {
  const out: Record<string, SaldoEstoque> = {};
  for (const e of d.equipamentos) {
    out[e.id] = { total: e.estoque_total, manutencao: e.em_manutencao, naObra: 0, reservado: 0, emOrcamento: 0, disponivel: 0 };
  }
  for (const l of d.locacoes) {
    for (const it of l.itens) {
      const s = out[it.equipamento_id];
      if (!s) continue;
      if (l.status === "na_obra") s.naObra += it.quantidade;
      else if (l.status === "agendada") s.reservado += it.quantidade;
      else if (l.status === "orcamento") s.emOrcamento += it.quantidade;
    }
  }
  for (const s of Object.values(out)) s.disponivel = s.total - s.manutencao - s.naObra - s.reservado;
  return out;
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const backend = useRef<Backend>(null as unknown as Backend);
  if (!backend.current) backend.current = criarBackend();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authPronto, setAuthPronto] = useState(!temNuvem);

  const recarregar = useCallback(async () => {
    try {
      let d = await backend.current.carregar();
      // Primeiro uso: já começa com o catálogo do termo de aluguel.
      if (backend.current.modo === "local" && d.equipamentos.length === 0 && d.locacoes.length === 0 && !localStorage.getItem("quark-locacoes:semeado")) {
        const cat = catalogoInicial(d.config);
        for (const e of cat) await backend.current.salvar("equipamentos", e);
        localStorage.setItem("quark-locacoes:semeado", "1");
        d = { ...d, equipamentos: cat };
      }
      setDados(d);
    } catch (e) {
      toast.error("Não foi possível carregar os dados", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCarregando(false);
    }
  }, []);

  // Sessão (apenas no modo nuvem)
  useEffect(() => {
    if (!temNuvem) return;
    const c = supabase();
    c.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthPronto(true);
    });
    const { data } = c.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const logado = !temNuvem || Boolean(session);
  useEffect(() => {
    if (!authPronto || !logado) return;
    recarregar();
    return backend.current.ouvir(recarregar);
  }, [authPronto, logado, recarregar]);

  /* ---------------------------------------------------------------- escrita otimista */

  const gravar = useCallback(
    async <T extends { id: string }>(tabela: Tabela, linha: T) => {
      setDados((d) => {
        const lista = d[tabela] as unknown as T[];
        const existe = lista.some((x) => x.id === linha.id);
        return { ...d, [tabela]: existe ? lista.map((x) => (x.id === linha.id ? linha : x)) : [linha, ...lista] };
      });
      try {
        await backend.current.salvar(tabela, linha);
      } catch (e) {
        toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : String(e) });
        await recarregar();
        throw e;
      }
    },
    [recarregar],
  );

  const apagar = useCallback(
    async (tabela: Tabela, id: string) => {
      setDados((d) => ({ ...d, [tabela]: (d[tabela] as unknown as { id: string }[]).filter((x) => x.id !== id) }));
      try {
        await backend.current.excluir(tabela, id);
      } catch (e) {
        toast.error("Erro ao excluir", { description: e instanceof Error ? e.message : String(e) });
        await recarregar();
        throw e;
      }
    },
    [recarregar],
  );

  const proximoNumero = useCallback(() => dadosRef.current.locacoes.reduce((m, l) => Math.max(m, l.numero || 0), 0) + 1, []);

  const salvarLocacao = useCallback(
    async (l: Locacao, evento?: string) => {
      const agora = new Date().toISOString();
      const nova: Locacao = {
        ...l,
        valor_total: totalLocacao(l),
        atualizado_em: agora,
        historico: evento ? [...(l.historico ?? []), { em: agora, texto: evento }] : l.historico ?? [],
      };
      await gravar("locacoes", nova);
      return nova;
    },
    [gravar],
  );

  const salvarLancamento = useCallback((x: Lancamento) => gravar("lancamentos", x), [gravar]);

  /** Cria a cobrança do aluguel no financeiro (a receber). */
  const cobrar = useCallback(
    async (l: Locacao, valor: number, categoria: string, descricao: string, data: string) => {
      if (valor <= 0) return;
      await salvarLancamento({
        id: uid(),
        tipo: "entrada",
        categoria,
        descricao,
        valor,
        data,
        pago: false,
        pago_em: null,
        forma: "PIX",
        locacao_id: l.id,
        modalidade: l.modalidade,
        criado_em: new Date().toISOString(),
      });
    },
    [salvarLancamento],
  );

  const aprovar = useCallback(
    async (l: Locacao) => {
      const salva = await salvarLocacao({ ...l, status: "agendada" }, "Orçamento aprovado pelo cliente");
      const jaCobrado = dadosRef.current.lancamentos.some((x) => x.locacao_id === l.id && x.categoria === "Aluguel");
      if (!jaCobrado) await cobrar(salva, salva.valor_total, "Aluguel", `Locação #${salva.numero} — ${salva.cliente_nome}`, salva.data_entrega || hoje());
      toast.success(`Locação #${salva.numero} aprovada`, { description: "Foi para “Aguardando entrega” e a cobrança entrou no financeiro." });
    },
    [salvarLocacao, cobrar],
  );

  const marcarEntregue = useCallback(
    async (l: Locacao) => {
      const agora = new Date().toISOString();
      // Se entregou em data diferente da prevista, a coleta acompanha.
      const dias = diasDaLocacao(l.modalidade, l.quantidade_periodos);
      const entrega = hoje();
      await salvarLocacao(
        { ...l, status: "na_obra", entregue_em: agora, data_entrega: entrega, data_coleta: l.data_entrega === entrega ? l.data_coleta : addDias(entrega, dias) },
        "Equipamentos entregues na obra",
      );
      toast.success(`#${l.numero} entregue`, { description: "Contagem do prazo iniciada." });
    },
    [salvarLocacao],
  );

  const marcarRecolhido = useCallback(
    async (l: Locacao) => {
      await salvarLocacao({ ...l, status: "finalizada", recolhido_em: new Date().toISOString() }, "Equipamentos recolhidos — voltaram ao estoque");
      toast.success(`#${l.numero} finalizada`, { description: "Os itens voltaram para o estoque." });
    },
    [salvarLocacao],
  );

  const renovar = useCallback(
    async (l: Locacao) => {
      const dias = diasDaLocacao(l.modalidade, l.quantidade_periodos);
      const aluguel = totalLocacao({ ...l, taxa_entrega: 0, taxa_retirada: 0, acrescimo: 0, desconto: 0 });
      const novaColeta = addDias(l.data_coleta || hoje(), dias);
      const salva = await salvarLocacao({ ...l, data_coleta: novaColeta }, `Contrato renovado por mais ${descreverModalidade(l.modalidade, l.quantidade_periodos)} — nova coleta ${novaColeta.split("-").reverse().join("/")}`);
      await cobrar(salva, aluguel, "Renovação", `Renovação #${l.numero} — ${l.cliente_nome}`, l.data_coleta || hoje());
      toast.success("Contrato renovado", { description: "A cobrança da renovação entrou no financeiro." });
    },
    [salvarLocacao, cobrar],
  );

  const value = useMemo<Ctx>(
    () => ({
      dados,
      carregando,
      modo: backend.current.modo,
      session,
      authPronto,
      estoque: calcularEstoque(dados),
      recarregar,
      salvarEquipamento: (e) => gravar("equipamentos", e),
      excluirEquipamento: (id) => apagar("equipamentos", id),
      salvarCliente: (c) => gravar("clientes", c),
      excluirCliente: (id) => apagar("clientes", id),
      salvarLocacao,
      async excluirLocacao(id) {
        for (const x of dadosRef.current.lancamentos.filter((x) => x.locacao_id === id && !x.pago)) await apagar("lancamentos", x.id);
        await apagar("locacoes", id);
      },
      salvarLancamento,
      excluirLancamento: (id) => apagar("lancamentos", id),
      async salvarConfig(c) {
        setDados((d) => ({ ...d, config: c }));
        await backend.current.salvarConfig(c);
      },
      async importar(d) {
        for (const t of ["equipamentos", "clientes", "locacoes", "lancamentos"] as Tabela[]) {
          for (const linha of d[t] as unknown as { id: string }[]) await backend.current.salvar(t, linha);
        }
        await backend.current.salvarConfig(mesclarConfig(d.config));
        await recarregar();
      },
      proximoNumero,
      aprovar,
      marcarEntregue,
      marcarRecolhido,
      renovar,
      async sair() {
        if (temNuvem) await supabase().auth.signOut();
      },
    }),
    [dados, carregando, session, authPronto, recarregar, gravar, apagar, salvarLocacao, salvarLancamento, proximoNumero, aprovar, marcarEntregue, marcarRecolhido, renovar],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useDados() {
  const c = useContext(C);
  if (!c) throw new Error("useDados fora do DadosProvider");
  return c;
}

export function precisaLogin(session: Session | null) {
  return temNuvem && !session;
}
