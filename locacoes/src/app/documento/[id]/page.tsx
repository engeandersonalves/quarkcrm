"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { useDados } from "@/lib/store";
import { addDias, enderecoCompleto, fmtData, fmtDocumento, fmtTelefone, linkWhatsApp } from "@/lib/format";
import { mensagemOrcamento } from "@/lib/mensagens";
import { brl, comparativo, descreverModalidade, descreverPartes, PERIODOS, valorAluguel } from "@/lib/pricing";
import type { Config, Locacao } from "@/lib/types";

const NAVY = "#07002a";
const LAVANDA = "#8ea8db";

const preencher = (t: string, cfg: Config) => t.replaceAll("{empresa}", cfg.empresa_nome).replaceAll("{desmontagem}", String(cfg.taxa_desmontagem_pct));

/** Valor de cada linha usando a mesma combinação de planos do total. */
function valorLinha(l: Locacao, idx: number) {
  const { partes } = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const it = l.itens[idx];
  return PERIODOS.reduce((s, p) => s + partes[p.id] * it.quantidade * (it.precos[p.id] || 0), 0);
}

function Barra({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-2 py-1 text-[13px] font-bold tracking-wide text-white uppercase" style={{ background: NAVY }}>
      {children}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-4 py-[3px] text-[12.5px]">
      <span className="text-right font-semibold uppercase">{k}:</span>
      <span className="uppercase">{v || ""}</span>
    </div>
  );
}

function Termo({ l, cfg }: { l: Locacao; cfg: Config }) {
  const plano = l.modalidade === "dias" ? descreverModalidade(l.modalidade, l.quantidade_periodos) : descreverModalidade(l.modalidade, l.quantidade_periodos).replace(/^1 /, "");
  return (
    <div className="font-mono text-ink-950">
      {/* Cabeçalho */}
      <div className="flex h-[88px] items-center justify-between px-6" style={{ background: NAVY }}>
        <span className="font-sans text-[17px] text-white">{cfg.empresa_telefone}</span>
        <span className="text-[26px] font-bold tracking-wide text-white">TERMO DE ALUGUEL</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/quark-logo.png" alt="Quark" className="h-[66px] w-auto" />
      </div>

      <Barra>Dados do locatário (cliente) — contrato nº {l.numero}</Barra>
      <Linha k="Cliente" v={l.cliente_nome} />
      <Linha k="CPF/CNPJ" v={fmtDocumento(l.cliente_documento)} />
      <Linha k="Telefone" v={fmtTelefone(l.cliente_telefone)} />

      <Barra>Endereço de entrega</Barra>
      <Linha k="Endereço" v={enderecoCompleto(l.endereco)} />
      <Linha k="Obs" v={l.endereco.referencia} />

      <Barra>Responsável pelo recebimento</Barra>
      <Linha k="Nome" v={l.recebedor_nome} />
      <Linha k="CPF/CNPJ" v={fmtDocumento(l.recebedor_documento)} />

      <Barra>Itens alugados</Barra>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr style={{ background: LAVANDA }}>
            <th className="w-24 py-1 font-bold">QTD</th>
            <th className="py-1 text-center font-bold">DESCRIÇÃO</th>
            <th className="w-40 py-1 font-bold">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {l.itens.map((i, idx) => (
            <tr key={i.equipamento_id}>
              <td className="py-[3px] text-center">{i.quantidade}</td>
              <td className="py-[3px] text-center uppercase">{i.nome}</td>
              <td className="py-[3px] text-right pr-6">{brl(valorLinha(l, idx))}</td>
            </tr>
          ))}
          {l.taxa_entrega > 0 && (
            <tr>
              <td />
              <td className="py-[3px] text-center">TX DE ENTREGA</td>
              <td className="py-[3px] text-right pr-6">{brl(l.taxa_entrega)}</td>
            </tr>
          )}
          {l.taxa_retirada > 0 && (
            <tr>
              <td />
              <td className="py-[3px] text-center">TX DE RETIRADA</td>
              <td className="py-[3px] text-right pr-6">{brl(l.taxa_retirada)}</td>
            </tr>
          )}
          {l.desconto > 0 && (
            <tr>
              <td />
              <td className="py-[3px] text-center">DESCONTO</td>
              <td className="py-[3px] text-right pr-6">−{brl(l.desconto)}</td>
            </tr>
          )}
          <tr>
            <td />
            <td className="pt-3 pr-8 text-right font-bold">TOTAL</td>
            <td className="pt-3 pr-6 text-right font-bold">{brl(l.valor_total)}</td>
          </tr>
        </tbody>
      </table>
      {l.observacoes && <p className="mt-2 px-4 text-[11.5px] whitespace-pre-line">OBS: {l.observacoes}</p>}

      <div className="mt-6 px-1 text-[11px] leading-[1.55]">
        <p className="font-bold">TERMO DE COMPROMISSO</p>
        {preencher(cfg.termo_compromisso, cfg)
          .split("\n")
          .filter(Boolean)
          .map((t, i) => (
            <p key={i}>📌 {t}</p>
          ))}
        <p className="mt-3 font-bold">DISPOSIÇÕES ADICIONAIS:</p>
        {preencher(cfg.disposicoes, cfg)
          .split("\n")
          .filter(Boolean)
          .map((t, i) => (
            <p key={i} className="mt-1">
              <b>{i + 1}.</b> {t}
            </p>
          ))}
      </div>

      <div className="mt-8 px-1 font-sans text-[14px]">CHAVE PIX: {cfg.empresa_pix}</div>
      <div className="mt-1 grid grid-cols-[1fr_40px_1fr] items-end text-[12px]">
        <div className="text-center">
          <p className="font-sans text-[14px]">{cfg.empresa_responsavel}</p>
          <div className="mt-1 border-t-2 border-ink-950 pt-1 font-bold uppercase">{cfg.empresa_nome}</div>
          <p>{cfg.empresa_cnpj}</p>
        </div>
        <span />
        <div className="text-center">
          <div className="mt-1 border-t-2 border-ink-950 pt-1 font-bold">CLIENTE</div>
          <p>&nbsp;</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 text-[13px]">
        <div className="flex justify-between px-4 py-1" style={{ background: LAVANDA }}>
          <b>VALOR</b>
          <b className="underline">{brl(l.valor_total)}</b>
        </div>
        <div className="px-4 py-1 text-right font-sans font-semibold uppercase">{plano}</div>
      </div>
      <div className="grid grid-cols-3 px-4 py-1.5 text-[15px] font-bold" style={{ background: LAVANDA }}>
        <span>
          ENTREGA <span className="ml-4 font-sans font-semibold">{fmtData(l.data_entrega)}</span>
        </span>
        <span className="text-center">COLETA</span>
        <span className="text-right font-sans font-semibold">{fmtData(l.data_coleta)}</span>
      </div>
    </div>
  );
}

function OrcamentoDoc({ l, cfg }: { l: Locacao; cfg: Config }) {
  const comp = comparativo(l.itens);
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const validade = addDias(l.criado_em.slice(0, 10), cfg.validade_orcamento_dias);
  return (
    <div className="text-ink-950">
      <div className="relative overflow-hidden px-10 py-9 text-white" style={{ background: NAVY }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-brand-300 uppercase">Orçamento de locação</p>
            <p className="mt-1 font-display text-[34px] leading-none font-bold">nº {String(l.numero).padStart(4, "0")}</p>
            <p className="mt-3 text-[13px] text-ink-300">
              Emitido em {fmtData(l.criado_em.slice(0, 10))} · válido até {fmtData(validade)}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quark-logo.png" alt="Quark" className="h-[72px] w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 px-10 py-7 text-[13px]">
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.18em] text-ink-400 uppercase">Cliente</p>
          <p className="mt-1 text-[16px] font-semibold">{l.cliente_nome || "—"}</p>
          {l.cliente_documento && <p className="text-ink-600">{fmtDocumento(l.cliente_documento)}</p>}
          {l.cliente_telefone && <p className="text-ink-600">{fmtTelefone(l.cliente_telefone)}</p>}
        </div>
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.18em] text-ink-400 uppercase">Local da obra</p>
          <p className="mt-1 text-ink-800">{enderecoCompleto(l.endereco) || "—"}</p>
          {l.endereco.referencia && <p className="text-ink-500">Ref.: {l.endereco.referencia}</p>}
        </div>
      </div>

      <div className="px-10">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left text-[10.5px] font-bold tracking-[0.14em] text-ink-500 uppercase">
              <th className="py-2">Equipamento</th>
              <th className="py-2 text-center">Qtd</th>
              {PERIODOS.map((p) => (
                <th key={p.id} className="py-2 text-right">
                  {p.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200">
            {l.itens.map((i) => (
              <tr key={i.equipamento_id}>
                <td className="py-2.5 font-medium">{i.nome}</td>
                <td className="py-2.5 text-center">
                  {i.quantidade} {i.unidade}
                </td>
                {PERIODOS.map((p) => (
                  <td key={p.id} className="tnum py-2.5 text-right text-ink-700">
                    {brl(i.quantidade * i.precos[p.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-900 font-bold">
              <td className="py-2.5" colSpan={2}>
                Total por período
              </td>
              {comp.map((c) => (
                <td key={c.periodo} className="tnum py-2.5 text-right">
                  {brl(c.valor)}
                </td>
              ))}
            </tr>
            <tr className="text-[11.5px] text-ink-500">
              <td colSpan={2}>Equivale por dia a</td>
              {comp.map((c) => (
                <td key={c.periodo} className="tnum text-right">
                  {brl(c.porDia)}
                  {c.economia > 0.01 && <span className="block font-semibold text-brand-700">−{Math.round(c.economia * 100)}%</span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mx-10 mt-8 grid grid-cols-[1fr_280px] gap-6">
        <div className="text-[12.5px] text-ink-600">
          <p className="text-[10.5px] font-bold tracking-[0.18em] text-ink-400 uppercase">Condições</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              Entrega prevista em <b>{fmtData(l.data_entrega)}</b> e coleta em <b>{fmtData(l.data_coleta)}</b>.
            </li>
            <li>No vencimento, entramos em contato para renovar ou agendar a coleta; sem resposta, o contrato é renovado automaticamente.</li>
            <li>Andaimes e escoras devem estar desmontados na coleta; caso contrário, taxa de {cfg.taxa_desmontagem_pct}% do contrato.</li>
            <li>Danos ou perdas são de responsabilidade do locatário.</li>
          </ul>
          {l.observacoes && <p className="mt-3 whitespace-pre-line">Obs.: {l.observacoes}</p>}
        </div>
        <div className="rounded-2xl p-5 text-white" style={{ background: NAVY }}>
          <p className="text-[11px] text-ink-300">Plano escolhido</p>
          <p className="font-semibold">
            {descreverModalidade(l.modalidade, l.quantidade_periodos)}
            {l.modalidade === "dias" && <span className="block text-[11px] font-normal text-ink-300">{descreverPartes(aluguel.partes)}</span>}
          </p>
          <div className="mt-3 space-y-1 text-[12.5px]">
            <div className="flex justify-between text-ink-300">
              <span>Aluguel</span>
              <span className="tnum text-white">{brl(aluguel.total)}</span>
            </div>
            {l.taxa_entrega + l.taxa_retirada > 0 && (
              <div className="flex justify-between text-ink-300">
                <span>Entrega / retirada</span>
                <span className="tnum text-white">{brl(l.taxa_entrega + l.taxa_retirada)}</span>
              </div>
            )}
            {l.desconto > 0 && (
              <div className="flex justify-between text-ink-300">
                <span>Desconto</span>
                <span className="tnum text-brand-300">−{brl(l.desconto)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 border-t border-white/15 pt-3">
            <p className="text-[11px] text-ink-300">Total</p>
            <p className="tnum font-display text-[30px] leading-none font-bold text-brand-gradient">{brl(l.valor_total)}</p>
          </div>
        </div>
      </div>

      <div className="mx-10 mt-10 flex items-center justify-between border-t border-ink-200 pt-5 pb-10 text-[12px] text-ink-500">
        <span>
          <b className="text-ink-900">{cfg.empresa_nome}</b> · CNPJ {cfg.empresa_cnpj}
        </span>
        <span>
          {cfg.empresa_telefone} · PIX {cfg.empresa_pix}
        </span>
      </div>
    </div>
  );
}

function Conteudo() {
  const { id } = useParams<{ id: string }>();
  const tipo = useSearchParams().get("tipo") === "termo" ? "termo" : "orcamento";
  const { dados, carregando } = useDados();
  const l = dados.locacoes.find((x) => x.id === id);
  const cfg = dados.config;

  if (!l) return <p className="p-10 text-center text-sm text-ink-500">{carregando ? "Carregando…" : "Documento não encontrado."}</p>;

  return (
    <div className="min-h-dvh bg-ink-200/60 py-6 print:bg-white print:py-0">
      <title>{`${tipo === "termo" ? "Termo de aluguel" : "Orçamento"} ${l.numero} — ${l.cliente_nome}`}</title>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-4">
        <Link href={`/locacoes/${l.id}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div className="ml-auto flex gap-2">
          <Link href={`/documento/${l.id}?tipo=${tipo === "termo" ? "orcamento" : "termo"}`}>
            <Button variant="secondary">{tipo === "termo" ? "Ver orçamento" : "Ver termo"}</Button>
          </Link>
          {tipo === "orcamento" && (
            <a href={linkWhatsApp(l.cliente_telefone, mensagemOrcamento(l, cfg))} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
          )}
          <Button variant="brand" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / salvar PDF
          </Button>
        </div>
      </div>
      <div className="mx-auto w-[210mm] max-w-full overflow-x-auto">
        <div className="min-h-[297mm] w-[210mm] bg-white shadow-lift print:shadow-none" style={{ padding: tipo === "termo" ? "12mm 10mm" : 0 }}>
          {tipo === "termo" ? <Termo l={l} cfg={cfg} /> : <OrcamentoDoc l={l} cfg={cfg} />}
        </div>
      </div>
    </div>
  );
}

export default function Documento() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
