"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, MessageCircle, Printer } from "lucide-react";
import { QR } from "@/components/qr";
import { Button, ButtonLink, cx } from "@/components/ui";
import { useDados } from "@/lib/store";
import { addDias, diffDias, enderecoCompleto, fmtData, fmtDocumento, fmtTelefone, linkMaps, linkWhatsApp, temEndereco } from "@/lib/format";
import { mensagemOrcamento } from "@/lib/mensagens";
import { pixCopiaECola } from "@/lib/pix";
import { brl, comparativo, descreverModalidade, descreverPartes, PERIODOS, valorAluguel } from "@/lib/pricing";
import type { Config, Equipamento, Locacao } from "@/lib/types";

const NAVY = "#07002a";

const preencher = (t: string, cfg: Config) => t.replaceAll("{empresa}", cfg.empresa_nome).replaceAll("{desmontagem}", String(cfg.taxa_desmontagem_pct));
const clausulas = (t: string, cfg: Config) =>
  preencher(t, cfg)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Valor de cada linha usando a mesma combinação de planos do total. */
function valorLinha(l: Locacao, idx: number) {
  const { partes } = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const it = l.itens[idx];
  return PERIODOS.reduce((s, p) => s + partes[p.id] * it.quantidade * (it.precos[p.id] || 0), 0);
}

function pixDa(l: Locacao, cfg: Config) {
  if (!cfg.empresa_pix) return null;
  return pixCopiaECola({
    chave: cfg.empresa_pix,
    nome: cfg.pix_titular || cfg.empresa_nome,
    cidade: cfg.empresa_cidade || "Brasil",
    valor: l.valor_total,
    identificador: `LOC${String(l.numero).padStart(4, "0")}`,
  });
}

/* ------------------------------------------------------------------ peças do layout */

function Rotulo({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[8.5px] font-bold tracking-[0.16em] text-ink-400 uppercase", className)}>{children}</p>;
}

function Dado({ k, v, forte }: { k: string; v?: ReactNode; forte?: boolean }) {
  return (
    <div className="flex gap-2 py-[2px] text-[10.5px] leading-snug">
      <span className="w-[62px] shrink-0 text-ink-500">{k}</span>
      <span className={cx("min-w-0 flex-1 border-b border-dotted border-ink-300", forte ? "font-semibold text-ink-950" : "text-ink-800")}>{v || " "}</span>
    </div>
  );
}

function Caixa({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[10px] px-3.5 py-2.5 ring-1 ring-ink-200 [break-inside:avoid]", className)}>
      <Rotulo className="mb-1.5">{titulo}</Rotulo>
      {children}
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[10px] text-ink-700">
      <span className="inline-block h-3 w-3 shrink-0 rounded-[3px] ring-1 ring-ink-400" />
      {children}
    </p>
  );
}

function Assinatura({ papel, nome, doc }: { papel: string; nome?: string; doc?: string }) {
  return (
    <div className="text-center">
      <div className="h-8" />
      <div className="border-t border-ink-900 pt-1.5">
        <p className="text-[10.5px] font-semibold text-ink-950">{nome || " "}</p>
        <p className="text-[9px] text-ink-500">
          {papel}
          {doc ? ` · ${doc}` : ""}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ termo de locação */

function Termo({ l, cfg, equipamentos }: { l: Locacao; cfg: Config; equipamentos: Equipamento[] }) {
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const dias = l.data_entrega && l.data_coleta ? diffDias(l.data_entrega, l.data_coleta) : 0;
  const pix = pixDa(l, cfg);
  const reposicao = (id: string) => equipamentos.find((e) => e.id === id)?.valor_reposicao ?? 0;
  const sufixo = l.modalidade === "dias" ? "" : `/${PERIODOS.find((p) => p.id === l.modalidade)!.singular}`;
  const todas = [...clausulas(cfg.termo_compromisso, cfg), ...clausulas(cfg.disposicoes, cfg)];

  return (
    <div className="text-ink-900">
      {/* Margem das páginas na impressão (o termo pode ocupar 2 páginas) */}
      <style>{`@media print { @page { size: A4; margin: 7mm 0; } }`}</style>

      {/* Cabeçalho */}
      <header className="relative overflow-hidden rounded-[14px] px-6 py-4 text-white" style={{ background: NAVY }}>
        <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-brand-400/15 blur-2xl" />
        <div className="relative flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quark-logo.png" alt="Quark" className="h-[58px] w-auto" />
          <div className="min-w-0 flex-1 border-l border-white/15 pl-5">
            <p className="text-[9px] font-semibold tracking-[0.28em] text-brand-300 uppercase">{cfg.empresa_nome}</p>
            <h1 className="mt-1 font-display text-[21px] leading-tight font-bold">Termo de Locação de Equipamentos</h1>
            <p className="mt-1 text-[10.5px] text-ink-300">
              CNPJ {cfg.empresa_cnpj} · {cfg.empresa_telefone}
              {cfg.empresa_endereco && ` · ${cfg.empresa_endereco}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-[0.2em] text-ink-400 uppercase">Contrato</p>
            <p className="font-display text-[26px] leading-none font-bold text-brand-400">nº {String(l.numero).padStart(4, "0")}</p>
            <p className="mt-1 text-[9.5px] text-ink-400">emitido em {fmtData(l.criado_em.slice(0, 10))}</p>
          </div>
        </div>
      </header>

      {/* Partes */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Caixa titulo="Locatário (cliente)">
          <Dado k="Nome" v={l.cliente_nome} forte />
          <Dado k="CPF/CNPJ" v={fmtDocumento(l.cliente_documento)} />
          <Dado k="Telefone" v={fmtTelefone(l.cliente_telefone)} />
        </Caixa>
        <Caixa titulo="Recebimento na obra">
          <Dado k="Recebe" v={l.recebedor_nome} forte />
          <Dado k="CPF" v={fmtDocumento(l.recebedor_documento)} />
          <Dado k="Data/hora" v="" />
        </Caixa>
      </div>

      {/* Local da obra */}
      <Caixa titulo="Local da obra — endereço de entrega e coleta" className="mt-3">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold text-ink-950">{enderecoCompleto(l.endereco) || "—"}</p>
            {l.endereco.referencia && (
              <p className="mt-1 text-[10.5px] text-ink-600">
                <b className="text-ink-800">Referência:</b> {l.endereco.referencia}
              </p>
            )}
          </div>
          {temEndereco(l.endereco) && (
            <div className="flex shrink-0 items-center gap-2">
              <p className="w-[70px] text-right text-[8.5px] leading-tight text-ink-500">Aponte a câmera para abrir o mapa da obra</p>
              <QR texto={linkMaps(l.endereco)} className="h-[68px] w-[68px]" />
            </div>
          )}
        </div>
      </Caixa>

      {/* Período */}
      <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-[10px] ring-1 ring-ink-200 [break-inside:avoid]">
        {[
          ["Plano", descreverModalidade(l.modalidade, l.quantidade_periodos)],
          ["Entrega", fmtData(l.data_entrega)],
          ["Coleta prevista", fmtData(l.data_coleta)],
          ["Duração", `${dias} ${dias === 1 ? "dia" : "dias"}`],
        ].map(([k, v], i) => (
          <div key={k} className={cx("px-3.5 py-2.5", i > 0 && "border-l border-ink-200", i === 2 && "bg-brand-50")}>
            <Rotulo>{k}</Rotulo>
            <p className="mt-0.5 font-display text-[13.5px] font-semibold text-ink-950">{v}</p>
          </div>
        ))}
      </div>

      {/* Itens */}
      <div className="mt-3 overflow-hidden rounded-[10px] ring-1 ring-ink-200 [break-inside:avoid]">
        <table className="w-full text-[10.5px]">
          <thead>
            <tr className="text-left text-[8.5px] font-bold tracking-[0.12em] text-white uppercase" style={{ background: NAVY }}>
              <th className="w-12 py-2 pl-3.5 text-center">Qtd</th>
              <th className="py-2 pl-2">Equipamento</th>
              <th className="py-2 pr-2 text-right">Valor unit.</th>
              <th className="py-2 pr-2 text-right">Reposição unit.</th>
              <th className="py-2 pr-3.5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {l.itens.map((i, idx) => {
              const unit = l.modalidade === "dias" ? null : i.precos[l.modalidade];
              const rep = reposicao(i.equipamento_id);
              return (
                <tr key={i.equipamento_id} className="even:bg-ink-50/70">
                  <td className="tnum py-1.5 pl-3.5 text-center font-bold">{i.quantidade}</td>
                  <td className="py-1.5 pl-2">
                    {i.nome} <span className="text-ink-400">({i.unidade})</span>
                  </td>
                  <td className="tnum py-1.5 pr-2 text-right text-ink-600">{unit == null ? "—" : `${brl(unit)}${sufixo}`}</td>
                  <td className="tnum py-1.5 pr-2 text-right text-ink-600">{rep > 0 ? brl(rep) : "—"}</td>
                  <td className="tnum py-1.5 pr-3.5 text-right font-semibold">{brl(valorLinha(l, idx))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagamento + totais */}
      <div className="mt-3 grid grid-cols-[1fr_230px] gap-3 [break-inside:avoid]">
        <div className="flex gap-3.5 rounded-[10px] px-3.5 py-3 ring-1 ring-ink-200">
          {pix ? (
            <>
              <div className="shrink-0 rounded-lg bg-white p-1 ring-1 ring-ink-200">
                <QR texto={pix} className="h-[84px] w-[84px]" />
              </div>
              <div className="min-w-0 text-[10px] text-ink-600">
                <Rotulo>Pagamento via PIX</Rotulo>
                <p className="mt-1">
                  Chave: <b className="text-ink-950">{cfg.empresa_pix}</b>
                </p>
                <p>
                  Titular: <b className="text-ink-950">{cfg.pix_titular || cfg.empresa_nome}</b>
                </p>
                <p className="mt-1 leading-snug">
                  Abra o app do banco, escolha <b>Pagar com QR Code</b> e aponte a câmera — o valor de <b>{brl(l.valor_total)}</b> já vem preenchido.
                </p>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-ink-500">Cadastre a chave PIX em Ajustes para mostrar o QR Code de pagamento.</p>
          )}
        </div>
        <div className="overflow-hidden rounded-[10px] ring-1 ring-ink-200">
          <div className="space-y-1 px-3.5 py-2.5 text-[10.5px]">
            <div className="flex justify-between text-ink-600">
              <span>
                Aluguel{l.modalidade === "dias" && <span className="text-ink-400"> ({descreverPartes(aluguel.partes)})</span>}
              </span>
              <span className="tnum text-ink-900">{brl(aluguel.total)}</span>
            </div>
            {l.taxa_entrega > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Taxa de entrega</span>
                <span className="tnum text-ink-900">{brl(l.taxa_entrega)}</span>
              </div>
            )}
            {l.taxa_retirada > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Taxa de retirada</span>
                <span className="tnum text-ink-900">{brl(l.taxa_retirada)}</span>
              </div>
            )}
            {l.desconto > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Desconto</span>
                <span className="tnum text-brand-700">−{brl(l.desconto)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5 text-white" style={{ background: NAVY }}>
            <span className="text-[9px] font-bold tracking-[0.18em] uppercase">Total</span>
            <span className="tnum font-display text-[19px] font-bold text-brand-400">{brl(l.valor_total)}</span>
          </div>
        </div>
      </div>

      {l.observacoes && (
        <p className="mt-3 rounded-[10px] bg-amber-50 px-3.5 py-2 text-[10.5px] whitespace-pre-line text-amber-950 ring-1 ring-amber-200">
          <b>Observações:</b> {l.observacoes}
        </p>
      )}

      {/* Condições */}
      <section className="mt-4">
        <Rotulo className="mb-1.5">Condições da locação</Rotulo>
        <ol className="columns-2 gap-6 text-[9.5px] leading-[1.5] text-ink-700">
          {todas.map((t, i) => {
            const m = t.match(/^([^:]{2,40}):\s+(.+)$/s);
            return (
              <li key={i} className="mb-1 flex gap-1.5 [break-inside:avoid]">
                <span className="tnum mt-[1px] grid h-[14px] w-[14px] shrink-0 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: NAVY }}>
                  {i + 1}
                </span>
                <span>
                  {m ? (
                    <>
                      <b className="text-ink-950">{m[1]}:</b> {m[2]}
                    </>
                  ) : (
                    t
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Conferência */}
      <div className="mt-3 grid grid-cols-2 gap-3 [break-inside:avoid]">
        <Caixa titulo="Conferência na entrega">
          <div className="grid grid-cols-2 gap-y-1">
            <Check>Quantidades conferidas</Check>
            <Check>Itens em bom estado</Check>
          </div>
          <Dado k="Visto" v="" />
        </Caixa>
        <Caixa titulo="Conferência na coleta">
          <div className="grid grid-cols-2 gap-y-1">
            <Check>Quantidades conferidas</Check>
            <Check>Itens desmontados</Check>
          </div>
          <Dado k="Visto" v="" />
        </Caixa>
      </div>

      {/* Assinaturas */}
      <section className="mt-3 [break-inside:avoid]">
        <p className="text-[10.5px] text-ink-600">{cfg.empresa_cidade || "________________"}, ____ de ______________ de ________.</p>
        <div className="mt-1 grid grid-cols-3 gap-6">
          <Assinatura papel={`Locadora — ${cfg.empresa_nome}`} nome={cfg.empresa_responsavel} />
          <Assinatura papel="Locatário" nome={l.cliente_nome} doc={fmtDocumento(l.cliente_documento)} />
          <Assinatura papel="Recebedor na obra" nome={l.recebedor_nome} doc={fmtDocumento(l.recebedor_documento)} />
        </div>
      </section>

      <footer className="mt-3 flex justify-between border-t border-ink-200 pt-2 text-[8.5px] text-ink-400">
        <span>
          {cfg.empresa_nome} · CNPJ {cfg.empresa_cnpj} · {cfg.empresa_telefone}
        </span>
        <span>Contrato nº {String(l.numero).padStart(4, "0")} · 1 via da locadora, 1 via do locatário</span>
      </footer>
    </div>
  );
}

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
  const { dados, carregando } = useDados();
  const escala = useEscala();
  const l = dados.locacoes.find((x) => x.id === id);
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
          {tipo === "termo" ? <Termo l={l} cfg={cfg} equipamentos={dados.equipamentos} /> : <OrcamentoDoc l={l} cfg={cfg} />}
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
