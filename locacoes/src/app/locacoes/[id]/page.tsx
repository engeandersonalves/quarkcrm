"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  Check,
  CircleDollarSign,
  ExternalLink,
  FileSignature,
  FileText,
  Hammer,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Trash2,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { ProximaAcao } from "@/components/card-locacao";
import { ReceberModal } from "@/components/receber-modal";
import { Badge, Button, Card, CardHeader, cx, Empty, Field, Input, Modal, MoneyInput, Select, Skeleton, ButtonLink } from "@/components/ui";
import { useDados } from "@/lib/store";
import { CATEGORIAS_ENTRADA } from "@/lib/defaults";
import { diffDias, fmtData, fmtDataCurta, fmtDataHora, fmtDocumento, fmtTelefone, hoje, linkMaps, linkWaze, linkWhatsApp, temEndereco, uid } from "@/lib/format";
import { mensagemCobranca, mensagemEntregador, mensagemVencimento } from "@/lib/mensagens";
import { brl, descreverModalidade, descreverPartes, subtotalPeriodo, valorAluguel } from "@/lib/pricing";
import { ALERTA_COR, alertaPrazo, saldoLocacao, STATUS } from "@/lib/status";
import type { Lancamento, Locacao } from "@/lib/types";

const ETAPAS = [
  { id: "orcamento", nome: "Orçamento" },
  { id: "agendada", nome: "Aprovado" },
  { id: "na_obra", nome: "Entregue" },
  { id: "finalizada", nome: "Recolhido" },
] as const;

function Etapas({ l }: { l: Locacao }) {
  const idx = l.status === "recusada" ? 0 : ETAPAS.findIndex((e) => e.id === l.status);
  const datas = [l.criado_em, l.historico.find((h) => h.texto.startsWith("Orçamento aprovado"))?.em, l.entregue_em, l.recolhido_em];
  return (
    <ol className="grid grid-cols-4 gap-1">
      {ETAPAS.map((e, i) => {
        const feito = l.status !== "recusada" && i <= idx;
        return (
          <li key={e.id} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cx("h-0.5 flex-1", i === 0 ? "bg-transparent" : feito ? "bg-brand-500" : "bg-ink-200")} />
              <span className={cx("grid h-8 w-8 place-items-center rounded-full text-xs font-bold ring-4 ring-white", feito ? "bg-brand-500 text-white" : "bg-ink-200 text-ink-500", i === idx && l.status !== "recusada" && "bg-ink-900 text-brand-300")}>
                {feito && i < idx ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <div className={cx("h-0.5 flex-1", i === ETAPAS.length - 1 ? "bg-transparent" : i < idx ? "bg-brand-500" : "bg-ink-200")} />
            </div>
            <p className={cx("mt-1.5 text-[12px] font-semibold", feito ? "text-ink-900" : "text-ink-400")}>{e.nome}</p>
            <p className="text-[10.5px] text-ink-400">{feito && datas[i] ? fmtDataCurta(datas[i]!.slice(0, 10)) : " "}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function DetalheLocacao() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dados, carregando, salvarLocacao, excluirLocacao, salvarLancamento, excluirLancamento, renovar, voltarEtapa, cancelar } = useDados();
  const [receber, setReceber] = useState<Lancamento | null>(null);
  const [cobranca, setCobranca] = useState<Lancamento | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const l = dados.locacoes.find((x) => x.id === id);
  const cfg = dados.config;

  if (!l) {
    return carregando ? (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    ) : (
      <Card>
        <Empty icon={<FileText className="h-6 w-6" />} title="Locação não encontrada" action={<ButtonLink href="/locacoes">Voltar</ButtonLink>} />
      </Card>
    );
  }

  const alerta = alertaPrazo(l);
  const saldo = saldoLocacao(l, dados.lancamentos);
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const e = l.endereco;
  const ativa = l.status === "agendada" || l.status === "na_obra";
  const diasRestantes = l.data_coleta ? diffDias(hoje(), l.data_coleta) : 0;

  async function comBusy(k: string, fn: () => Promise<unknown>) {
    setBusy(k);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  function mudarData(campo: "data_entrega" | "data_coleta", v: string) {
    if (!v) return;
    const n = { ...l!, [campo]: v };
    if (n.data_coleta < n.data_entrega) return toast.error("A coleta não pode ser antes da entrega");
    salvarLocacao(n, `${campo === "data_entrega" ? "Entrega" : "Coleta"} remarcada para ${fmtData(v)}`);
  }

  function taxaDesmontagem() {
    const base = l!.valor_total;
    const valor = Math.round(base * cfg.taxa_desmontagem_pct) / 100;
    if (!confirm(`Aplicar taxa de desmontagem de ${cfg.taxa_desmontagem_pct}% (${brl(valor)})? Os itens não estavam desmontados na coleta.`)) return;
    comBusy("desm", async () => {
      await salvarLancamento({
        id: uid(),
        tipo: "entrada",
        categoria: "Taxa de desmontagem",
        descricao: `Taxa de desmontagem ${cfg.taxa_desmontagem_pct}% — #${l!.numero}`,
        valor,
        data: hoje(),
        pago: false,
        pago_em: null,
        forma: "PIX",
        locacao_id: l!.id,
        modalidade: l!.modalidade,
        criado_em: new Date().toISOString(),
      });
      await salvarLocacao(l!, `Taxa de desmontagem aplicada: ${brl(valor)}`);
    });
  }

  return (
    <>
      <Link href="/locacoes" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Locações
      </Link>

      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-ink-400">#{String(l.numero).padStart(4, "0")}</span>
            <Badge className={STATUS[l.status].cor} dot={STATUS[l.status].ponto}>
              {STATUS[l.status].nome}
            </Badge>
            {alerta && <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold", ALERTA_COR[alerta.tipo])}>{alerta.texto}</span>}
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">{l.cliente_nome || "Cliente sem nome"}</h1>
          <p className="text-sm text-ink-500">
            {descreverModalidade(l.modalidade, l.quantidade_periodos)} · {fmtData(l.data_entrega)} → {fmtData(l.data_coleta)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/?editar=${l.id}`} variant="secondary">
              <Pencil className="h-4 w-4" /> Editar
            </ButtonLink>
          <ButtonLink href={`/documento/${l.id}?tipo=orcamento`} target="_blank" variant="secondary">
              <FileText className="h-4 w-4" /> Orçamento
            </ButtonLink>
          <ButtonLink href={`/documento/${l.id}?tipo=termo`} target="_blank" variant="secondary">
              <FileSignature className="h-4 w-4" /> Termo de locação
            </ButtonLink>
        </div>
      </div>

      {/* Etapas + próxima ação */}
      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Etapas l={l} />
          </div>
          <div className="flex flex-col gap-2 lg:w-[340px]">
            {l.status === "recusada" || l.status === "finalizada" ? (
              <Button variant="secondary" size="lg" onClick={() => voltarEtapa(l)}>
                <Undo2 className="h-4 w-4" /> {l.status === "recusada" ? "Reabrir como orçamento" : "Desfazer coleta"}
              </Button>
            ) : (
              <ProximaAcao l={l} size="md" className="h-12 w-full text-[15px]" />
            )}
            <div className="flex flex-wrap justify-center gap-1 lg:justify-end">
              {(l.status === "agendada" || l.status === "na_obra") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => confirm(l.status === "agendada" ? "Voltar para orçamento? A cobrança em aberto será removida." : "Desfazer a entrega? Volta para “aguardando entrega”.") && voltarEtapa(l)}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Desfazer etapa
                </Button>
              )}
              {l.status === "orcamento" && (
                <Button variant="ghost" size="sm" onClick={() => cancelar(l, "Cliente recusou o orçamento")}>
                  <XCircle className="h-3.5 w-3.5" /> Cliente recusou
                </Button>
              )}
              {l.status === "agendada" && (
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => confirm("Cancelar esta locação? As peças voltam ao estoque e a cobrança em aberto é removida.") && cancelar(l, "Locação cancelada antes da entrega")}>
                  <XCircle className="h-3.5 w-3.5" /> Cancelar locação
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          {/* Endereço */}
          <Card>
            <CardHeader title="Obra e entrega" subtitle="Tudo o que o entregador precisa" icon={<MapPin className="h-[18px] w-[18px]" />} />
            <div className="px-5 pb-5">
              {temEndereco(e) ? (
                <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200">
                  <p className="font-semibold text-ink-900">{[e.logradouro, e.numero && `nº ${e.numero}`].filter(Boolean).join(", ") || "Localização por link"}</p>
                  {e.complemento && <p className="text-sm text-ink-700">{e.complemento}</p>}
                  <p className="text-sm text-ink-600">
                    {[e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ")}
                    {e.cep && ` — CEP ${e.cep}`}
                  </p>
                  {e.referencia && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200">
                      🧭 <b>Referência:</b> {e.referencia}
                    </p>
                  )}
                  {e.maps_url && <p className="mt-2 text-xs font-semibold text-brand-700">📍 Localização exata salva</p>}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-ink-300 p-4 text-sm text-ink-500">
                  Sem endereço. <Link href={`/?editar=${l.id}`} className="font-semibold underline">Adicionar</Link>
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ButtonLink href={linkMaps(e)} target="_blank" variant="secondary" disabled={!temEndereco(e)} className="w-full">
                    <ExternalLink className="h-4 w-4" /> Maps
                  </ButtonLink>
                <ButtonLink href={linkWaze(e)} target="_blank" variant="secondary" disabled={!temEndereco(e)} className="w-full">
                    <Navigation className="h-4 w-4" /> Waze
                  </ButtonLink>
                <ButtonLink href={linkWhatsApp("", mensagemEntregador(l, l.status === "na_obra" ? "coleta" : "entrega"))} target="_blank" variant="primary" className="col-span-2 w-full">
                    <Truck className="h-4 w-4" /> Enviar ao entregador
                  </ButtonLink>
              </div>
              <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-ink-500">Cliente</p>
                  <p className="font-semibold">{l.cliente_nome || "—"}</p>
                  <p className="text-ink-600">{l.cliente_documento && fmtDocumento(l.cliente_documento)}</p>
                  {l.cliente_telefone && (
                    <div className="mt-2 flex gap-2">
                      <ButtonLink href={`tel:${l.cliente_telefone.replace(/\D/g, "")}`} size="sm" variant="secondary">
                          <Phone className="h-3.5 w-3.5" /> {fmtTelefone(l.cliente_telefone)}
                        </ButtonLink>
                      <ButtonLink href={linkWhatsApp(l.cliente_telefone, `Olá, ${l.cliente_nome.split(" ")[0]}! Aqui é da ${cfg.empresa_nome}.`)} target="_blank" size="sm" variant="secondary">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </ButtonLink>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-500">Recebe na obra</p>
                  <p className="font-semibold">{l.recebedor_nome || "—"}</p>
                  <p className="text-ink-600">{l.recebedor_documento && fmtDocumento(l.recebedor_documento)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Itens */}
          <Card className="overflow-hidden">
            <CardHeader title="Itens alugados" subtitle={descreverModalidade(l.modalidade, l.quantidade_periodos) + (l.modalidade === "dias" ? ` (${descreverPartes(aluguel.partes)})` : "")} icon={<Hammer className="h-[18px] w-[18px]" />} />
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11.5px] font-semibold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5">Qtd</th>
                  <th className="px-2 py-2.5">Descrição</th>
                  <th className="px-5 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {l.itens.map((i) => {
                  const v = l.modalidade === "dias" ? null : subtotalPeriodo([i], l.modalidade) * l.quantidade_periodos;
                  return (
                    <tr key={i.equipamento_id}>
                      <td className="tnum px-5 py-3 font-semibold">{i.quantidade}</td>
                      <td className="px-2 py-3">
                        {i.nome}
                        <span className="text-ink-400"> · {i.unidade}</span>
                      </td>
                      <td className="tnum px-5 py-3 text-right">{v == null ? "—" : brl(v)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-[13.5px]">
                <tr className="border-t border-ink-200">
                  <td colSpan={2} className="px-5 pt-3 text-ink-500">
                    Aluguel
                  </td>
                  <td className="tnum px-5 pt-3 text-right">{brl(aluguel.total)}</td>
                </tr>
                {l.taxa_entrega + l.taxa_retirada > 0 && (
                  <tr>
                    <td colSpan={2} className="px-5 pt-1 text-ink-500">
                      Entrega / retirada
                    </td>
                    <td className="tnum px-5 pt-1 text-right">{brl(l.taxa_entrega + l.taxa_retirada)}</td>
                  </tr>
                )}
                {l.desconto > 0 && (
                  <tr>
                    <td colSpan={2} className="px-5 pt-1 text-ink-500">
                      Desconto
                    </td>
                    <td className="tnum px-5 pt-1 text-right text-brand-700">−{brl(l.desconto)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="px-5 pt-2 pb-4 font-semibold">
                    Total
                  </td>
                  <td className="tnum px-5 pt-2 pb-4 text-right font-display text-lg font-bold">{brl(l.valor_total)}</td>
                </tr>
              </tfoot>
            </table>
            {l.observacoes && <p className="border-t border-ink-100 px-5 py-4 text-sm whitespace-pre-line text-ink-600">{l.observacoes}</p>}
          </Card>

          {/* Histórico */}
          <Card>
            <CardHeader title="Histórico" />
            <ol className="px-5 pb-5">
              {[...l.historico].reverse().map((h, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-100" />
                  {i < l.historico.length - 1 && <span className="absolute top-4 left-[4.5px] h-full w-px bg-ink-200" />}
                  <div>
                    <p className="text-sm text-ink-800">{h.texto}</p>
                    <p className="text-xs text-ink-400">{fmtDataHora(h.em)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="grid content-start gap-5">
          {/* Prazo */}
          <Card className="overflow-hidden">
            {l.status === "na_obra" && (
              <div className={cx("px-5 py-4 text-white", diasRestantes < 0 ? "bg-rose-600" : diasRestantes <= 2 ? "bg-amber-500" : "bg-navy-gradient")}>
                <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{diasRestantes < 0 ? "Vencida há" : "Faltam"}</p>
                <p className="tnum font-display text-3xl font-bold">
                  {Math.abs(diasRestantes)} {Math.abs(diasRestantes) === 1 ? "dia" : "dias"}
                </p>
                <p className="text-[13px] opacity-80">para a coleta em {fmtData(l.data_coleta)}</p>
              </div>
            )}
            <div className="grid gap-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Entrega">
                  <Input type="date" value={l.data_entrega} onChange={(ev) => mudarData("data_entrega", ev.target.value)} />
                </Field>
                <Field label="Coleta">
                  <Input type="date" value={l.data_coleta} onChange={(ev) => mudarData("data_coleta", ev.target.value)} />
                </Field>
              </div>
              {l.status === "na_obra" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" loading={busy === "renovar"} onClick={() => comBusy("renovar", () => renovar(l))}>
                    <RefreshCcw className="h-4 w-4" /> Renovar
                  </Button>
                  <ButtonLink href={linkWhatsApp(l.cliente_telefone, mensagemVencimento(l, cfg))} target="_blank" variant="secondary" className="w-full">
                      <BellRing className="h-4 w-4" /> Avisar cliente
                    </ButtonLink>
                </div>
              )}
              {l.status === "na_obra" && (
                <p className="text-[12px] text-ink-500">Renovar soma mais {descreverModalidade(l.modalidade, l.quantidade_periodos)} ao prazo e lança a cobrança no financeiro.</p>
              )}
            </div>
          </Card>

          {/* Financeiro da locação */}
          <Card>
            <CardHeader
              title="Pagamentos"
              icon={<CircleDollarSign className="h-[18px] w-[18px]" />}
              action={
                l.status !== "orcamento" && (
                  <Button size="sm" variant="ghost" onClick={() => setCobranca({ id: uid(), tipo: "entrada", categoria: "Avaria / reposição", descricao: `#${l.numero} — ${l.cliente_nome}`, valor: 0, data: hoje(), pago: false, pago_em: null, forma: "PIX", locacao_id: l.id, modalidade: l.modalidade, criado_em: new Date().toISOString() })}>
                    <Plus className="h-3.5 w-3.5" /> Cobrança
                  </Button>
                )
              }
            />
            <div className="px-5 pb-5">
              {l.status === "orcamento" ? (
                <p className="text-sm text-ink-500">A cobrança é criada automaticamente quando o orçamento é aprovado.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { k: "Cobrado", v: saldo.cobrado, c: "text-ink-900" },
                      { k: "Recebido", v: saldo.pago, c: "text-brand-700" },
                      { k: "Em aberto", v: saldo.aberto, c: saldo.aberto > 0 ? "text-amber-700" : "text-ink-400" },
                    ].map((x) => (
                      <div key={x.k} className="rounded-xl bg-ink-50 px-2 py-2.5 ring-1 ring-ink-200">
                        <p className="text-[11px] text-ink-500">{x.k}</p>
                        <p className={cx("tnum text-[14px] font-bold", x.c)}>{brl(x.v)}</p>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 divide-y divide-ink-100">
                    {saldo.lancamentos.map((x) => (
                      <li key={x.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">{x.categoria}</p>
                          <p className="text-[11.5px] text-ink-500">{x.pago ? `Recebido ${fmtData(x.pago_em)} · ${x.forma}` : `Vence ${fmtData(x.data)}`}</p>
                        </div>
                        <span className="tnum text-sm font-semibold">{brl(x.valor)}</span>
                        {x.pago ? (
                          <button
                            title="Desfazer recebimento"
                            onClick={() => salvarLancamento({ ...x, pago: false, pago_em: null })}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700 hover:bg-brand-200"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        ) : (
                          <Button size="sm" variant="brand" onClick={() => setReceber(x)}>
                            Receber
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 grid gap-2">
                    {saldo.aberto > 0 && (
                      <ButtonLink href={linkWhatsApp(l.cliente_telefone, mensagemCobranca(l, saldo.aberto, cfg))} target="_blank" variant="secondary" className="w-full">
                          <MessageCircle className="h-4 w-4" /> Cobrar no WhatsApp
                        </ButtonLink>
                    )}
                    {(l.status === "na_obra" || l.status === "finalizada") && (
                      <Button variant="ghost" size="sm" loading={busy === "desm"} onClick={taxaDesmontagem}>
                        Aplicar taxa de desmontagem ({cfg.taxa_desmontagem_pct}%)
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          {!ativa && (
            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={async () => {
                if (!confirm(`Excluir a locação #${l.numero}? Cobranças em aberto também serão excluídas.`)) return;
                await excluirLocacao(l.id);
                toast.success("Locação excluída");
                router.push("/locacoes");
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir locação
            </Button>
          )}
        </div>
      </div>

      <ReceberModal lanc={receber} onClose={() => setReceber(null)} />
      <Modal
        open={!!cobranca}
        onClose={() => setCobranca(null)}
        title="Nova cobrança"
        footer={
          <>
            {cobranca && saldo.lancamentos.some((x) => x.id === cobranca.id) && (
              <Button variant="ghost" className="mr-auto text-rose-600" onClick={() => excluirLancamento(cobranca.id).then(() => setCobranca(null))}>
                Excluir
              </Button>
            )}
            <Button variant="ghost" onClick={() => setCobranca(null)}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              onClick={async () => {
                if (!cobranca || cobranca.valor <= 0) return toast.error("Informe o valor");
                await salvarLancamento(cobranca);
                setCobranca(null);
              }}
            >
              Salvar
            </Button>
          </>
        }
      >
        {cobranca && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={cobranca.categoria} onChange={(ev) => setCobranca({ ...cobranca, categoria: ev.target.value })}>
                {CATEGORIAS_ENTRADA.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Valor">
              <MoneyInput value={cobranca.valor} onChange={(v) => setCobranca({ ...cobranca, valor: v })} />
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <Input value={cobranca.descricao} onChange={(ev) => setCobranca({ ...cobranca, descricao: ev.target.value })} />
            </Field>
            <Field label="Vencimento">
              <Input type="date" value={cobranca.data} onChange={(ev) => setCobranca({ ...cobranca, data: ev.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
