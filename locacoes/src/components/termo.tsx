"use client";

import type { ReactNode } from "react";
import { QR } from "@/components/qr";
import { cx } from "@/components/ui";
import { diffDias, enderecoCompleto, fmtData, fmtDataHora, fmtDocumento, fmtTelefone, linkMaps, temEndereco } from "@/lib/format";
import { pixCopiaECola } from "@/lib/pix";
import { brl, descreverModalidade, descreverPartes, PERIODOS, valorAluguel } from "@/lib/pricing";
import type { Assinatura, Config, Locacao } from "@/lib/types";

const NAVY = "#07002a";

const preencher = (t: string, cfg: Config) => t.replaceAll("{empresa}", cfg.empresa_nome).replaceAll("{desmontagem}", String(cfg.taxa_desmontagem_pct));
const clausulas = (t: string, cfg: Config) =>
  preencher(t, cfg)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Valor de cada linha usando a mesma combinação de planos do total. */
function valorLinha(l: Pick<Locacao, "itens" | "modalidade" | "quantidade_periodos">, idx: number) {
  const { partes } = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const it = l.itens[idx];
  return PERIODOS.reduce((s, p) => s + partes[p.id] * it.quantidade * (it.precos[p.id] || 0), 0);
}

function pixDa(l: Pick<Locacao, "numero" | "valor_total">, cfg: Config) {
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

function LinhaAssinatura({ papel, nome, doc, imagem }: { papel: string; nome?: string; doc?: string; imagem?: string | null }) {
  return (
    <div className="text-center">
      {imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagem} alt={`Assinatura de ${nome}`} className="mx-auto -mb-1 h-10 w-auto max-w-full object-contain" />
      ) : (
        <div className="h-8" />
      )}
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

/** Termo de locação (A4). Usado na tela interna, no PDF e no link de assinatura do cliente. */
export function Termo({ l, cfg, reposicao: tabelaReposicao, assinatura }: { l: Locacao | Omit<Locacao, "historico">; cfg: Config; reposicao: Record<string, number>; assinatura?: Assinatura | null }) {
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const dias = l.data_entrega && l.data_coleta ? diffDias(l.data_entrega, l.data_coleta) : 0;
  const pix = pixDa(l, cfg);
  const reposicao = (id: string) => tabelaReposicao[id] ?? 0;
  const assinado = assinatura?.assinado_em ? assinatura : null;
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
          <Dado k="CPF/CNPJ" v={fmtDocumento(assinado?.documento || l.cliente_documento)} />
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
          <LinhaAssinatura papel={`Locadora — ${cfg.empresa_nome}`} nome={cfg.empresa_responsavel} />
          <LinhaAssinatura papel="Locatário" nome={assinado?.nome || l.cliente_nome} doc={fmtDocumento(assinado?.documento || l.cliente_documento)} imagem={assinado?.imagem} />
          <LinhaAssinatura papel="Recebedor na obra" nome={l.recebedor_nome} doc={fmtDocumento(l.recebedor_documento)} />
        </div>
      </section>

      {assinado && (
        <section className="mt-3 flex items-center gap-3 rounded-[10px] bg-brand-50 px-3.5 py-2 ring-1 ring-brand-200 [break-inside:avoid]">
          {assinado.selfie && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assinado.selfie} alt="Selfie de quem assinou" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-brand-300" />
          )}
          <div className="min-w-0 text-[9px] leading-snug text-ink-700">
            <p className="text-[10px] font-bold text-brand-800">✓ Assinado digitalmente por {assinado.nome}{assinado.documento ? ` (${fmtDocumento(assinado.documento)})` : ""}</p>
            <p>
              Em {fmtDataHora(assinado.assinado_em)} · {assinado.via === "link" ? "pelo link enviado ao cliente" : "no aparelho da empresa"}, com selfie
              {assinado.ip ? ` · IP ${assinado.ip}` : ""}
              {assinado.geo ? ` · local ${assinado.geo}` : ""}
            </p>
            {assinado.hash && <p className="truncate font-mono text-[8px] text-ink-500">Código do documento (SHA-256): {assinado.hash}</p>}
          </div>
        </section>
      )}

      <footer className="mt-3 flex justify-between border-t border-ink-200 pt-2 text-[8.5px] text-ink-400">
        <span>
          {cfg.empresa_nome} · CNPJ {cfg.empresa_cnpj} · {cfg.empresa_telefone}
        </span>
        <span>Contrato nº {String(l.numero).padStart(4, "0")} · 1 via da locadora, 1 via do locatário</span>
      </footer>
    </div>
  );
}

