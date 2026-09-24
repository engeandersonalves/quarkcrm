"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Boxes, CalendarDays, Check, FileText, MapPinned, MessageCircle, Package, Plus, RotateCcw, Save, Search, Truck, UserRound } from "lucide-react";
import { useDados } from "@/lib/store";
import { addDias, codigo, fmtData, fmtDataCurta, fmtDocumento, fmtNum, fmtTelefone, linkWhatsApp, normalizar, soDigitos, temEndereco } from "@/lib/format";
import { mensagemOrcamento } from "@/lib/mensagens";
import { novaLocacao, novoCliente } from "@/lib/novo";
import { brl, comparativo, descreverModalidade, descreverPartes, diasDaLocacao, PERIODOS, precosDe, totalLocacao, valorAluguel } from "@/lib/pricing";
import type { Cliente, Equipamento, Locacao, Modalidade } from "@/lib/types";
import { EnderecoForm } from "./endereco-form";
import { Badge, Button, Card, cx, Field, Input, MoneyInput, Segmented, Skeleton, Stepper, Textarea } from "./ui";

const CHAVE_RASCUNHO = "quark-locacoes:rascunho";

/** Orçamento novo ainda não salvo fica guardado no aparelho (fechou sem querer? volta de onde parou). */
function lerRascunho(): Locacao | null {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || "null") as Locacao | null;
    return r && r.numero === 0 && Array.isArray(r.itens) ? r : null;
  } catch {
    return null;
  }
}

const PERGUNTA: Record<Modalidade, string> = {
  diaria: "Quantas diárias?",
  semanal: "Quantas semanas?",
  quinzenal: "Quantas quinzenas?",
  mensal: "Quantos meses?",
  dias: "Quantos dias?",
};

function Secao({ n, titulo, sub, icon, children, acao }: { n: number; titulo: string; sub?: string; icon: React.ReactNode; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-brand-300">
            {icon}
            <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-400 text-[10px] font-bold text-ink-950 ring-2 ring-white">{n}</span>
          </span>
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight">{titulo}</h2>
            {sub && <p className="text-[12.5px] text-ink-500">{sub}</p>}
          </div>
        </div>
        {acao}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function Orcamento({ editarId, clienteId }: { editarId?: string | null; clienteId?: string | null }) {
  const router = useRouter();
  const { dados, estoque, carregando, salvarLocacao, salvarCliente, salvarLancamento, aprovar, proximoNumero } = useDados();
  const cfg = dados.config;
  const rascunhoInicial = useRef<Locacao | null>(!editarId && !clienteId && typeof window !== "undefined" ? lerRascunho() : null);
  const [l, setL] = useState<Locacao>(() => rascunhoInicial.current ?? novaLocacao(cfg));
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<null | "salvar" | "aprovar" | "whats" | "pdf">(null);
  const [sugestoes, setSugestoes] = useState(false);
  const carregouEdicao = useRef<string | null>(null);

  // Abrir um orçamento existente para editar (?editar=id)
  useEffect(() => {
    if (!editarId || carregouEdicao.current === editarId) return;
    const x = dados.locacoes.find((y) => y.id === editarId);
    if (x) {
      setL(structuredClone(x));
      carregouEdicao.current = editarId;
    }
  }, [editarId, dados.locacoes]);

  // Avisa que recuperou o rascunho, com opção de começar do zero.
  useEffect(() => {
    if (rascunhoInicial.current) {
      toast("Orçamento em andamento recuperado", { description: "Continuando de onde você parou.", action: { label: "Começar do zero", onClick: () => limpar() } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda o rascunho a cada alteração (só orçamento novo, ainda sem número).
  useEffect(() => {
    try {
      if (l.numero === 0 && (l.itens.length > 0 || l.cliente_nome.trim())) localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(l));
      else if (l.numero > 0) localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
      /* armazenamento bloqueado */
    }
  }, [l]);

  // Novo orçamento já com um cliente (?cliente=id)
  useEffect(() => {
    if (!clienteId || editarId) return;
    const c = dados.clientes.find((x) => x.id === clienteId);
    if (c) setL((x) => (x.cliente_id ? x : { ...x, cliente_id: c.id, cliente_nome: c.nome, cliente_telefone: c.telefone, cliente_documento: c.documento, endereco: { ...c.endereco } }));
  }, [clienteId, editarId, dados.clientes]);

  // Taxa de entrega padrão quando a configuração chega da nuvem
  useEffect(() => {
    setL((x) => (x.numero === 0 && x.itens.length === 0 ? { ...x, taxa_entrega: cfg.taxa_entrega_padrao } : x));
  }, [cfg.taxa_entrega_padrao]);

  const atualizar = (patch: Partial<Locacao>) =>
    setL((x) => {
      const n = { ...x, ...patch };
      if ("modalidade" in patch || "quantidade_periodos" in patch || "data_entrega" in patch) {
        n.data_coleta = addDias(n.data_entrega, diasDaLocacao(n.modalidade, n.quantidade_periodos));
      }
      return n;
    });

  const equipamentos = useMemo(() => {
    const q = normalizar(busca);
    return dados.equipamentos.filter((e) => (e.ativo || l.itens.some((i) => i.equipamento_id === e.id)) && (!q || normalizar(`${e.nome} ${e.categoria}`).includes(q)));
  }, [dados.equipamentos, busca, l.itens]);

  const qtdDe = (id: string) => l.itens.find((i) => i.equipamento_id === id)?.quantidade ?? 0;

  function setQtd(e: Equipamento, q: number) {
    setL((x) => {
      const existe = x.itens.find((i) => i.equipamento_id === e.id);
      let itens = x.itens;
      if (q <= 0) itens = x.itens.filter((i) => i.equipamento_id !== e.id);
      else if (existe) itens = x.itens.map((i) => (i.equipamento_id === e.id ? { ...i, quantidade: q } : i));
      else itens = [...x.itens, { equipamento_id: e.id, nome: e.nome, unidade: e.unidade, quantidade: q, precos: precosDe(e) }];
      return { ...x, itens };
    });
  }

  /* ------------------------------------------------ cliente */
  const clientesSugeridos = useMemo(() => {
    const q = normalizar(l.cliente_nome);
    const qd = l.cliente_nome.replace(/\D/g, "");
    if (!q || q.length < 2) return [];
    return dados.clientes
      .filter((c) => normalizar(c.nome).includes(q) || (qd.length >= 4 && c.telefone.replace(/\D/g, "").includes(qd)))
      .slice(0, 6);
  }, [l.cliente_nome, dados.clientes]);

  function escolherCliente(c: Cliente) {
    setL((x) => ({
      ...x,
      cliente_id: c.id,
      cliente_nome: c.nome,
      cliente_telefone: c.telefone,
      cliente_documento: c.documento,
      endereco: temEndereco(x.endereco) ? x.endereco : { ...c.endereco },
    }));
    setSugestoes(false);
  }

  /* ------------------------------------------------ cálculos */
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const total = totalLocacao(l);
  const comp = comparativo(l.itens);
  const maxPorDia = Math.max(...comp.map((c) => c.porDia), 0.0001);
  const faltando = l.itens.filter((i) => {
    const s = estoque[i.equipamento_id];
    if (!s) return false;
    // Ao editar uma locação já aprovada, as peças dela já estão descontadas do saldo.
    const jaReservado = l.status === "agendada" || l.status === "na_obra" ? (dados.locacoes.find((y) => y.id === l.id)?.itens.find((y) => y.equipamento_id === i.equipamento_id)?.quantidade ?? 0) : 0;
    return i.quantidade > s.disponivel + jaReservado;
  });
  const dias = diasDaLocacao(l.modalidade, l.quantidade_periodos);
  const numero = l.numero || proximoNumero();

  /* ------------------------------------------------ salvar */
  async function persistir(evento: string): Promise<Locacao | null> {
    if (l.itens.length === 0) {
      toast.error("Escolha pelo menos um equipamento");
      return null;
    }
    let cliente_id = l.cliente_id;
    if (l.cliente_nome.trim()) {
      // Não escolheu da lista, mas o cliente já existe (mesmo telefone ou mesmo nome)? Reaproveita.
      if (!cliente_id) {
        const fone = soDigitos(l.cliente_telefone).slice(-8);
        const achado =
          (fone.length === 8 && dados.clientes.find((c) => soDigitos(c.telefone).slice(-8) === fone)) ||
          dados.clientes.find((c) => normalizar(c.nome).trim() === normalizar(l.cliente_nome).trim());
        if (achado) cliente_id = achado.id;
      }
      const existente = cliente_id ? dados.clientes.find((c) => c.id === cliente_id) : null;
      const c: Cliente = existente
        ? {
            ...existente,
            nome: l.cliente_nome.trim(),
            telefone: l.cliente_telefone || existente.telefone,
            documento: l.cliente_documento || existente.documento,
            endereco: temEndereco(existente.endereco) ? existente.endereco : l.endereco,
          }
        : { ...novoCliente(), nome: l.cliente_nome.trim(), telefone: l.cliente_telefone, documento: l.cliente_documento, endereco: l.endereco };
      await salvarCliente(c);
      cliente_id = c.id;
    }
    const salva = await salvarLocacao({ ...l, cliente_id, numero: l.numero || proximoNumero(), cliente_nome: l.cliente_nome.trim() }, evento);
    // Locação já aprovada: a cobrança em aberto acompanha o novo valor.
    if (salva.status !== "orcamento") {
      const cobranca = dados.lancamentos.find((x) => x.locacao_id === salva.id && x.categoria === "Aluguel" && !x.pago);
      if (cobranca && cobranca.valor !== salva.valor_total) await salvarLancamento({ ...cobranca, valor: salva.valor_total });
    }
    setL(salva);
    return salva;
  }

  async function acao(tipo: "salvar" | "aprovar" | "whats" | "pdf") {
    if (tipo === "aprovar" && !l.cliente_nome.trim()) return toast.error("Informe o nome do cliente para aprovar");
    // Abre a aba já no clique (senão o navegador bloqueia o pop-up).
    const aba = tipo === "whats" || tipo === "pdf" ? window.open("about:blank", "_blank") : null;
    setSalvando(tipo);
    try {
      const novo = l.numero === 0;
      const s = await persistir(novo ? "Orçamento criado" : "Orçamento atualizado");
      if (!s) {
        aba?.close();
        return;
      }
      if (tipo === "salvar") {
        toast.success(`${s.status === "orcamento" ? "Orçamento" : "Locação"} ${codigo(s.numero)} salvo`, { action: { label: "Abrir ficha", onClick: () => router.push(`/locacoes/${s.id}`) } });
      } else if (tipo === "aprovar") {
        if (await aprovar(s)) router.push(`/locacoes/${s.id}`);
      } else if (tipo === "whats" && aba) {
        aba.location.href = linkWhatsApp(s.cliente_telefone, mensagemOrcamento(s, cfg));
      } else if (tipo === "pdf" && aba) {
        aba.location.href = `/documento/${s.id}?tipo=orcamento`;
      }
    } catch {
      aba?.close();
    } finally {
      setSalvando(null);
    }
  }

  function limpar() {
    try {
      localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
      /* armazenamento bloqueado */
    }
    setL(novaLocacao(cfg));
    carregouEdicao.current = null;
    if (editarId || clienteId) router.replace("/");
  }

  const editando = l.numero > 0;

  return (
    <div className="grid gap-6 pb-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:pb-0">
      <div className="grid gap-5">
        {/* 1. Equipamentos */}
        <Secao
          n={1}
          titulo="Equipamentos"
          sub="Toque em + para adicionar. O saldo do estoque aparece ao lado."
          icon={<Boxes className="h-[18px] w-[18px]" />}
          acao={
            dados.equipamentos.length > 6 ? (
              <div className="relative w-36 sm:w-52">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="h-9 pl-9 sm:h-9" />
              </div>
            ) : null
          }
        >
          {carregando && dados.equipamentos.length === 0 ? (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[68px] rounded-2xl" />
              ))}
            </div>
          ) : dados.equipamentos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500">
              Nenhum equipamento cadastrado.{" "}
              <Link href="/estoque" className="font-semibold text-brand-700 underline">
                Cadastrar no estoque
              </Link>
            </div>
          ) : (
            <div className="grid gap-2">
              {equipamentos.length === 0 && <p className="py-4 text-center text-sm text-ink-500">Nenhum equipamento com “{busca}”.</p>}
              {equipamentos.map((e) => {
                const q = qtdDe(e.id);
                const s = estoque[e.id];
                const disp = s?.disponivel ?? 0;
                const falta = q > 0 && faltando.some((f) => f.equipamento_id === e.id);
                return (
                  <div
                    key={e.id}
                    className={cx(
                      "flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl p-3 ring-1 transition sm:flex-nowrap",
                      q > 0 ? "bg-brand-50/60 ring-brand-300" : "bg-white ring-ink-200 hover:ring-ink-300",
                      falta && "bg-rose-50 ring-rose-300",
                    )}
                  >
                    <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto sm:flex-1">
                    <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", q > 0 ? "bg-ink-900 text-brand-300" : "bg-ink-100 text-ink-500")}>
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">{e.nome}</p>
                      <p className="tnum text-[12.5px] text-ink-500">
                        {brl(e.preco_mensal)}/mês<span className="hidden sm:inline"> · {brl(e.preco_semanal)}/semana</span> · {brl(e.preco_diaria)}/dia
                      </p>
                    </div>
                    </div>
                    <span
                      className={cx(
                        "tnum rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap",
                        falta ? "bg-rose-600 text-white" : disp > 0 ? "bg-white text-ink-600 ring-1 ring-ink-200" : "bg-ink-100 text-ink-400",
                      )}
                    >
                      {falta ? `Só ${Math.max(0, disp)} disponíveis` : `${fmtNum(disp)} disp.`}
                    </span>
                    <Stepper value={q} onChange={(v) => setQtd(e, v)} className="ml-auto" />
                  </div>
                );
              })}
            </div>
          )}
        </Secao>

        {/* 2. Período */}
        <Secao n={2} titulo="Período" sub="Quanto maior o plano, menor o preço por dia." icon={<CalendarDays className="h-[18px] w-[18px]" />}>
          <div className="grid gap-4">
            <Segmented<Modalidade>
              className="flex w-full overflow-x-auto scrollbar-none [&>button]:flex-1"
              value={l.modalidade}
              onChange={(m) =>
                // Ao ir para "Nº de dias", mantém a mesma duração (1 mês → 30 dias).
                atualizar({ modalidade: m, quantidade_periodos: m === "dias" ? diasDaLocacao(l.modalidade, l.quantidade_periodos) : l.modalidade === "dias" ? 1 : l.quantidade_periodos })
              }
              options={[...PERIODOS.map((p) => ({ value: p.id as Modalidade, label: p.nome })), { value: "dias", label: "Nº de dias" }]}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={PERGUNTA[l.modalidade]}>
                <Stepper value={l.quantidade_periodos} min={1} onChange={(v) => atualizar({ quantidade_periodos: v })} className="w-full justify-between" />
              </Field>
              <Field label="Data de entrega">
                <Input type="date" value={l.data_entrega} onChange={(e) => e.target.value && atualizar({ data_entrega: e.target.value })} />
              </Field>
              <Field label="Coleta prevista">
                <div className="flex h-11 items-center rounded-xl bg-ink-50 px-3.5 text-sm font-semibold text-ink-800 ring-1 ring-ink-200 sm:h-10">
                  {fmtDataCurta(l.data_coleta)} <span className="ml-auto text-xs font-medium text-ink-500">{dias} dias</span>
                </div>
              </Field>
            </div>
            {l.modalidade === "dias" && l.itens.length > 0 && (
              <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800 ring-1 ring-brand-200">
                ✨ Melhor combinação para {l.quantidade_periodos} dias: <b>{descreverPartes(aluguel.partes)}</b> = {brl(aluguel.total)}
              </p>
            )}
          </div>
        </Secao>

        {/* 3. Cliente */}
        <Secao n={3} titulo="Cliente" sub="Digite o nome — clientes já cadastrados aparecem para escolher." icon={<UserRound className="h-[18px] w-[18px]" />}>
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Nome completo" className="relative sm:col-span-6">
              <Input
                value={l.cliente_nome}
                onFocus={() => setSugestoes(true)}
                onBlur={() => setTimeout(() => setSugestoes(false), 150)}
                onChange={(e) => {
                  // Mudou o nome de um cliente já escolhido? Então é outra pessoa: desvincula.
                  const escolhido = l.cliente_id ? dados.clientes.find((c) => c.id === l.cliente_id) : null;
                  const mesmo = escolhido && normalizar(escolhido.nome).trim() === normalizar(e.target.value).trim();
                  atualizar({ cliente_nome: e.target.value, cliente_id: mesmo ? l.cliente_id : null });
                  setSugestoes(true);
                }}
                placeholder="Ex.: Vinicius Daniel Silva"
              />
              {sugestoes && clientesSugeridos.length > 0 && (
                <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-ink-200">
                  {clientesSugeridos.map((c) => (
                    <button key={c.id} type="button" onMouseDown={() => escolherCliente(c)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-ink-50">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-xs text-ink-500">{fmtTelefone(c.telefone)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="WhatsApp" className="sm:col-span-3">
              <Input inputMode="tel" value={l.cliente_telefone} onChange={(e) => atualizar({ cliente_telefone: e.target.value })} onBlur={(e) => atualizar({ cliente_telefone: fmtTelefone(e.target.value) })} placeholder="(82) 90000-0000" />
            </Field>
            <Field label="CPF / CNPJ" className="sm:col-span-3">
              <Input inputMode="numeric" value={l.cliente_documento} onChange={(e) => atualizar({ cliente_documento: e.target.value })} onBlur={(e) => atualizar({ cliente_documento: fmtDocumento(e.target.value) })} />
            </Field>
          </div>
          {l.cliente_id && <p className="mt-3 text-xs font-medium text-brand-700">✓ Cliente cadastrado — alterações serão salvas no cadastro.</p>}
        </Secao>

        {/* 4. Endereço */}
        <Secao n={4} titulo="Endereço da obra" sub="Quanto mais detalhe, mais rápido o entregador chega." icon={<MapPinned className="h-[18px] w-[18px]" />}>
          <EnderecoForm value={l.endereco} onChange={(endereco) => atualizar({ endereco })} />
          <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
            <Field label="Quem vai receber na obra">
              <Input value={l.recebedor_nome} onChange={(e) => atualizar({ recebedor_nome: e.target.value })} placeholder="Nome do responsável" />
            </Field>
            <Field label="CPF de quem recebe">
              <Input inputMode="numeric" value={l.recebedor_documento} onChange={(e) => atualizar({ recebedor_documento: e.target.value })} onBlur={(e) => atualizar({ recebedor_documento: fmtDocumento(e.target.value) })} />
            </Field>
          </div>
        </Secao>

        {/* 5. Taxas */}
        <Secao n={5} titulo="Frete e ajustes" icon={<Truck className="h-[18px] w-[18px]" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Taxa de entrega">
              <MoneyInput value={l.taxa_entrega} onChange={(v) => atualizar({ taxa_entrega: v })} />
            </Field>
            <Field label="Taxa de retirada">
              <MoneyInput value={l.taxa_retirada} onChange={(v) => atualizar({ taxa_retirada: v })} />
            </Field>
            <Field label="Desconto">
              <MoneyInput value={l.desconto} onChange={(v) => atualizar({ desconto: v })} />
            </Field>
            <Field label="Observações (saem no orçamento e no termo)" className="sm:col-span-3">
              <Textarea className="min-h-[64px]" value={l.observacoes} onChange={(e) => atualizar({ observacoes: e.target.value })} />
            </Field>
          </div>
        </Secao>
      </div>

      {/* Resumo */}
      <aside className="scroll-mt-20 lg:sticky lg:top-8" id="resumo">
        <div className="bg-navy-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-lift">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-300 uppercase">{editando ? `${l.status === "orcamento" ? "Orçamento" : "Locação"} ${codigo(l.numero)}` : `Novo orçamento ${codigo(numero)}`}</p>
              <button onClick={limpar} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-300 hover:bg-white/10 hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" /> Novo
              </button>
            </div>
            <p className="mt-1 truncate font-display text-lg font-semibold">{l.cliente_nome || "Cliente"}</p>

            {/* Comparativo dos planos */}
            <div className="mt-4 grid gap-1.5">
              {comp.map((c) => {
                const on = l.modalidade === c.periodo;
                return (
                  <button
                    key={c.periodo}
                    type="button"
                    onClick={() => atualizar({ modalidade: c.periodo, quantidade_periodos: l.modalidade === "dias" ? 1 : l.quantidade_periodos })}
                    className={cx("group relative overflow-hidden rounded-xl px-3.5 py-2.5 text-left transition", on ? "bg-white text-ink-950" : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10")}
                  >
                    <div className="relative flex items-center gap-3">
                      <span className={cx("grid h-5 w-5 place-items-center rounded-full ring-1", on ? "bg-brand-500 text-white ring-brand-500" : "ring-white/30")}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">{c.nome}</p>
                        <div className="mt-1 h-1 rounded-full bg-current/10">
                          <div className={cx("h-1 rounded-full", on ? "bg-brand-500" : "bg-brand-400/70")} style={{ width: `${Math.max(4, (c.porDia / maxPorDia) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="tnum text-[14px] font-bold">{brl(c.valor)}</p>
                        <p className={cx("tnum text-[11px]", on ? "text-ink-500" : "text-ink-400")}>
                          {brl(c.porDia)}/dia
                          {c.economia > 0.01 && <span className={cx("ml-1 font-bold", on ? "text-brand-700" : "text-brand-300")}>−{Math.round(c.economia * 100)}%</span>}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Totais */}
            <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-[13.5px]">
              <div className="flex justify-between text-ink-300">
                <span>
                  Aluguel · {descreverModalidade(l.modalidade, l.quantidade_periodos)}
                  {l.modalidade === "dias" && l.itens.length > 0 && <span className="block text-[11px] text-ink-400">{descreverPartes(aluguel.partes)}</span>}
                </span>
                <span className="tnum font-semibold text-white">{brl(aluguel.total)}</span>
              </div>
              {l.taxa_entrega + l.taxa_retirada > 0 && (
                <div className="flex justify-between text-ink-300">
                  <span>Entrega / retirada</span>
                  <span className="tnum font-semibold text-white">{brl(l.taxa_entrega + l.taxa_retirada)}</span>
                </div>
              )}
              {l.desconto > 0 && (
                <div className="flex justify-between text-ink-300">
                  <span>Desconto</span>
                  <span className="tnum font-semibold text-brand-300">−{brl(l.desconto)}</span>
                </div>
              )}
              <div className="flex items-end justify-between pt-2">
                <span className="text-ink-300">Total</span>
                <span className="tnum font-display text-[32px] leading-none font-bold text-brand-gradient">{brl(total)}</span>
              </div>
              <p className="text-right text-[11.5px] text-ink-400">
                {fmtData(l.data_entrega)} → {fmtData(l.data_coleta)}
              </p>
            </div>

            {faltando.length > 0 && (
              <div className="mt-4 flex gap-2 rounded-xl bg-rose-500/15 p-3 text-[12.5px] text-rose-100 ring-1 ring-rose-400/30">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                <span>Estoque insuficiente de {faltando.map((f) => f.nome).join(", ")}. Dá para salvar, mas confira antes de aprovar.</span>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              {l.status === "orcamento" ? (
                <Button variant="brand" size="lg" className="col-span-2" loading={salvando === "aprovar"} onClick={() => acao("aprovar")}>
                  <Check className="h-5 w-5" /> Cliente aprovou — agendar
                </Button>
              ) : (
                <Button variant="brand" size="lg" className="col-span-2" loading={salvando === "salvar"} onClick={() => acao("salvar")}>
                  <Save className="h-5 w-5" /> Salvar alterações
                </Button>
              )}
              <Button className="bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15" loading={salvando === "whats"} onClick={() => acao("whats")}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button className="bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15" loading={salvando === "pdf"} onClick={() => acao("pdf")}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
              {l.status === "orcamento" && (
                <Button className="col-span-2 bg-transparent text-ink-200 ring-1 ring-white/15 hover:bg-white/5" loading={salvando === "salvar"} onClick={() => acao("salvar")}>
                  <Save className="h-4 w-4" /> Salvar orçamento
                </Button>
              )}
            </div>
          </div>
        </div>
        {editando && (
          <Link href={`/locacoes/${l.id}`} className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
            Ver ficha da locação {codigo(l.numero)}
          </Link>
        )}
      </aside>

      {/* Barra do total (celular) */}
      <div className={cx("fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 lg:hidden", l.itens.length === 0 && "hidden")}>
        <a href="#resumo" className="flex items-center justify-between rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lift">
          <span>
            <span className="block text-[11px] text-ink-400">
              {l.itens.length} {l.itens.length === 1 ? "item" : "itens"} · {descreverModalidade(l.modalidade, l.quantidade_periodos)}
            </span>
            <span className="tnum font-display text-lg font-bold text-brand-gradient">{brl(total)}</span>
          </span>
          <Badge className="bg-brand-400 text-ink-950 ring-0">
            <Plus className="h-3 w-3" /> Ver resumo
          </Badge>
        </a>
      </div>
    </div>
  );
}
