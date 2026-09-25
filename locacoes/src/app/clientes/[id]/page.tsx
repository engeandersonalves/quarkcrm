"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, FileSignature, MapPin, MessageCircle, Package, Pencil, Phone, Sparkles, UserRound, Wallet } from "lucide-react";
import { EditarCliente } from "@/components/editar-cliente";
import { Ranking } from "@/components/graficos";
import { Avatar, Badge, ButtonLink, Button, Card, CardHeader, cx, Empty, Skeleton, Stat } from "@/components/ui";
import { useDados } from "@/lib/store";
import { codigo, diffDias, enderecoCompleto, fmtData, fmtDocumento, fmtTelefone, hoje, linkMaps, linkWhatsApp, temEndereco } from "@/lib/format";
import { brl, descreverModalidade } from "@/lib/pricing";
import { ALERTA_COR, alertaPrazo, saldoLocacao, STATUS } from "@/lib/status";

export default function Cliente() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dados, carregando } = useDados();
  const [editar, setEditar] = useState(false);
  const c = dados.clientes.find((x) => x.id === id);

  const h = useMemo(() => {
    if (!c) return null;
    const locs = dados.locacoes.filter((l) => l.cliente_id === c.id).sort((a, b) => b.numero - a.numero);
    const fechadas = locs.filter((l) => l.status !== "orcamento" && l.status !== "recusada");
    const lancs = dados.lancamentos.filter((x) => x.tipo === "entrada" && locs.some((l) => l.id === x.locacao_id));
    const recebido = lancs.filter((x) => x.pago).reduce((s, x) => s + x.valor, 0);
    const aberto = lancs.filter((x) => !x.pago).reduce((s, x) => s + x.valor, 0);
    const vencido = lancs.filter((x) => !x.pago && x.data < hoje()).reduce((s, x) => s + x.valor, 0);
    const total = fechadas.reduce((s, l) => s + l.valor_total, 0);
    const pecas = new Map<string, number>();
    for (const l of fechadas) for (const i of l.itens) pecas.set(i.nome, (pecas.get(i.nome) ?? 0) + i.quantidade);
    const obras = new Map<string, { endereco: (typeof locs)[number]["endereco"]; vezes: number }>();
    for (const l of fechadas) {
      if (!temEndereco(l.endereco)) continue;
      const k = enderecoCompleto(l.endereco);
      obras.set(k, { endereco: l.endereco, vezes: (obras.get(k)?.vezes ?? 0) + 1 });
    }
    const primeira = [...locs].sort((a, b) => a.criado_em.localeCompare(b.criado_em))[0];
    // Pagamento em dia: quantas cobranças foram pagas até o vencimento
    const pagas = lancs.filter((x) => x.pago && x.pago_em);
    const emDia = pagas.filter((x) => (x.pago_em ?? "") <= x.data).length;
    return {
      locs,
      fechadas,
      ativas: locs.filter((l) => l.status === "agendada" || l.status === "na_obra"),
      orcamentosAbertos: locs.filter((l) => l.status === "orcamento"),
      lancs: [...lancs].sort((a, b) => (b.pago_em ?? b.data).localeCompare(a.pago_em ?? a.data)),
      recebido,
      aberto,
      vencido,
      total,
      ticket: fechadas.length ? total / fechadas.length : 0,
      pecas: [...pecas.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6),
      obras: [...obras.values()].sort((a, b) => b.vezes - a.vezes),
      desde: primeira?.criado_em.slice(0, 10),
      pontualidade: pagas.length ? emDia / pagas.length : null,
    };
  }, [c, dados]);

  if (!c || !h) {
    return carregando ? (
      <div className="grid gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    ) : (
      <Card>
        <Empty icon={<UserRound className="h-6 w-6" />} title="Cliente não encontrado" action={<ButtonLink href="/clientes">Voltar</ButtonLink>} />
      </Card>
    );
  }

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={c.nome} className="h-16 w-16 text-lg" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">{c.nome}</h1>
            <p className="text-sm text-ink-500">
              {[fmtTelefone(c.telefone), c.documento && fmtDocumento(c.documento), c.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
            </p>
            {h.desde && <p className="text-[12.5px] text-ink-400">Cliente desde {fmtData(h.desde)}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/?cliente=${c.id}`} variant="brand">
            <Sparkles className="h-4 w-4" /> Novo orçamento
          </ButtonLink>
          {c.telefone && (
            <>
              <ButtonLink href={linkWhatsApp(c.telefone, `Olá, ${c.nome.split(" ")[0]}! Aqui é da ${dados.config.empresa_nome}.`)} target="_blank" variant="secondary">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </ButtonLink>
              <ButtonLink href={`tel:${c.telefone.replace(/\D/g, "")}`} variant="secondary" aria-label="Ligar">
                <Phone className="h-4 w-4" />
              </ButtonLink>
            </>
          )}
          <Button variant="secondary" onClick={() => setEditar(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Locações" value={h.fechadas.length} hint={`${h.orcamentosAbertos.length} orçamento(s) em aberto · ${h.ativas.length} ativa(s)`} icon={<Package className="h-4 w-4" />} />
        <Stat label="Total locado" value={brl(h.total)} hint={`Ticket médio ${brl(h.ticket)}`} icon={<Wallet className="h-4 w-4" />} tone="good" />
        <Stat label="Recebido" value={brl(h.recebido)} hint={h.pontualidade != null ? `${Math.round(h.pontualidade * 100)}% pago em dia` : "Sem pagamentos ainda"} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat
          label="Em aberto"
          value={<span className={h.aberto > 0 ? "text-amber-700" : undefined}>{brl(h.aberto)}</span>}
          hint={h.vencido > 0 ? <span className="font-semibold text-rose-600">{brl(h.vencido)} vencido</span> : "Nada vencido"}
          icon={<Wallet className="h-4 w-4" />}
          tone={h.vencido > 0 ? "bad" : "default"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-5">
          {/* Histórico de locações */}
          <Card className="overflow-hidden">
            <CardHeader title="Histórico de locações" subtitle={`${h.locs.length} no total, da mais recente para a mais antiga`} icon={<Package className="h-[18px] w-[18px]" />} />
            {h.locs.length === 0 ? (
              <Empty icon={<Package className="h-6 w-6" />} title="Nenhuma locação ainda" action={<ButtonLink href={`/?cliente=${c.id}`} variant="brand">Fazer orçamento</ButtonLink>} />
            ) : (
              <ol className="relative border-t border-ink-100">
                {h.locs.map((l) => {
                  const s = saldoLocacao(l, dados.lancamentos);
                  const a = alertaPrazo(l);
                  const dias = l.data_entrega && l.data_coleta ? diffDias(l.data_entrega, l.data_coleta) : 0;
                  return (
                    <li key={l.id} className="border-b border-ink-100 last:border-0">
                      <button onClick={() => router.push(`/locacoes/${l.id}`)} className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-ink-50/70">
                        <div className="flex w-14 shrink-0 flex-col items-center">
                          <span className={cx("mt-1 h-3 w-3 rounded-full ring-4", STATUS[l.status].ponto, "ring-white")} />
                          <span className="mt-1 font-mono text-[11px] text-ink-400">{codigo(l.numero)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={STATUS[l.status].cor} dot={STATUS[l.status].ponto}>
                              {STATUS[l.status].curto}
                            </Badge>
                            {a && <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-bold", ALERTA_COR[a.tipo])}>{a.texto}</span>}
                            {l.assinado_em && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700 ring-1 ring-brand-200">
                                <FileSignature className="h-3 w-3" /> assinado
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[13.5px] font-medium text-ink-900">{l.itens.map((i) => `${i.quantidade} ${i.nome}`).join(" · ")}</p>
                          <p className="text-[12.5px] text-ink-500">
                            {descreverModalidade(l.modalidade, l.quantidade_periodos)} · {fmtData(l.data_entrega)} → {fmtData(l.data_coleta)} ({dias} dias)
                            {l.endereco.bairro && ` · ${l.endereco.bairro}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tnum font-semibold">{brl(l.valor_total)}</p>
                          {s.cobrado > 0 && (
                            <p className={cx("tnum text-[11.5px] font-semibold", s.aberto > 0.009 ? "text-amber-700" : "text-brand-700")}>{s.aberto > 0.009 ? `falta ${brl(s.aberto)}` : "✓ pago"}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* Pagamentos */}
          <Card className="overflow-hidden">
            <CardHeader title="Pagamentos" subtitle="Cobranças de todas as locações deste cliente" icon={<Wallet className="h-[18px] w-[18px]" />} />
            {h.lancs.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-500">Nenhuma cobrança ainda.</p>
            ) : (
              <ul className="divide-y divide-ink-100 border-t border-ink-100">
                {h.lancs.map((x) => {
                  const l = h.locs.find((y) => y.id === x.locacao_id);
                  const venc = !x.pago && x.data < hoje();
                  return (
                    <li key={x.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                      <span className={cx("h-2 w-2 shrink-0 rounded-full", x.pago ? "bg-brand-500" : venc ? "bg-rose-500" : "bg-amber-400")} />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{x.categoria}</span>
                        {l && <span className="text-ink-400"> · {codigo(l.numero)}</span>}
                        <span className="block text-[11.5px] text-ink-500">{x.pago ? `Pago em ${fmtData(x.pago_em)} · ${x.forma}` : `${venc ? "Venceu" : "Vence"} em ${fmtData(x.data)}`}</span>
                      </span>
                      <span className="tnum font-semibold">{brl(x.valor)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {h.ativas.length > 0 && (
            <Card className="p-5 ring-brand-200">
              <p className="mb-3 font-display text-[15px] font-semibold">Agora com o cliente</p>
              <div className="grid gap-2">
                {h.ativas.map((l) => (
                  <Link key={l.id} href={`/locacoes/${l.id}`} className="rounded-2xl bg-brand-50 p-3 text-[13px] ring-1 ring-brand-200 hover:bg-brand-100">
                    <p className="font-semibold">
                      {codigo(l.numero)} · {STATUS[l.status].nome}
                    </p>
                    <p className="text-ink-600">{l.itens.map((i) => `${i.quantidade} ${i.nome}`).join(" · ")}</p>
                    <p className="text-[12px] text-ink-500">{l.status === "na_obra" ? `Coleta em ${fmtData(l.data_coleta)}` : `Entrega em ${fmtData(l.data_entrega)}`}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-5">
            <p className="mb-4 font-display text-[15px] font-semibold">O que mais aluga</p>
            <Ranking itens={h.pecas} formato={(n) => `${n} ${n === 1 ? "peça" : "peças"}`} />
          </Card>
          <Card className="p-5">
            <p className="mb-3 font-display text-[15px] font-semibold">Endereços de obra</p>
            {h.obras.length === 0 && !temEndereco(c.endereco) ? (
              <p className="text-sm text-ink-500">Nenhum endereço ainda.</p>
            ) : (
              <ul className="grid gap-2">
                {(h.obras.length ? h.obras : [{ endereco: c.endereco, vezes: 0 }]).map((o) => (
                  <li key={enderecoCompleto(o.endereco)} className="flex items-start gap-2 text-[13px]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      {enderecoCompleto(o.endereco)}
                      {o.vezes > 0 && <span className="text-ink-400"> · {o.vezes}×</span>}
                    </span>
                    <a href={linkMaps(o.endereco)} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-ink-800" aria-label="Abrir no mapa">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {c.observacoes && (
            <Card className="p-5">
              <p className="mb-1 font-display text-[15px] font-semibold">Observações</p>
              <p className="text-[13.5px] whitespace-pre-line text-ink-600">{c.observacoes}</p>
            </Card>
          )}
        </div>
      </div>

      {editar && <EditarCliente cliente={c} onClose={() => setEditar(false)} onExcluido={() => router.push("/clientes")} />}
    </>
  );
}
