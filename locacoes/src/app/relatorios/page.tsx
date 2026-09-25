"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Boxes, ChevronLeft, ChevronRight, ClipboardList, Download, Printer, Scale, TrendingUp, Wallet } from "lucide-react";
import { BarrasEntradaSaida, COR_SAIDA, Ranking } from "@/components/graficos";
import { Badge, Button, Card, CardHeader, cx, PageHeader, Segmented, Stat } from "@/components/ui";
import { useDados } from "@/lib/store";
import { codigo, fmtData, fmtNum, hoje, pct } from "@/lib/format";
import { brl, descreverModalidade } from "@/lib/pricing";
import { csv, dataCaixa, periodoAno, periodoMes, relatorioEstoque, relatorioFinanceiro, relatorioLocacoes, type Periodo } from "@/lib/relatorios";
import { STATUS } from "@/lib/status";

type Aba = "financeiro" | "locacoes" | "estoque";

function baixar(nome: string, conteudo: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Tabela({ cab, linhas, rodape, alinhar = [] }: { cab: string[]; linhas: React.ReactNode[][]; rodape?: React.ReactNode[]; alinhar?: ("r" | "l")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead className="bg-ink-50 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase print:bg-transparent">
          <tr>
            {cab.map((c, i) => (
              <th key={c} className={cx("px-4 py-2.5", alinhar[i] === "r" && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {linhas.map((l, i) => (
            <tr key={i} className="break-inside-avoid">
              {l.map((c, j) => (
                <td key={j} className={cx("px-4 py-2", alinhar[j] === "r" && "tnum text-right")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={cab.length} className="px-4 py-6 text-center text-ink-400">
                Nada no período.
              </td>
            </tr>
          )}
        </tbody>
        {rodape && (
          <tfoot className="border-t-2 border-ink-200 font-semibold">
            <tr>
              {rodape.map((c, j) => (
                <td key={j} className={cx("px-4 py-2.5", alinhar[j] === "r" && "tnum text-right")}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ Financeiro */

function Financeiro({ p }: { p: Periodo }) {
  const { dados } = useDados();
  const r = useMemo(() => relatorioFinanceiro(dados, p, hoje()), [dados, p]);
  const exportar = () =>
    baixar(
      `financeiro-${p.inicio.slice(0, p.escala === "mes" ? 7 : 4)}.csv`,
      csv([
        ["Data", "Tipo", "Categoria", "Descrição", "Forma", "Valor"],
        ...r.lancamentos.map((x) => [fmtData(dataCaixa(x)), x.tipo === "entrada" ? "Entrada" : "Saída", x.categoria, x.descricao, x.forma, x.tipo === "entrada" ? x.valor : -x.valor]),
        [],
        ["", "", "", "Total de entradas", "", r.totalEntradas],
        ["", "", "", "Total de saídas", "", -r.totalSaidas],
        ["", "", "", "Resultado", "", r.resultado],
      ]),
    );
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entradas recebidas" value={brl(r.totalEntradas)} hint={`${r.nEntradas} recebimentos`} icon={<ArrowUpRight className="h-4 w-4" />} tone="good" />
        <Stat label="Saídas pagas" value={brl(r.totalSaidas)} hint={`${r.nSaidas} pagamentos`} icon={<ArrowDownRight className="h-4 w-4" />} tone="bad" />
        <Stat label="Resultado" value={<span className={r.resultado < 0 ? "text-rose-600" : undefined}>{brl(r.resultado)}</span>} hint={r.totalEntradas > 0 ? `Margem ${pct(r.margem)}` : undefined} icon={<Scale className="h-4 w-4" />} />
        <Stat label="A receber no período" value={brl(r.aReceberNoPeriodo)} hint={r.vencido > 0 ? <span className="font-semibold text-rose-600">{brl(r.vencido)} vencido no total</span> : "Nada vencido"} icon={<Wallet className="h-4 w-4" />} tone={r.vencido > 0 ? "warn" : "default"} />
      </div>

      <Card className="break-inside-avoid p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold">Entradas e saídas {p.escala === "mes" ? "por dia" : "por mês"}</h3>
          <Button size="sm" variant="ghost" onClick={exportar} className="print:hidden">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
        <BarrasEntradaSaida dados={r.serie} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="break-inside-avoid overflow-hidden">
          <CardHeader title="Demonstrativo do período" subtitle="Regime de caixa: o que de fato entrou e saiu" />
          <Tabela
            cab={["", "Valor"]}
            alinhar={["l", "r"]}
            linhas={[
              [<b key="r">Receitas</b>, <b key="rv">{brl(r.totalEntradas)}</b>],
              ...r.entradasPorCategoria.map((c) => [<span key={c.categoria} className="pl-3 text-ink-600">{c.categoria}</span>, brl(c.valor)]),
              [<b key="d">Despesas</b>, <b key="dv">−{brl(r.totalSaidas)}</b>],
              ...r.saidasPorCategoria.map((c) => [<span key={c.categoria} className="pl-3 text-ink-600">{c.categoria}</span>, `−${brl(c.valor)}`]),
            ]}
            rodape={["Resultado", <span key="t" className={r.resultado < 0 ? "text-rose-600" : undefined}>{brl(r.resultado)}</span>]}
          />
        </Card>
        <Card className="break-inside-avoid p-5">
          <h3 className="font-display text-[15px] font-semibold">Receita por plano</h3>
          <p className="mb-4 text-[12px] text-ink-500">De onde veio o dinheiro do aluguel</p>
          <Ranking itens={r.porPlano.map((x) => ({ nome: x.plano, valor: x.valor }))} />
          <h3 className="mt-6 font-display text-[15px] font-semibold">Onde o dinheiro saiu</h3>
          <div className="mt-3">
            <Ranking itens={r.saidasPorCategoria.map((x) => ({ nome: x.categoria, valor: x.valor }))} cor={COR_SAIDA} />
          </div>
        </Card>
      </div>

      {p.escala === "ano" && (
        <Card className="break-inside-avoid overflow-hidden">
          <CardHeader title="Mês a mês" />
          <Tabela
            cab={["Mês", "Entradas", "Saídas", "Resultado", "Acumulado"]}
            alinhar={["l", "r", "r", "r", "r"]}
            linhas={r.serie.map((s) => [s.rotulo, brl(s.entradas), brl(s.saidas), <span key="r" className={s.resultado < 0 ? "text-rose-600" : undefined}>{brl(s.resultado)}</span>, brl(s.acumulado)])}
            rodape={["Total", brl(r.totalEntradas), brl(r.totalSaidas), brl(r.resultado), ""]}
          />
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Lançamentos do período" subtitle={`${r.lancamentos.length} movimentações pagas`} />
        <Tabela
          cab={["Data", "Descrição", "Categoria", "Forma", "Valor"]}
          alinhar={["l", "l", "l", "l", "r"]}
          linhas={r.lancamentos.map((x) => [
            fmtData(dataCaixa(x)),
            x.descricao || x.categoria,
            x.categoria,
            x.forma,
            <span key="v" className={x.tipo === "saida" ? "text-orange-700" : undefined}>
              {x.tipo === "saida" ? "−" : ""}
              {brl(x.valor)}
            </span>,
          ])}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Locações */

function Locacoes({ p }: { p: Periodo }) {
  const { dados } = useDados();
  const r = useMemo(() => relatorioLocacoes(dados, p), [dados, p]);
  const exportar = () =>
    baixar(
      `locacoes-${p.inicio.slice(0, p.escala === "mes" ? 7 : 4)}.csv`,
      csv([
        ["Nº", "Criada em", "Cliente", "Bairro", "Plano", "Entrega", "Coleta", "Situação", "Valor"],
        ...r.lista.map((l) => [codigo(l.numero), fmtData(l.criado_em.slice(0, 10)), l.cliente_nome, l.endereco.bairro, descreverModalidade(l.modalidade, l.quantidade_periodos), fmtData(l.data_entrega), fmtData(l.data_coleta), STATUS[l.status].nome, l.valor_total]),
      ]),
    );
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orçamentos feitos" value={r.orcamentos} hint={`${r.aprovadas} aprovados · ${r.recusadas} recusados · ${r.emAberto} em aberto`} icon={<ClipboardList className="h-4 w-4" />} />
        <Stat label="Conversão" value={pct(r.conversao)} hint="Aprovados entre os respondidos" icon={<TrendingUp className="h-4 w-4" />} tone="good" />
        <Stat label="Valor fechado" value={brl(r.contratado)} hint={`Ticket médio ${brl(r.ticketMedio)}`} icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Movimento" value={`${r.entregues} / ${r.finalizadas}`} hint={`entregas / coletas · ${r.ativas} obras atendidas · ${r.duracaoMedia} dias em média`} icon={<Boxes className="h-4 w-4" />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="break-inside-avoid p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Por plano</h3>
          <Ranking itens={r.porPlano.map((x) => ({ nome: x.plano, valor: x.valor, extra: `${x.qtd}×` }))} />
        </Card>
        <Card className="break-inside-avoid p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Melhores clientes</h3>
          <Ranking itens={r.topClientes.map((x) => ({ nome: x.nome, valor: x.valor, extra: `${x.qtd} ${x.qtd === 1 ? "locação" : "locações"}` }))} />
        </Card>
        <Card className="break-inside-avoid p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Bairros com mais obras</h3>
          <Ranking itens={r.porBairro.map((x) => ({ nome: x.bairro, valor: x.qtd }))} formato={(n) => `${n}`} />
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title="Orçamentos e locações do período"
          subtitle="Pela data em que o orçamento foi feito"
          action={
            <Button size="sm" variant="ghost" onClick={exportar} className="print:hidden">
              <Download className="h-4 w-4" /> CSV
            </Button>
          }
        />
        <Tabela
          cab={["Nº", "Cliente", "Bairro", "Plano", "Entrega", "Situação", "Valor"]}
          alinhar={["l", "l", "l", "l", "l", "l", "r"]}
          linhas={r.lista.map((l) => [
            <Link key="n" href={`/locacoes/${l.id}`} className="font-mono text-xs text-ink-500 hover:text-ink-900">
              {codigo(l.numero)}
            </Link>,
            l.cliente_nome || "—",
            l.endereco.bairro || "—",
            descreverModalidade(l.modalidade, l.quantidade_periodos),
            fmtData(l.data_entrega),
            <Badge key="s" className={STATUS[l.status].cor} dot={STATUS[l.status].ponto}>
              {STATUS[l.status].curto}
            </Badge>,
            brl(l.valor_total),
          ])}
          rodape={["", `${r.lista.length} no período`, "", "", "", "", brl(r.lista.filter((l) => l.status !== "recusada").reduce((s, l) => s + l.valor_total, 0))]}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Estoque */

function Estoque({ p }: { p: Periodo }) {
  const { dados } = useDados();
  const r = useMemo(() => relatorioEstoque(dados, p), [dados, p]);
  const exportar = () =>
    baixar(
      `estoque-${hoje()}.csv`,
      csv([
        ["Equipamento", "Categoria", "Total", "Na obra", "A entregar", "Manutenção", "Disponível", "Ocupação %", "Vezes alugado no período", "Receita no período", "Patrimônio (reposição)"],
        ...r.linhas.map((x) => [x.nome, x.categoria, x.total, x.naObra, x.reservado, x.manutencao, x.disponivel, Math.round(x.ocupacao * 100), x.vezes, x.receita, x.patrimonio]),
      ]),
    );
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Peças no estoque" value={fmtNum(r.total)} hint={`${fmtNum(r.manutencao)} em manutenção`} icon={<Boxes className="h-4 w-4" />} />
        <Stat label="Ocupação agora" value={pct(r.ocupacao)} hint={`${fmtNum(r.naObra)} na obra · ${fmtNum(r.reservado)} a entregar`} icon={<TrendingUp className="h-4 w-4" />} tone={r.ocupacao > 0.85 ? "warn" : "good"} />
        <Stat label={`Receita gerada (${p.nome})`} value={brl(r.receita)} hint="Aluguel das locações que saíram no período" icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Patrimônio" value={brl(r.patrimonio)} hint="Quantidade × valor de reposição" icon={<Scale className="h-4 w-4" />} />
      </div>
      {(r.faltando.length > 0 || r.semGiro.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {r.faltando.length > 0 && (
            <Card className="p-4 ring-rose-200">
              <p className="text-sm font-semibold text-rose-700">Mais peças comprometidas do que o estoque</p>
              <p className="mt-1 text-[13px] text-ink-600">{r.faltando.map((x) => `${x.nome} (${x.disponivel})`).join(", ")}</p>
            </Card>
          )}
          {r.semGiro.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-ink-800">Sem locação no período</p>
              <p className="mt-1 text-[13px] text-ink-600">{r.semGiro.map((x) => x.nome).join(", ")} — vale divulgar ou rever o preço.</p>
            </Card>
          )}
        </div>
      )}
      <Card className="overflow-hidden">
        <CardHeader
          title="Situação de cada equipamento"
          subtitle="Quantidades de hoje; receita e giro do período escolhido"
          action={
            <Button size="sm" variant="ghost" onClick={exportar} className="print:hidden">
              <Download className="h-4 w-4" /> CSV
            </Button>
          }
        />
        <Tabela
          cab={["Equipamento", "Total", "Na obra", "A entregar", "Manut.", "Disponível", "Ocupação", "Alugado", "Receita"]}
          alinhar={["l", "r", "r", "r", "r", "r", "r", "r", "r"]}
          linhas={r.linhas.map((x) => [
            <span key="n">
              <b className="font-medium">{x.nome}</b>
              <span className="block text-[11px] text-ink-400">{x.categoria}</span>
            </span>,
            fmtNum(x.total),
            fmtNum(x.naObra),
            fmtNum(x.reservado),
            fmtNum(x.manutencao),
            <span key="d" className={x.disponivel < 0 ? "font-semibold text-rose-600" : undefined}>
              {fmtNum(x.disponivel)}
            </span>,
            <span key="o" className="inline-flex items-center gap-2">
              <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-ink-100 sm:inline-block">
                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, x.ocupacao * 100)}%` }} />
              </span>
              {pct(x.ocupacao)}
            </span>,
            `${x.vezes}×`,
            brl(x.receita),
          ])}
          rodape={["Total", fmtNum(r.total), fmtNum(r.naObra), fmtNum(r.reservado), fmtNum(r.manutencao), "", pct(r.ocupacao), "", brl(r.receita)]}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Página */

export default function Relatorios() {
  const { dados } = useDados();
  const [aba, setAba] = useState<Aba>("financeiro");
  const [escala, setEscala] = useState<"mes" | "ano">("mes");
  const [ref, setRef] = useState(() => ({ ano: new Date().getFullYear(), mes: new Date().getMonth() }));
  const p = useMemo(() => (escala === "mes" ? periodoMes(ref.ano, ref.mes) : periodoAno(ref.ano)), [escala, ref]);
  const mover = (d: number) =>
    setRef((x) => {
      if (escala === "ano") return { ...x, ano: x.ano + d };
      const m = x.mes + d;
      return { ano: x.ano + Math.floor(m / 12), mes: ((m % 12) + 12) % 12 };
    });
  const titulo = { financeiro: "Relatório financeiro", locacoes: "Relatório de locações", estoque: "Relatório de estoque" }[aba];

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          subtitle="Financeiro, locações e estoque — por mês ou por ano. Imprima em PDF ou baixe para o Excel."
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          }
        />
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Segmented
            value={aba}
            onChange={setAba}
            options={[
              { value: "financeiro", label: "Financeiro" },
              { value: "locacoes", label: "Locações" },
              { value: "estoque", label: "Estoque" },
            ]}
          />
          <div className="flex items-center rounded-xl bg-white p-1 shadow-soft ring-1 ring-ink-200">
            <Button size="icon" variant="ghost" onClick={() => mover(-1)} aria-label="Período anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[92px] text-center font-display text-[15px] font-semibold capitalize">{p.nome}</span>
            <Button size="icon" variant="ghost" onClick={() => mover(1)} aria-label="Próximo período">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Segmented
            value={escala}
            onChange={setEscala}
            options={[
              { value: "mes", label: "Mensal" },
              { value: "ano", label: "Anual" },
            ]}
          />
        </div>
      </div>

      {/* Cabeçalho que só aparece na impressão */}
      <div className="mb-6 hidden items-end justify-between border-b-2 border-ink-900 pb-3 print:flex">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-500 uppercase">{dados.config.empresa_nome}</p>
          <h1 className="font-display text-2xl font-bold capitalize">
            {titulo} — {p.nome}
          </h1>
        </div>
        <p className="text-[11px] text-ink-500">Emitido em {fmtData(hoje())}</p>
      </div>

      {aba === "financeiro" && <Financeiro p={p} />}
      {aba === "locacoes" && <Locacoes p={p} />}
      {aba === "estoque" && <Estoque p={p} />}
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>
    </>
  );
}
