"use client";

import { confirmar } from "@/components/dialogo";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAbrirItem } from "@/lib/abrir";
import { toast } from "sonner";
import { Boxes, ChevronDown, Package, PackageOpen, Pencil, Plus, Search, Wand2, Wrench } from "lucide-react";
import { Badge, Button, Card, cx, Empty, Field, Input, Modal, MoneyInput, NumberInput, PageHeader, Stat, Switch, Textarea } from "@/components/ui";
import { useDados, type SaldoEstoque } from "@/lib/store";
import { fmtDataCurta, fmtNum, normalizar, pct } from "@/lib/format";
import { novoEquipamento } from "@/lib/novo";
import { brl, PERIODOS, sugerirPrecos } from "@/lib/pricing";
import { STATUS } from "@/lib/status";
import type { Equipamento } from "@/lib/types";

const SEG = [
  { k: "naObra" as const, nome: "Na obra", cor: "bg-emerald-500" },
  { k: "reservado" as const, nome: "A entregar", cor: "bg-sky-500" },
  { k: "manutencao" as const, nome: "Manutenção", cor: "bg-amber-400" },
  { k: "disponivel" as const, nome: "Disponível", cor: "bg-ink-200" },
];

function Barra({ s }: { s: SaldoEstoque }) {
  const total = Math.max(1, s.total);
  return (
    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-ink-100" role="img" aria-label={SEG.map((x) => `${x.nome}: ${s[x.k]}`).join(", ")}>
      {SEG.map((x) => {
        const v = Math.max(0, s[x.k]);
        return v > 0 ? <div key={x.k} className={cx("h-full first:rounded-l-full last:rounded-r-full", x.cor)} style={{ width: `${(v / total) * 100}%` }} title={`${x.nome}: ${v}`} /> : null;
      })}
    </div>
  );
}

function EditarEquipamento({ eq, onClose }: { eq: Equipamento; onClose: () => void }) {
  const { dados, salvarEquipamento, excluirEquipamento } = useDados();
  const [e, setE] = useState(eq);
  const [busy, setBusy] = useState(false);
  const cfg = dados.config;
  const set = (p: Partial<Equipamento>) => setE((x) => ({ ...x, ...p }));
  const emUso = dados.locacoes.some((l) => (l.status === "agendada" || l.status === "na_obra") && l.itens.some((i) => i.equipamento_id === e.id));
  const existe = dados.equipamentos.some((x) => x.id === e.id);

  function calcular(mensal = e.preco_mensal) {
    const p = sugerirPrecos(mensal, cfg);
    set({ preco_mensal: mensal, preco_diaria: p.diaria, preco_semanal: p.semanal, preco_quinzenal: p.quinzenal });
  }

  async function salvar() {
    if (!e.nome.trim()) return toast.error("Dê um nome ao equipamento");
    setBusy(true);
    try {
      await salvarEquipamento({ ...e, nome: e.nome.trim() });
      toast.success("Equipamento salvo");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const campos: { k: keyof Equipamento; p: (typeof PERIODOS)[number] }[] = [
    { k: "preco_diaria", p: PERIODOS[0] },
    { k: "preco_semanal", p: PERIODOS[1] },
    { k: "preco_quinzenal", p: PERIODOS[2] },
    { k: "preco_mensal", p: PERIODOS[3] },
  ];

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={existe ? "Editar equipamento" : "Novo equipamento"}
      footer={
        <>
          {existe && (
            <Button
              variant="ghost"
              className="mr-auto text-rose-600 hover:bg-rose-50"
              disabled={emUso}
              title={emUso ? "Está em uma locação ativa" : undefined}
              onClick={async () => {
                if (!(await confirmar({ titulo: `Excluir “${e.nome}”?`, texto: "Dica: para só esconder dos orçamentos sem perder o histórico, desligue “Disponível para orçamento”.", ok: "Excluir", perigo: true }))) return;
                await excluirEquipamento(e.id);
                onClose();
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="brand" loading={busy} onClick={salvar}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Nome" className="sm:col-span-4">
          <Input autoFocus value={e.nome} onChange={(x) => set({ nome: x.target.value })} placeholder="Ex.: Escora metálica 3 m" />
        </Field>
        <Field label="Unidade" className="sm:col-span-2">
          <Input value={e.unidade} onChange={(x) => set({ unidade: x.target.value })} placeholder="peça, un, m…" />
        </Field>
        <Field label="Categoria" className="sm:col-span-2">
          <Input list="categorias" value={e.categoria} onChange={(x) => set({ categoria: x.target.value })} />
          <datalist id="categorias">
            {[...new Set(["Andaimes", "Escoras", "Máquinas", "Ferramentas", ...dados.equipamentos.map((x) => x.categoria)])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Quantidade total" className="sm:col-span-2">
          <NumberInput digits={0} value={e.estoque_total} onChange={(v) => set({ estoque_total: Math.max(0, Math.round(v)) })} />
        </Field>
        <Field label="Em manutenção" className="sm:col-span-2">
          <NumberInput digits={0} value={e.em_manutencao} onChange={(v) => set({ em_manutencao: Math.max(0, Math.round(v)) })} />
        </Field>

        <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200 sm:col-span-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink-700">Preços por unidade</p>
            <Button size="sm" variant="secondary" onClick={() => calcular()} disabled={!e.preco_mensal}>
              <Wand2 className="h-3.5 w-3.5" /> Calcular pelo mensal
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {campos.map(({ k, p }) => (
              <Field key={k} label={p.nome} hint={(e[k] as number) > 0 ? `${brl((e[k] as number) / p.dias)}/dia` : undefined}>
                <MoneyInput value={e[k] as number} onChange={(v) => set({ [k]: v } as Partial<Equipamento>)} />
              </Field>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-500">
            Preencha o mensal e toque em “Calcular” — a diária fica {pct(cfg.fator_diaria)}, a semana {pct(cfg.fator_semanal)} e a quinzena {pct(cfg.fator_quinzenal)} do mês (ajuste em Ajustes).
          </p>
        </div>

        <Field label="Valor de reposição (se perder/quebrar)" className="sm:col-span-3">
          <MoneyInput value={e.valor_reposicao} onChange={(v) => set({ valor_reposicao: v })} />
        </Field>
        <div className="flex items-end pb-2 sm:col-span-3">
          <Switch checked={e.ativo} onChange={(v) => set({ ativo: v })} label="Disponível para orçamento" />
        </div>
        <Field label="Observações" className="sm:col-span-6">
          <Textarea className="min-h-[60px]" value={e.observacoes} onChange={(x) => set({ observacoes: x.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Estoque() {
  const { dados, estoque, carregando, carregarCatalogo } = useDados();
  const [editando, setEditando] = useState<Equipamento | null>(null);
  useAbrirItem(
    useCallback(
      (id: string) => {
        const e = dados.equipamentos.find((x) => x.id === id);
        if (e) setEditando(e);
        return Boolean(e);
      },
      [dados.equipamentos],
    ),
  );
  const [aberto, setAberto] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const lista = useMemo(() => {
    const t = normalizar(q);
    return [...dados.equipamentos].filter((e) => !t || normalizar(`${e.nome} ${e.categoria}`).includes(t)).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
  }, [dados.equipamentos, q]);

  const tot = useMemo(() => {
    const t = { total: 0, naObra: 0, reservado: 0, manutencao: 0, disponivel: 0, potencial: 0, rendendo: 0 };
    for (const e of dados.equipamentos) {
      const s = estoque[e.id];
      if (!s) continue;
      t.total += s.total;
      t.naObra += s.naObra;
      t.reservado += s.reservado;
      t.manutencao += s.manutencao;
      t.disponivel += Math.max(0, s.disponivel);
      t.potencial += s.total * e.preco_mensal;
      t.rendendo += (s.naObra + s.reservado) * e.preco_mensal;
    }
    return t;
  }, [dados.equipamentos, estoque]);

  const ocupacao = tot.total - tot.manutencao > 0 ? (tot.naObra + tot.reservado) / (tot.total - tot.manutencao) : 0;
  const categorias = [...new Set(lista.map((e) => e.categoria))];

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Quanto tem, onde está e quanto está rendendo."
        actions={
          <>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipamento" className="pl-9" />
            </div>
            <Button variant="brand" onClick={() => setEditando(novoEquipamento())}>
              <Plus className="h-4 w-4" /> Equipamento
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Peças no total" value={fmtNum(tot.total)} hint={`${fmtNum(tot.manutencao)} em manutenção`} icon={<Boxes className="h-4 w-4" />} />
        <Stat label="Na obra / a entregar" value={fmtNum(tot.naObra + tot.reservado)} hint={`${fmtNum(tot.naObra)} na obra · ${fmtNum(tot.reservado)} a entregar`} icon={<PackageOpen className="h-4 w-4" />} tone="good" />
        <Stat label="Disponível no galpão" value={fmtNum(tot.disponivel)} icon={<Package className="h-4 w-4" />} />
        <Stat label="Ocupação" value={pct(ocupacao)} hint={`Rendendo ${brl(tot.rendendo)}/mês de ${brl(tot.potencial)} possíveis`} icon={<Wrench className="h-4 w-4" />} tone={ocupacao > 0.85 ? "warn" : "default"} />
      </div>

      {!carregando && dados.equipamentos.length === 0 ? (
        <Card>
          <Empty
            icon={<Boxes className="h-6 w-6" />}
            title="Nenhum equipamento cadastrado"
            text="Comece com os itens do seu termo de locação (andaime 1,5 m, plataforma 1,5 m e betoneira 400 L) e ajuste as quantidades."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="brand"
                  onClick={async () => {
                    await carregarCatalogo();
                    toast.success("Catálogo carregado — confira as quantidades");
                  }}
                >
                  Carregar catálogo do termo
                </Button>
                <Button variant="secondary" onClick={() => setEditando(novoEquipamento())}>
                  Cadastrar do zero
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-ink-500">
            {SEG.map((s) => (
              <span key={s.k} className="inline-flex items-center gap-1.5">
                <span className={cx("h-2.5 w-2.5 rounded-sm", s.cor)} /> {s.nome}
              </span>
            ))}
          </div>
          {categorias.map((cat) => (
            <section key={cat}>
              <h2 className="mb-2.5 px-1 text-[12px] font-bold tracking-[0.14em] text-ink-400 uppercase">{cat}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {lista
                  .filter((e) => e.categoria === cat)
                  .map((e) => {
                    const s = estoque[e.id];
                    if (!s) return null;
                    const onde = dados.locacoes.filter((l) => (l.status === "na_obra" || l.status === "agendada") && l.itens.some((i) => i.equipamento_id === e.id));
                    const expandido = aberto === e.id;
                    return (
                      <Card key={e.id} className={cx("p-4 sm:p-5", !e.ativo && "opacity-60")}>
                        <div className="flex items-start gap-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-300">
                            <Package className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-ink-950">{e.nome}</p>
                              {!e.ativo && <Badge className="bg-ink-100 text-ink-500 ring-ink-200">inativo</Badge>}
                            </div>
                            <p className="tnum text-[12.5px] text-ink-500">
                              {brl(e.preco_diaria)}/dia · {brl(e.preco_semanal)}/sem · {brl(e.preco_quinzenal)}/15d · <b className="text-ink-700">{brl(e.preco_mensal)}/mês</b>
                            </p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => setEditando(e)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <p className={cx("tnum font-display text-3xl leading-none font-bold", s.disponivel < 0 ? "text-rose-600" : "text-ink-950")}>{fmtNum(s.disponivel)}</p>
                            <p className="mt-1 text-[12px] text-ink-500">
                              disponíveis de {fmtNum(s.total)} {e.unidade}
                            </p>
                          </div>
                          <div className="tnum text-right text-[12px] leading-5 text-ink-500">
                            <p>
                              <b className="text-ink-800">{s.naObra}</b> na obra · <b className="text-ink-800">{s.reservado}</b> a entregar
                            </p>
                            <p>
                              <b className="text-ink-800">{s.manutencao}</b> manutenção{s.emOrcamento > 0 && <> · {s.emOrcamento} em orçamentos</>}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Barra s={s} />
                        </div>
                        {s.disponivel < 0 && <p className="mt-2 text-[12px] font-semibold text-rose-600">Atenção: há mais peças comprometidas do que o estoque cadastrado.</p>}

                        {onde.length > 0 && (
                          <>
                            <button onClick={() => setAberto(expandido ? null : e.id)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-[12.5px] font-semibold text-ink-600 hover:bg-ink-100">
                              Onde estão? ({onde.length} {onde.length === 1 ? "obra" : "obras"})
                              <ChevronDown className={cx("h-4 w-4 transition", expandido && "rotate-180")} />
                            </button>
                            {expandido && (
                              <ul className="mt-2 divide-y divide-ink-100 text-[13px]">
                                {onde.map((l) => (
                                  <li key={l.id}>
                                    <Link href={`/locacoes/${l.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-brand-700">
                                      <span className="min-w-0 truncate">
                                        <span className={cx("mr-1.5 inline-block h-2 w-2 rounded-full", STATUS[l.status].ponto)} />
                                        {l.cliente_nome} <span className="text-ink-400">· {l.endereco.bairro}</span>
                                      </span>
                                      <span className="tnum shrink-0 text-ink-500">
                                        {l.itens.find((i) => i.equipamento_id === e.id)?.quantidade} · {l.status === "na_obra" ? `volta ${fmtDataCurta(l.data_coleta)}` : `sai ${fmtDataCurta(l.data_entrega)}`}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </Card>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}

      {editando && <EditarEquipamento eq={editando} onClose={() => setEditando(null)} />}
    </>
  );
}
