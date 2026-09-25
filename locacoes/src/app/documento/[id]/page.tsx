"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Printer } from "lucide-react";
import { Termo } from "@/components/termo";
import { Button, ButtonLink, cx } from "@/components/ui";
import { useDados } from "@/lib/store";
import { addDias, enderecoCompleto, fmtData, fmtDocumento, fmtTelefone, linkWhatsApp } from "@/lib/format";
import { mensagemOrcamento } from "@/lib/mensagens";
import { brl, comparativo, descreverModalidade, descreverPartes, PERIODOS, valorAluguel } from "@/lib/pricing";
import type { Assinatura, Config, Locacao } from "@/lib/types";

const NAVY = "#07002a";

/* ------------------------------------------------------------------ orçamento */

function OrcamentoDoc({ l, cfg }: { l: Locacao; cfg: Config }) {
  const comp = comparativo(l.itens);
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const validade = addDias(l.criado_em.slice(0, 10), cfg.validade_orcamento_dias);
  return (
    <div className="text-ink-950">
      <div className="relative overflow-hidden px-10 py-9 text-white" style={{ background: NAVY }}>
        <div className="pointer-events-none absolute -top-20 -right-10 h-64 w-64 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="relative flex items-start justify-between">
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
                <th key={p.id} className={cx("py-2 text-right", p.id === l.modalidade && "text-ink-950")}>
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
                  <td key={p.id} className={cx("tnum py-2.5 text-right text-ink-600", p.id === l.modalidade && "font-semibold text-ink-950")}>
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
                <td key={c.periodo} className={cx("tnum py-2.5 text-right", c.periodo === l.modalidade && "text-brand-700")}>
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
            <p className="tnum font-display text-[30px] leading-none font-bold text-brand-400">{brl(l.valor_total)}</p>
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

/* ------------------------------------------------------------------ página */

/** No celular, reduz a folha A4 para caber na tela (na impressão volta ao normal). */
function useEscala() {
  const [z, setZ] = useState(1);
  useEffect(() => {
    const f = () => setZ(Math.min(1, (window.innerWidth - 16) / 794));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return z;
}

function Conteudo() {
  const { id } = useParams<{ id: string }>();
  const tipo = useSearchParams().get("tipo") === "termo" ? "termo" : "orcamento";
  const { dados, carregando, backend } = useDados();
  const escala = useEscala();
  const l = dados.locacoes.find((x) => x.id === id);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  useEffect(() => {
    if (tipo === "termo" && l?.assinado_em) backend.assinatura(l.id).then(setAssinatura).catch(() => {});
  }, [tipo, l?.id, l?.assinado_em, backend]);
  const cfg = dados.config;

  if (!l) return <p className="p-10 text-center text-sm text-ink-500">{carregando ? "Carregando…" : "Documento não encontrado."}</p>;

  return (
    <div className="min-h-dvh bg-ink-200/60 py-6 print:bg-white print:py-0">
      <title>{`${tipo === "termo" ? "Termo de locação" : "Orçamento"} ${l.numero} — ${l.cliente_nome}`}</title>
      <style>{`@media print { .folha { zoom: 1 !important; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-4">
        <ButtonLink href={`/locacoes/${l.id}`} variant="ghost">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </ButtonLink>
        <div className="ml-auto flex flex-wrap gap-2">
          <ButtonLink href={`/documento/${l.id}?tipo=${tipo === "termo" ? "orcamento" : "termo"}`} variant="secondary">
            {tipo === "termo" ? "Ver orçamento" : "Ver termo"}
          </ButtonLink>
          {tipo === "orcamento" && (
            <ButtonLink href={linkWhatsApp(l.cliente_telefone, mensagemOrcamento(l, cfg))} target="_blank" variant="secondary">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </ButtonLink>
          )}
          <Button variant="brand" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / salvar PDF
          </Button>
        </div>
      </div>
      <div className="folha mx-auto w-[210mm]" style={{ zoom: escala }}>
        <div className={cx("min-h-[297mm] w-[210mm] bg-white shadow-lift print:min-h-0 print:shadow-none", tipo === "termo" && "px-[11mm] py-[10mm] print:py-0")}>
          {tipo === "termo" ? <Termo l={assinatura?.assinado_em ? assinatura.termo.locacao : l} cfg={assinatura?.assinado_em ? assinatura.termo.config : cfg} reposicao={assinatura?.assinado_em ? assinatura.termo.reposicao : Object.fromEntries(dados.equipamentos.map((e) => [e.id, e.valor_reposicao]))} assinatura={assinatura} /> : <OrcamentoDoc l={l} cfg={cfg} />}
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
