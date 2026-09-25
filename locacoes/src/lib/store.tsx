"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { confirmar } from "@/components/dialogo";
import { colunasFaltando, conexaoAtual, criarBackend, ehErroDeRede, ErroBanco, lerLocal, supabase, VERSAO_SCHEMA, type Backend } from "./backend";
import { addDias, codigo, fmtData, hoje, uid } from "./format";
import { catalogoInicial, mesclarConfig } from "./defaults";
import { mesclarDados, temDadosReais, type ResultadoMescla } from "./mesclar";
import { brl, descreverModalidade, diasDaLocacao, totalLocacao } from "./pricing";
import type { Assinatura, Cliente, Config, Dados, Equipamento, Lancamento, Locacao, Tabela, TermoCongelado } from "./types";

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

/** Resultado da conferência na coleta: peças com avaria vão para manutenção; faltando saem do estoque. */
export interface Conferencia {
  itens: { equipamento_id: string; avariadas: number; perdidas: number }[];
  /** Cobrar do cliente o valor de reposição das peças que faltaram. */
  cobrarPerdas: boolean;
  /** Valor extra de conserto das avarias (0 = não cobra). */
  valorConserto: number;
}

/** Situação do salvamento: tudo salvo, enviando, ou esperando a internet voltar. */
export interface Sync {
  estado: "ok" | "salvando" | "offline";
  pendentes: number;
}

type Op =
  | { k: string; tipo: "salvar"; tabela: Tabela; linha: { id: string } }
  | { k: string; tipo: "excluir"; tabela: Tabela; id: string }
  | { k: string; tipo: "config"; cfg: Config };

interface Ctx {
  dados: Dados;
  carregando: boolean;
  modo: Backend["modo"];
  session: Session | null;
  authPronto: boolean;
  /** Logado, mas o e-mail não está na lista da equipe. */
  semAcesso: boolean;
  /** Abriu pelo link "esqueci a senha": precisa definir a nova. */
  recuperandoSenha: boolean;
  sync: Sync;
  /** O banco da nuvem é de uma versão anterior: é preciso rodar o schema.sql de novo. */
  bancoDesatualizado: boolean;
  /** Dados do modo demonstração encontrados neste aparelho, prontos para irem à nuvem. */
  migracao: Dados | null;
  backend: Backend;
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
  importar(d: Dados, opcoes?: { config?: boolean }): Promise<ResultadoMescla>;
  migrar(): Promise<void>;
  dispensarMigracao(): void;
  carregarCatalogo(): Promise<void>;
  proximoNumero(): number;
  /* fluxo da locação */
  aprovar(l: Locacao): Promise<boolean>;
  voltarEtapa(l: Locacao): Promise<void>;
  cancelar(l: Locacao, motivo: string): Promise<void>;
  marcarEntregue(l: Locacao): Promise<void>;
  marcarRecolhido(l: Locacao, conferencia?: Conferencia): Promise<void>;
  renovar(l: Locacao): Promise<void>;
  definirSenha(nova: string): Promise<void>;
  /* assinatura do termo */
  termoCongelado(l: Locacao): TermoCongelado;
  prepararAssinatura(l: Locacao): Promise<Assinatura>;
  assinarPresencial(l: Locacao, dados: { nome: string; documento: string; imagem: string; selfie: string; hash: string; geo: string }): Promise<void>;
  sair(): Promise<void>;
}

const C = createContext<Ctx | null>(null);

const VAZIO: Dados = { equipamentos: [], clientes: [], locacoes: [], lancamentos: [], config: mesclarConfig(null) };
const CHAVE_FILA = "quark-locacoes:fila";
const CHAVE_MIGRADO = "quark-locacoes:migrado";
/** Última cópia dos dados da nuvem, para abrir o app mesmo sem internet (ex.: entregador na obra). */
const CHAVE_CACHE = "quark-locacoes:cache";

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

/** Aplica uma operação na cópia em memória (a tela muda na hora, antes do servidor responder). */
function aplicar(d: Dados, op: Op): Dados {
  if (op.tipo === "config") return { ...d, config: op.cfg };
  const lista = d[op.tabela] as unknown as { id: string }[];
  if (op.tipo === "excluir") return { ...d, [op.tabela]: lista.filter((x) => x.id !== op.id) };
  const existe = lista.some((x) => x.id === op.linha.id);
  return { ...d, [op.tabela]: existe ? lista.map((x) => (x.id === op.linha.id ? op.linha : x)) : [op.linha, ...lista] };
}

function lerFila(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FILA) || "[]") as Op[];
  } catch {
    return [];
  }
}

const traduzir = (msg: string) =>
  /row-level security|permission denied/i.test(msg)
    ? "Seu usuário não tem permissão (confira Ajustes → Equipe)."
    : /violates foreign key/i.test(msg)
      ? "Registro ligado a outro que não existe mais."
      : msg;

export function DadosProvider({ children }: { children: ReactNode }) {
  const backend = useRef<Backend>(null as unknown as Backend);
  if (!backend.current) backend.current = criarBackend();
  const nuvem = backend.current.modo === "nuvem";

  const [dados, setDados] = useState<Dados>(VAZIO);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authPronto, setAuthPronto] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  const [migracao, setMigracao] = useState<Dados | null>(null);
  const [bancoDesatualizado, setBancoDesatualizado] = useState(false);

  /* ---------------------------------------------------------------- fila de salvamento */

  const fila = useRef<Op[]>([]);
  const processando = useRef(false);
  const tentativa = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [sync, setSync] = useState<Sync>({ estado: "ok", pendentes: 0 });

  const persistirFila = useCallback(() => {
    try {
      if (fila.current.length) localStorage.setItem(CHAVE_FILA, JSON.stringify(fila.current));
      else localStorage.removeItem(CHAVE_FILA);
    } catch {
      /* armazenamento bloqueado */
    }
  }, []);

  const recarregarRef = useRef<() => Promise<void>>(async () => {});
  /** Usado pelo botão "Desfazer" dos avisos (definido mais abaixo). */
  const voltarRef = useRef<(l: Locacao) => Promise<void>>(async () => {});
  /** Botão "Desfazer" do aviso: age sobre a versão atual e só se ela ainda estiver na etapa do aviso. */
  const desfazer = (l: Locacao) => ({
    label: "Desfazer",
    onClick: () => {
      const atual = dadosRef.current.locacoes.find((x) => x.id === l.id);
      if (!atual || atual.status !== l.status) return void toast.info("Essa locação já mudou de etapa", { description: "Use “Desfazer etapa” na ficha dela." });
      void voltarRef.current(atual);
    },
  });

  const processar = useCallback(async () => {
    if (processando.current) return;
    processando.current = true;
    clearTimeout(timer.current);
    let recarregarDepois = false;
    let offline = false;
    while (fila.current.length) {
      setSync({ estado: "salvando", pendentes: fila.current.length });
      const op = fila.current[0];
      try {
        if (op.tipo === "config") await backend.current.salvarConfig(op.cfg);
        else if (op.tipo === "excluir") await backend.current.excluir(op.tabela, op.id);
        else await backend.current.salvar(op.tabela, op.linha);
        fila.current.shift();
        persistirFila();
        tentativa.current = 0;
        if (colunasFaltando.size) setBancoDesatualizado(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (ehErroDeRede(e)) {
          offline = true;
          break;
        }
        if (/JWT|token is expired|not authenticated/i.test(msg) && tentativa.current < 2 && nuvem) {
          tentativa.current++;
          await supabase().auth.refreshSession().catch(() => {});
          continue;
        }
        // Dois aparelhos criaram locações ao mesmo tempo com o mesmo número: pega o próximo livre.
        if (e instanceof ErroBanco && e.code === "23505" && op.tipo === "salvar" && op.tabela === "locacoes") {
          const l = op.linha as Locacao;
          const novo = Math.max(await backend.current.maiorNumero().catch(() => 0), ...dadosRef.current.locacoes.map((x) => x.numero)) + 1;
          const antigo = l.numero;
          op.linha = { ...l, numero: novo } as Locacao;
          persistirFila();
          setDados((d) => aplicar(d, op));
          toast.info(`Locação ${codigo(antigo)} passou a ser ${codigo(novo)}`, { description: "Outra pessoa da equipe usou o mesmo número ao mesmo tempo." });
          continue;
        }
        fila.current.shift();
        persistirFila();
        recarregarDepois = true;
        toast.error("Não foi possível salvar uma alteração", { description: traduzir(msg) });
      }
    }
    processando.current = false;
    if (offline) {
      tentativa.current++;
      setSync({ estado: "offline", pendentes: fila.current.length });
      timer.current = setTimeout(() => processar(), Math.min(60_000, 3000 * 2 ** Math.min(tentativa.current, 5)));
    } else {
      setSync({ estado: "ok", pendentes: 0 });
    }
    if (recarregarDepois) await recarregarRef.current();
  }, [persistirFila, nuvem]);

  const enfileirar = useCallback(
    (op: Op) => {
      setDados((d) => aplicar(d, op));
      // Duas gravações seguidas do mesmo registro viram uma só (a mais nova).
      const i = fila.current.findIndex(
        (x, idx) =>
          (idx > 0 || !processando.current) &&
          ((op.tipo === "config" && x.tipo === "config") || (op.tipo === "salvar" && x.tipo === "salvar" && x.tabela === op.tabela && x.linha.id === op.linha.id)),
      );
      if (i >= 0) fila.current[i] = op;
      else fila.current.push(op);
      persistirFila();
      setSync((s) => ({ ...s, pendentes: fila.current.length }));
      void processar();
    },
    [persistirFila, processar],
  );

  // Tenta de novo quando a internet volta ou o app volta para a tela.
  useEffect(() => {
    const retomar = () => fila.current.length && processar();
    const visivel = () => document.visibilityState === "visible" && retomar();
    window.addEventListener("online", retomar);
    document.addEventListener("visibilitychange", visivel);
    return () => {
      window.removeEventListener("online", retomar);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [processar]);

  /* ---------------------------------------------------------------- carregar */

  const emailRef = useRef("");
  const recarregar = useCallback(async () => {
    try {
      let d = await backend.current.carregar();
      // Modo demonstração, primeiro uso: já começa com o catálogo do termo.
      if (!nuvem && d.equipamentos.length === 0 && d.locacoes.length === 0 && !localStorage.getItem("quark-locacoes:semeado")) {
        const cat = catalogoInicial(d.config);
        for (const e of cat) await backend.current.salvar("equipamentos", e);
        localStorage.setItem("quark-locacoes:semeado", "1");
        d = { ...d, equipamentos: cat };
      }
      // O que ainda está na fila continua valendo por cima do que veio do servidor.
      for (const op of fila.current) d = aplicar(d, op);
      setDados(d);
    } catch (e) {
      if (ehErroDeRede(e)) {
        setSync({ estado: "offline", pendentes: fila.current.length });
        // Sem internet: mostra a última cópia deste aparelho, com as alterações pendentes por cima.
        let usouCopia = false;
        try {
          const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || "null") as { email: string; dados: Dados } | null;
          if (c && c.email === emailRef.current && dadosRef.current.equipamentos.length === 0 && dadosRef.current.locacoes.length === 0) {
            let d = { ...c.dados, config: mesclarConfig(c.dados.config) };
            for (const op of fila.current) d = aplicar(d, op);
            setDados(d);
            usouCopia = true;
          }
        } catch {
          /* sem cópia */
        }
        toast.error("Sem conexão com a nuvem", { description: usouCopia ? "Mostrando a última cópia deste aparelho. O que você alterar é enviado quando a internet voltar." : "Confira a internet. O app tenta de novo sozinho." });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => recarregarRef.current(), 8000);
      } else {
        toast.error("Não foi possível carregar os dados", { description: traduzir(e instanceof Error ? e.message : String(e)) });
      }
    } finally {
      setCarregando(false);
    }
  }, [nuvem]);
  recarregarRef.current = recarregar;

  // Sessão (apenas no modo nuvem)
  useEffect(() => {
    fila.current = lerFila();
    if (!nuvem) {
      setAuthPronto(true);
      return;
    }
    const c = supabase();
    c.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthPronto(true);
    });
    const { data } = c.auth.onAuthStateChange((ev, s) => {
      setSession(s);
      if (ev === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
    });
    return () => data.subscription.unsubscribe();
  }, [nuvem]);

  const logado = !nuvem || Boolean(session);
  const email = session?.user.email ?? "";
  emailRef.current = email;
  useEffect(() => {
    if (!authPronto || !logado) return;
    let parar: (() => void) | undefined;
    let cancelado = false;
    const iniciar = async () => {
      // Abre na hora com a cópia deste aparelho; os dados novos chegam logo em seguida.
      if (nuvem && dadosRef.current.equipamentos.length === 0 && dadosRef.current.locacoes.length === 0) {
        try {
          const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || "null") as { email: string; dados: Dados } | null;
          if (c && c.email === email) {
            let d = { ...c.dados, config: mesclarConfig(c.dados.config) };
            for (const op of fila.current) d = aplicar(d, op);
            setDados(d);
            setCarregando(false);
          }
        } catch {
          /* sem cópia */
        }
      }
      try {
        const ok = await backend.current.entrarEquipe();
        if (cancelado) return;
        setSemAcesso(!ok);
        if (!ok) return setCarregando(false);
      } catch {
        // Sem internet para confirmar a equipe: segue com o que der (a carga mostra o aviso).
      }
      await recarregar();
      if (cancelado) return;
      parar = backend.current.ouvir(recarregar);
      if (nuvem) backend.current.versaoSchema().then((v) => !cancelado && setBancoDesatualizado(v < VERSAO_SCHEMA)).catch(() => {});
      if (fila.current.length) void processar();
      // Dados do modo demonstração neste aparelho? Oferece levar para a nuvem.
      if (nuvem && localStorage.getItem(CHAVE_MIGRADO) !== "1") {
        const loc = lerLocal();
        if (temDadosReais(loc)) setMigracao(loc);
      }
    };
    void iniciar();
    return () => {
      cancelado = true;
      parar?.();
    };
  }, [authPronto, logado, email, recarregar, processar, nuvem]);

  // Mantém a cópia offline sempre igual ao que está na tela (alterações aplicam de novo sem duplicar).
  useEffect(() => {
    if (!nuvem || carregando || !email || semAcesso) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CHAVE_CACHE, JSON.stringify({ email, dados }));
      } catch {
        /* sem espaço: segue sem cópia */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [dados, nuvem, carregando, email, semAcesso]);

  /* ---------------------------------------------------------------- escrita */

  const gravar = useCallback(async <T extends { id: string }>(tabela: Tabela, linha: T) => enfileirar({ k: uid(), tipo: "salvar", tabela, linha }), [enfileirar]);
  const apagar = useCallback(async (tabela: Tabela, id: string) => enfileirar({ k: uid(), tipo: "excluir", tabela, id }), [enfileirar]);

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

  /** Cria uma cobrança (a receber) ligada à locação. */
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
      if (l.itens.length === 0) {
        toast.error("Este orçamento não tem equipamentos");
        return false;
      }
      if (!l.cliente_nome.trim()) {
        toast.error("Informe o nome do cliente antes de aprovar", { description: "Abra o orçamento em “Editar” e preencha o cliente." });
        return false;
      }
      const saldo = calcularEstoque(dadosRef.current);
      const faltas = l.itens.filter((i) => saldo[i.equipamento_id] && i.quantidade > saldo[i.equipamento_id].disponivel);
      if (faltas.length > 0) {
        const ok = await confirmar({
          titulo: "Estoque insuficiente",
          texto: faltas.map((i) => `${i.nome}: pediu ${i.quantidade}, disponível ${Math.max(0, saldo[i.equipamento_id].disponivel)}`).join("\n"),
          ok: "Aprovar mesmo assim",
        });
        if (!ok) return false;
      }
      const salva = await salvarLocacao({ ...l, status: "agendada" }, "Orçamento aprovado pelo cliente");
      const jaCobrado = dadosRef.current.lancamentos.some((x) => x.locacao_id === l.id && x.categoria === "Aluguel");
      if (!jaCobrado) await cobrar(salva, salva.valor_total, "Aluguel", `Locação ${codigo(salva.numero)} — ${salva.cliente_nome}`, salva.data_entrega || hoje());
      toast.success(`Locação ${codigo(salva.numero)} aprovada`, { description: "Foi para “Aguardando entrega” e a cobrança entrou no financeiro.", action: desfazer(salva) });
      return true;
    },
    [salvarLocacao, cobrar],
  );

  const marcarEntregue = useCallback(
    async (l: Locacao) => {
      const agora = new Date().toISOString();
      // Entregou em data diferente da prevista? A coleta acompanha.
      const dias = diasDaLocacao(l.modalidade, l.quantidade_periodos);
      const entrega = hoje();
      const coleta = l.data_entrega === entrega ? l.data_coleta : addDias(entrega, dias);
      const salva = await salvarLocacao({ ...l, status: "na_obra", entregue_em: agora, data_entrega: entrega, data_coleta: coleta }, "Equipamentos entregues na obra");
      toast.success(`${codigo(l.numero)} entregue`, { description: `Coleta prevista para ${fmtData(coleta)}.`, action: desfazer(salva) });
    },
    [salvarLocacao],
  );

  const marcarRecolhido = useCallback(
    async (l: Locacao, conf?: Conferencia) => {
      const problemas = (conf?.itens ?? []).filter((c) => c.avariadas > 0 || c.perdidas > 0);
      const partes: string[] = [];
      let reposicao = 0;
      for (const c of problemas) {
        const e = dadosRef.current.equipamentos.find((x) => x.id === c.equipamento_id);
        const nome = l.itens.find((i) => i.equipamento_id === c.equipamento_id)?.nome ?? e?.nome ?? "item";
        if (c.avariadas > 0) partes.push(`${c.avariadas} ${nome} com avaria (foi para manutenção)`);
        if (c.perdidas > 0) partes.push(`${c.perdidas} ${nome} faltando`);
        reposicao += c.perdidas * (e?.valor_reposicao ?? 0);
        if (e) await gravar("equipamentos", { ...e, em_manutencao: e.em_manutencao + c.avariadas, estoque_total: Math.max(0, e.estoque_total - c.perdidas) });
      }
      const evento = partes.length ? `Recolhido com ocorrências: ${partes.join("; ")}` : "Equipamentos recolhidos e conferidos — voltaram ao estoque";
      const salva = await salvarLocacao({ ...l, status: "finalizada", recolhido_em: new Date().toISOString() }, evento);
      const cobrancaTotal = (conf?.cobrarPerdas ? reposicao : 0) + (conf?.valorConserto ?? 0);
      if (cobrancaTotal > 0) await cobrar(salva, Math.round(cobrancaTotal * 100) / 100, "Avaria / reposição", `Avarias e peças faltando — ${codigo(l.numero)}`, hoje());
      toast.success(`${codigo(l.numero)} finalizada`, {
        description: partes.length ? `${partes.join("; ")}.${cobrancaTotal > 0 ? ` Cobrança de ${brl(cobrancaTotal)} lançada.` : ""}` : "Os itens voltaram para o estoque.",
        action: partes.length ? undefined : desfazer(salva),
      });
    },
    [salvarLocacao, gravar, cobrar],
  );

  /** Apaga as cobranças ainda não pagas da locação (ao cancelar ou voltar para orçamento). */
  const apagarCobrancasAbertas = useCallback(
    async (l: Locacao) => {
      for (const x of dadosRef.current.lancamentos.filter((x) => x.locacao_id === l.id && !x.pago)) await apagar("lancamentos", x.id);
    },
    [apagar],
  );

  /** Desfaz a última etapa (clicou por engano). */
  const voltarEtapa = useCallback(
    async (l: Locacao) => {
      if (l.status === "agendada") {
        await apagarCobrancasAbertas(l);
        await salvarLocacao({ ...l, status: "orcamento" }, "Voltou para orçamento (aprovação desfeita)");
      } else if (l.status === "na_obra") {
        await salvarLocacao({ ...l, status: "agendada", entregue_em: null }, "Entrega desfeita — voltou para “aguardando entrega”");
      } else if (l.status === "finalizada") {
        await salvarLocacao({ ...l, status: "na_obra", recolhido_em: null }, "Coleta desfeita — voltou para “na obra”");
      } else if (l.status === "recusada") {
        await salvarLocacao({ ...l, status: "orcamento" }, "Reaberto como orçamento");
      }
    },
    [salvarLocacao, apagarCobrancasAbertas],
  );
  voltarRef.current = voltarEtapa;

  const cancelar = useCallback(
    async (l: Locacao, motivo: string) => {
      await apagarCobrancasAbertas(l);
      await salvarLocacao({ ...l, status: "recusada" }, motivo);
    },
    [salvarLocacao, apagarCobrancasAbertas],
  );

  const renovar = useCallback(
    async (l: Locacao) => {
      const dias = diasDaLocacao(l.modalidade, l.quantidade_periodos);
      const aluguel = totalLocacao({ ...l, taxa_entrega: 0, taxa_retirada: 0, acrescimo: 0, desconto: 0 });
      const novaColeta = addDias(l.data_coleta || hoje(), dias);
      const salva = await salvarLocacao({ ...l, data_coleta: novaColeta }, `Contrato renovado por mais ${descreverModalidade(l.modalidade, l.quantidade_periodos)} — nova coleta ${fmtData(novaColeta)}`);
      await cobrar(salva, aluguel, "Renovação", `Renovação ${codigo(l.numero)} — ${l.cliente_nome}`, l.data_coleta || hoje());
      toast.success("Contrato renovado", { description: `Nova coleta em ${fmtData(novaColeta)}. A cobrança entrou no financeiro.` });
    },
    [salvarLocacao, cobrar],
  );

  const termoCongelado = useCallback((l: Locacao): TermoCongelado => {
    const { historico: _h, ...locacao } = l;
    void _h;
    const reposicao = Object.fromEntries(dadosRef.current.equipamentos.filter((e) => l.itens.some((i) => i.equipamento_id === e.id)).map((e) => [e.id, e.valor_reposicao]));
    return { locacao, config: dadosRef.current.config, reposicao, gerado_em: new Date().toISOString() };
  }, []);

  const prepararAssinatura = useCallback(
    async (l: Locacao) => {
      const a = await backend.current.prepararAssinatura(l.id, termoCongelado(l));
      if (!l.historico.some((h) => h.texto.startsWith("Link de assinatura"))) await salvarLocacao(l, "Link de assinatura do termo gerado para o cliente");
      return a;
    },
    [termoCongelado, salvarLocacao],
  );

  const assinarPresencial = useCallback(
    async (l: Locacao, d: { nome: string; documento: string; imagem: string; selfie: string; hash: string; geo: string }) => {
      const atual = await backend.current.assinatura(l.id).catch(() => null);
      const agora = new Date().toISOString();
      const termo = atual?.termo ?? termoCongelado(l);
      await backend.current.salvarAssinatura({
        locacao_id: l.id,
        token: atual?.token ?? uid().replace(/-/g, ""),
        criado_em: atual?.criado_em ?? agora,
        termo,
        assinado_em: agora,
        nome: d.nome,
        documento: d.documento,
        imagem: d.imagem,
        selfie: d.selfie,
        via: "presencial",
        hash: d.hash,
        ip: null,
        dispositivo: navigator.userAgent.slice(0, 300),
        geo: d.geo || null,
      });
      await salvarLocacao(
        { ...l, assinado_em: agora, assinado_por: d.nome, cliente_documento: l.cliente_documento || d.documento },
        `Termo assinado no aparelho da empresa (com selfie): ${d.nome}`,
      );
      // CPF informado na assinatura completa o cadastro do cliente.
      const cli = l.cliente_id ? dadosRef.current.clientes.find((c) => c.id === l.cliente_id) : null;
      if (cli && !cli.documento && d.documento) await gravar("clientes", { ...cli, documento: d.documento });
      toast.success("Termo assinado", { description: `${d.nome} assinou com selfie.` });
    },
    [termoCongelado, salvarLocacao, gravar],
  );

  const importar = useCallback(
    async (d: Dados, opcoes?: { config?: boolean }) => {
      const r = mesclarDados(dadosRef.current, d);
      for (const e of r.equipamentos) await gravar("equipamentos", e);
      for (const c of r.clientes) await gravar("clientes", c);
      for (const l of r.locacoes) await gravar("locacoes", l);
      for (const x of r.lancamentos) await gravar("lancamentos", x);
      if (opcoes?.config) enfileirar({ k: uid(), tipo: "config", cfg: mesclarConfig(d.config) });
      return r;
    },
    [gravar, enfileirar],
  );

  const value = useMemo<Ctx>(
    () => ({
      dados,
      carregando,
      modo: backend.current.modo,
      session,
      authPronto,
      semAcesso,
      recuperandoSenha,
      sync,
      bancoDesatualizado,
      migracao,
      backend: backend.current,
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
        enfileirar({ k: uid(), tipo: "config", cfg: c });
      },
      importar,
      async migrar() {
        if (!migracao) return;
        // A configuração do aparelho só vai junto se a nuvem ainda estiver com a padrão.
        const nuvemPadrao = JSON.stringify(dadosRef.current.config) === JSON.stringify(mesclarConfig(null));
        const r = await importar(migracao, { config: nuvemPadrao });
        localStorage.setItem(CHAVE_MIGRADO, "1");
        setMigracao(null);
        toast.success("Dados enviados para a nuvem", {
          description: `${r.locacoes.length} locações, ${r.clientes.length} clientes e ${r.lancamentos.length} lançamentos${r.renumeradas.length ? ` (${r.renumeradas.length} renumeradas)` : ""}.`,
        });
      },
      dispensarMigracao() {
        localStorage.setItem(CHAVE_MIGRADO, "1");
        setMigracao(null);
      },
      async carregarCatalogo() {
        const existentes = new Set(dadosRef.current.equipamentos.map((e) => e.nome.toLowerCase()));
        for (const e of catalogoInicial(dadosRef.current.config)) if (!existentes.has(e.nome.toLowerCase())) await gravar("equipamentos", e);
      },
      proximoNumero,
      aprovar,
      voltarEtapa,
      cancelar,
      marcarEntregue,
      marcarRecolhido,
      renovar,
      termoCongelado,
      prepararAssinatura,
      assinarPresencial,
      async definirSenha(nova) {
        const r = await supabase().auth.updateUser({ password: nova });
        if (r.error) throw r.error;
        setRecuperandoSenha(false);
      },
      async sair() {
        if (nuvem) await supabase().auth.signOut();
        try {
          localStorage.removeItem(CHAVE_CACHE);
        } catch {
          /* ok */
        }
        setDados(VAZIO);
      },
    }),
    [dados, carregando, session, authPronto, semAcesso, recuperandoSenha, sync, bancoDesatualizado, migracao, termoCongelado, prepararAssinatura, assinarPresencial, recarregar, gravar, apagar, enfileirar, salvarLocacao, salvarLancamento, importar, proximoNumero, aprovar, voltarEtapa, cancelar, marcarEntregue, marcarRecolhido, renovar, nuvem],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useDados() {
  const c = useContext(C);
  if (!c) throw new Error("useDados fora do DadosProvider");
  return c;
}

export const temNuvemConfigurada = () => Boolean(conexaoAtual());
