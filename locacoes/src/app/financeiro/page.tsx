"use client";

import { confirmar } from "@/components/dialogo";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock, MessageCircle, Plus, Scale, Wallet } from "lucide-react";
import { ReceberModal } from "@/components/receber-modal";
import { Button, Card, CardHeader, cx, Empty, Field, Input, Modal, MoneyInput, PageHeader, Segmented, Select, Stat, Switch, ButtonLink } from "@/components/ui";
import { useDados } from "@/lib/store";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, FORMAS_PAGAMENTO } from "@/lib/defaults";
import { diffDias, fmtData, hoje, linkWhatsApp, MESES, parseData, codigo } from "@/lib/format";
import { mensagemCobranca } from "@/lib/mensagens";
import { novoLancamento } from "@/lib/novo";
import { brl, PERIODOS } from "@/lib/pricing";
import type { Lancamento, Modalidade } from "@/lib/types";

type Escala = "mes" | "ano";

/** Data em que o dinheiro entrou/saiu de fato (ou vencimento, se ainda aberto). */
const dataCaixa = (x: Lancamento) => (x.pago ? x.pago_em || x.data : x.data);

function Barras({ dados, rotulo }: { dados: { chave: string; label: string; valor: number; destaque?: boolean }[]; rotulo: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const h = hover != null ? dados[hover] : null;
  const passo = dados.length > 20 ? 5 : 1;
  return (
    <div>
      <div className="mb-2 h-10">
        {h ? (
          <div className="animate-fade-up">
            <p className="text-[12px] text-ink-500">{h.label}</p>
            <p className="tnum font-display text-lg font-semibold">{brl(h.valor)}</p>
          </div>
        ) : (
          <p className="pt-3 text-[12px] text-ink-400">{rotulo} — passe o dedo/mouse nas barras</p>
        )}
      </div>
      <div className="relative h-44" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-200/70" style={{ bottom: `${g * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {dados.map((d, i) => (
            <button
              key={d.chave}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              className="group flex h-full min-w-0 flex-1 items-end justify-center"
              aria-label={`${d.label}: ${brl(d.valor)}`}
            >
              <div
                className={cx("w-full max-w-[28px] rounded-t-[4px] transition-colors", d.valor > 0 ? (hover === i ? "bg-brand-700" : d.destaque ? "bg-ink-900" : "bg-brand-500") : "bg-ink-200")}
                style={{ height: d.valor > 0 ? `${Math.max(2, (d.valor / max) * 100)}%` : "2px" }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-ink-200 pt-1.5">
        {dados.map((d, i) => (
          <span key={d.chave} className="tnum min-w-0 flex-1 text-center text-[10px] text-ink-400">
            {i % passo === 0 || i === dados.length - 1 ? d.label.split(" ")[0] : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function EditarLancamento({ lanc, onClose }: { lanc: Lancamento; onClose: () => void }) {
  const { dados, salvarLancamento, excluirLancamento } = useDados();
  const [x, setX] = useState(lanc);
  const set = (p: Partial<Lancamento>) => setX((v) => ({ ...v, ...p }));
  const existe = dados.lancamentos.some((y) => y.id === x.id);
  const cats = x.tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  return (
    <Modal
      open
      onClose={onClose}
      title={existe ? "Editar lançamento" : x.tipo === "entrada" ? "Nova entrada" : "Nova despesa"}
      footer={
        <>
          {existe && (
            <Button
              variant="ghost"
              className="mr-auto text-rose-600 hover:bg-rose-50"
              onClick={async () => {
                if (!(await confirmar({ titulo: "Excluir este lançamento?", texto: `${x.descricao || x.categoria} — some do financeiro.`, ok: "Excluir", perigo: true }))) return;
                await excluirLancamento(x.id);
                onClose();
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            onClick={async () => {
              if (x.valor <= 0) return toast.error("Informe o valor");
              await salvarLancamento({ ...x, pago_em: x.pago ? x.pago_em || x.data : null });
              onClose();
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          className="sm:col-span-2"
          value={x.tipo}
          onChange={(t) => set({ tipo: t, categoria: t === "entrada" ? CATEGORIAS_ENTRADA[0] : CATEGORIAS_SAIDA[0] })}
          options={[
            { value: "entrada", label: "Entrada" },
            { value: "saida", label: "Despesa" },
          ]}
        />
        <Field label="Valor">
          <MoneyInput autoFocus value={x.valor} onChange={(v) => set({ valor: v })} />
        </Field>
        <Field label="Categoria">
          <Select value={x.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            {[...new Set([...cats, x.categoria])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Input value={x.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder={x.tipo === "saida" ? "Ex.: Diesel do caminhão" : "Ex.: Aluguel avulso"} />
        </Field>
        <Field label={x.pago ? "Data" : "Vencimento"}>
          <Input type="date" value={x.pago ? x.pago_em || x.data : x.data} onChange={(e) => set(x.pago ? { pago_em: e.target.value, data: e.target.value } : { data: e.target.value })} />
        </Field>
        <Field label="Forma">
          <Select value={x.forma} onChange={(e) => set({ forma: e.target.value })}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={x.pago} onChange={(v) => set({ pago: v, pago_em: v ? hoje() : null })} label={x.tipo === "entrada" ? "Já recebido" : "Já pago"} />
        </div>
      </div>
    </Modal>
  );
}

export default function Financeiro() {
  const { dados, salvarLancamento } = useDados();
  const [escala, setEscala] = useState<Escala>("mes");
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const [aba, setAba] = useState<"movimentos" | "receber" | "pagar">("movimentos");
  const [editar, setEditar] = useState<Lancamento | null>(null);
  const [receber, setReceber] = useState<Lancamento | null>(null);

  const noPeriodo = (s: string) => {
    const d = parseData(s);
    return d.getFullYear() === ref.ano && (escala === "ano" || d.getMonth() === ref.mes);
  };

  const r = useMemo(() => {
    const ls = dados.lancamentos;
    const pagos = ls.filter((x) => x.pago && noPeriodo(dataCaixa(x)));
    const entradas = pagos.filter((x) => x.tipo === "entrada");
    const saidas = pagos.filter((x) => x.tipo === "saida");
    const soma = (a: Lancamento[]) => a.reduce((s, x) => s + x.valor, 0);
    const aReceber = ls.filter((x) => x.tipo === "entrada" && !x.pago);
    const aPagar = ls.filter((x) => x.tipo === "saida" && !x.pago);
    const h = hoje();

    // Série do gráfico
    let serie: { chave: string; label: string; valor: number; destaque?: boolean }[];
    if (escala === "mes") {
      const dias = new Date(ref.ano, ref.mes + 1, 0).getDate();
      serie = Array.from({ length: dias }, (_, i) => {
        const dia = `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        return { chave: dia, label: `${i + 1} de ${MESES[ref.mes]}`, valor: soma(entradas.filter((x) => dataCaixa(x) === dia)), destaque: dia === h };
      });
    } else {
      serie = MESES.map((m, i) => ({ chave: m, label: `${m} ${ref.ano}`, valor: soma(entradas.filter((x) => parseData(dataCaixa(x)).getMonth() === i)) }));
    }

    // Receita por plano e por categoria
    const porPlano = new Map<Modalidade | "outros", number>();
    for (const x of entradas) {
      const k = x.categoria === "Aluguel" || x.categoria === "Renovação" ? x.modalidade ?? "outros" : "outros";
      porPlano.set(k, (porPlano.get(k) ?? 0) + x.valor);
    }
    const porCategoria = new Map<string, number>();
    for (const x of saidas) porCategoria.set(x.categoria, (porCategoria.get(x.categoria) ?? 0) + x.valor);

    return {
      recebido: soma(entradas),
      despesas: soma(saidas),
      hojeRecebido: soma(ls.filter((x) => x.tipo === "entrada" && x.pago && dataCaixa(x) === h)),
      aReceber,
      aPagar,
      totalReceber: soma(aReceber),
      atrasado: soma(aReceber.filter((x) => x.data < h)),
      movimentos: ls.filter((x) => x.pago && noPeriodo(dataCaixa(x))).sort((a, b) => dataCaixa(b).localeCompare(dataCaixa(a))),
      serie,
      porPlano,
      porCategoria,
      nEntradas: entradas.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.lancamentos, escala, ref]);

  const mover = (d: number) =>
    setRef((x) => {
      if (escala === "ano") return { ...x, ano: x.ano + d };
      const m = x.mes + d;
      return { ano: x.ano + Math.floor(m / 12), mes: ((m % 12) + 12) % 12 };
    });

  const nomePeriodo = escala === "ano" ? String(ref.ano) : `${MESES[ref.mes]} ${ref.ano}`;
  const saldo = r.recebido - r.despesas;
  const locacaoDe = (id: string | null) => (id ? dados.locacoes.find((l) => l.id === id) : undefined);

  const linhas = aba === "movimentos" ? r.movimentos : aba === "receber" ? [...r.aReceber].sort((a, b) => a.data.localeCompare(b.data)) : [...r.aPagar].sort((a, b) => a.data.localeCompare(b.data));
  const planoNome = (k: Modalidade | "outros") => (k === "outros" ? "Taxas e outros" : k === "dias" ? "Nº de dias" : PERIODOS.find((p) => p.id === k)!.nome);
  const maxPlano = Math.max(...r.porPlano.values(), 1);

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Entradas por dia e por mês, o que falta receber e as despesas."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditar(novoLancamento("saida"))}>
              <ArrowDownRight className="h-4 w-4 text-rose-600" /> Despesa
            </Button>
            <Button variant="brand" onClick={() => setEditar(novoLancamento("entrada"))}>
              <Plus className="h-4 w-4" /> Entrada
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl bg-white p-1 shadow-soft ring-1 ring-ink-200">
          <Button size="icon" variant="ghost" onClick={() => mover(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[96px] text-center font-display text-[15px] font-semibold capitalize">{nomePeriodo}</span>
          <Button size="icon" variant="ghost" onClick={() => mover(1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Segmented
          value={escala}
          onChange={setEscala}
          options={[
            { value: "mes", label: "Por dia (mês)" },
            { value: "ano", label: "Por mês (ano)" },
          ]}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Recebido em ${nomePeriodo}`} value={brl(r.recebido)} hint={`Hoje: ${brl(r.hojeRecebido)} · ${r.nEntradas} recebimentos`} icon={<ArrowUpRight className="h-4 w-4" />} tone="good" />
        <Stat label="Despesas" value={brl(r.despesas)} icon={<ArrowDownRight className="h-4 w-4" />} tone="bad" />
        <Stat label="Resultado" value={<span className={saldo < 0 ? "text-rose-600" : undefined}>{brl(saldo)}</span>} hint={r.recebido > 0 ? `Margem ${Math.round((saldo / r.recebido) * 100)}%` : undefined} icon={<Scale className="h-4 w-4" />} />
        <Stat label="A receber (total)" value={brl(r.totalReceber)} hint={r.atrasado > 0 ? <span className="font-semibold text-rose-600">{brl(r.atrasado)} vencido</span> : "Nada vencido 👍"} icon={<Clock className="h-4 w-4" />} tone={r.atrasado > 0 ? "warn" : "default"} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold">Entradas recebidas {escala === "mes" ? "por dia" : "por mês"}</h3>
          <div className="mt-3">
            <Barras dados={r.serie} rotulo={nomePeriodo} />
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold">Receita por plano</h3>
          <p className="text-[12px] text-ink-500">De onde veio o dinheiro em {nomePeriodo}</p>
          <div className="mt-4 grid gap-3">
            {r.porPlano.size === 0 && <p className="text-sm text-ink-400">Sem recebimentos no período.</p>}
            {[...r.porPlano.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium text-ink-700">{planoNome(k)}</span>
                    <span className="tnum font-semibold">{brl(v)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink-100">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(v / maxPlano) * 100}%` }} />
                  </div>
                </div>
              ))}
          </div>
          {r.porCategoria.size > 0 && (
            <>
              <h3 className="mt-6 font-display text-[15px] font-semibold">Despesas por tipo</h3>
              <ul className="mt-2 divide-y divide-ink-100 text-[13px]">
                {[...r.porCategoria.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between py-1.5">
                      <span className="text-ink-600">{k}</span>
                      <span className="tnum font-semibold">{brl(v)}</span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Lançamentos"
          icon={<Wallet className="h-[18px] w-[18px]" />}
          action={
            <Segmented
              size="sm"
              value={aba}
              onChange={setAba}
              options={[
                { value: "movimentos", label: `Pagos em ${escala === "mes" ? MESES[ref.mes] : ref.ano}` },
                { value: "receber", label: `A receber (${r.aReceber.length})` },
                { value: "pagar", label: `A pagar (${r.aPagar.length})` },
              ]}
            />
          }
        />
        {linhas.length === 0 ? (
          <Empty icon={<Wallet className="h-6 w-6" />} title={aba === "receber" ? "Nada a receber" : aba === "pagar" ? "Nada a pagar" : "Nenhum lançamento no período"} />
        ) : (
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {linhas.map((x) => {
              const l = locacaoDe(x.locacao_id);
              const vencido = !x.pago && x.data < hoje();
              return (
                <li key={x.id} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", x.tipo === "entrada" ? "bg-brand-100 text-brand-700" : "bg-rose-100 text-rose-700")}>
                    {x.tipo === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <div role="button" tabIndex={0} className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setEditar(x)} onKeyDown={(e) => e.key === "Enter" && setEditar(x)}>
                    <p className="truncate text-[14px] font-medium">{x.descricao || x.categoria}</p>
                    <p className="text-[12px] text-ink-500">
                      {x.categoria} · {x.pago ? `${fmtData(dataCaixa(x))} · ${x.forma}` : <span className={vencido ? "font-semibold text-rose-600" : undefined}>{vencido ? `venceu há ${diffDias(x.data, hoje())}d` : `vence ${fmtData(x.data)}`}</span>}
                      {l && (
                        <>
                          {" · "}
                          <Link href={`/locacoes/${l.id}`} className="font-semibold text-ink-700 underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                            {codigo(l.numero)}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <span className={cx("tnum text-[14px] font-semibold whitespace-nowrap", x.tipo === "entrada" ? "text-ink-900" : "text-rose-600")}>
                    {x.tipo === "saida" && "−"}
                    {brl(x.valor)}
                  </span>
                  {!x.pago && (
                    <div className="flex gap-1.5">
                      {x.tipo === "entrada" && l?.cliente_telefone && (
                        <ButtonLink href={linkWhatsApp(l.cliente_telefone, mensagemCobranca(l, x.valor, dados.config))} target="_blank" title="Cobrar no WhatsApp" size="icon" variant="ghost">
                            <MessageCircle className="h-4 w-4" />
                          </ButtonLink>
                      )}
                      {x.tipo === "entrada" ? (
                        <Button size="sm" variant="brand" onClick={() => setReceber(x)}>
                          Receber
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => salvarLancamento({ ...x, pago: true, pago_em: hoje() })}>
                          <Check className="h-3.5 w-3.5" /> Pago
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editar && <EditarLancamento lanc={editar} onClose={() => setEditar(null)} />}
      <ReceberModal lanc={receber} onClose={() => setReceber(null)} />
    </>
  );
}
