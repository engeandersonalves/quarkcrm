"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, KanbanSquare, List, Plus, Search } from "lucide-react";
import { CardLocacao, resumoItens } from "@/components/card-locacao";
import { Badge, Button, Card, cx, Empty, Input, PageHeader, Segmented } from "@/components/ui";
import { useDados } from "@/lib/store";
import { diffDias, fmtDataCurta, hoje, normalizar } from "@/lib/format";
import { brl } from "@/lib/pricing";
import { ALERTA_COR, alertaPrazo, STATUS } from "@/lib/status";
import type { Locacao, StatusLocacao } from "@/lib/types";

const COLUNAS: { status: StatusLocacao; dica: string }[] = [
  { status: "orcamento", dica: "Esperando o sim do cliente" },
  { status: "agendada", dica: "Aprovado — separar e entregar" },
  { status: "na_obra", dica: "Entregue, contando o prazo" },
  { status: "finalizada", dica: "Recolhido — últimos 30 dias" },
];

function ordenar(ls: Locacao[], s: StatusLocacao) {
  const chave = (l: Locacao) => (s === "agendada" ? l.data_entrega : s === "na_obra" ? l.data_coleta : "");
  if (s === "agendada" || s === "na_obra") return [...ls].sort((a, b) => chave(a).localeCompare(chave(b)));
  return [...ls].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
}

export default function Locacoes() {
  const { dados, carregando } = useDados();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [vista, setVista] = useState<"quadro" | "lista">("quadro");
  const [colMobile, setColMobile] = useState<StatusLocacao>("na_obra");
  const [filtroLista, setFiltroLista] = useState<StatusLocacao | "todas">("todas");

  const filtradas = useMemo(() => {
    const t = normalizar(q);
    if (!t) return dados.locacoes;
    return dados.locacoes.filter((l) =>
      normalizar(`${l.numero} ${l.cliente_nome} ${l.cliente_telefone} ${l.endereco.bairro} ${l.endereco.logradouro} ${resumoItens(l)}`).includes(t),
    );
  }, [dados.locacoes, q]);

  const porStatus = useMemo(() => {
    const h = hoje();
    const out = {} as Record<StatusLocacao, Locacao[]>;
    for (const c of [...COLUNAS.map((c) => c.status), "recusada" as const]) out[c] = [];
    for (const l of filtradas) {
      if (l.status === "finalizada" && !q && l.recolhido_em && diffDias(l.recolhido_em.slice(0, 10), h) > 30) continue;
      out[l.status]?.push(l);
    }
    return out;
  }, [filtradas, q]);

  const lista = filtroLista === "todas" ? filtradas : filtradas.filter((l) => l.status === filtroLista);

  return (
    <>
      <PageHeader
        title="Locações"
        subtitle="Do orçamento à coleta — tudo em um quadro."
        actions={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, bairro, nº…" className="pl-9" />
            </div>
            <Segmented
              value={vista}
              onChange={setVista}
              options={[
                { value: "quadro", label: <KanbanSquare className="h-4 w-4" /> },
                { value: "lista", label: <List className="h-4 w-4" /> },
              ]}
            />
            <Link href="/">
              <Button variant="brand">
                <Plus className="h-4 w-4" /> Orçamento
              </Button>
            </Link>
          </>
        }
      />

      {!carregando && dados.locacoes.length === 0 ? (
        <Card>
          <Empty
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhuma locação ainda"
            text="Faça um orçamento na tela inicial. Quando o cliente aprovar, ele aparece aqui."
            action={
              <Link href="/">
                <Button variant="brand">Fazer orçamento</Button>
              </Link>
            }
          />
        </Card>
      ) : vista === "quadro" ? (
        <>
          {/* Celular: uma coluna por vez */}
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none lg:hidden">
            {COLUNAS.map((c) => (
              <button
                key={c.status}
                onClick={() => setColMobile(c.status)}
                className={cx(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold ring-1 transition",
                  colMobile === c.status ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200",
                )}
              >
                <span className={cx("h-2 w-2 rounded-full", STATUS[c.status].ponto)} />
                {STATUS[c.status].curto}
                <span className="tnum opacity-60">{porStatus[c.status].length}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {COLUNAS.map((c) => (
              <section key={c.status} className={cx("min-w-0 rounded-3xl bg-ink-100/70 p-2.5 ring-1 ring-ink-200/60", colMobile !== c.status && "hidden lg:block")}>
                <header className="flex items-center justify-between px-2 pt-1.5 pb-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold">
                      <span className={cx("h-2 w-2 rounded-full", STATUS[c.status].ponto)} />
                      {STATUS[c.status].nome}
                    </h2>
                    <p className="text-[11.5px] text-ink-500">{c.dica}</p>
                  </div>
                  <span className="tnum rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-ink-700 ring-1 ring-ink-200">{porStatus[c.status].length}</span>
                </header>
                <div className="grid grid-cols-1 gap-2.5">
                  {ordenar(porStatus[c.status], c.status).map((l) => (
                    <CardLocacao key={l.id} l={l} />
                  ))}
                  {porStatus[c.status].length === 0 && <p className="rounded-2xl border border-dashed border-ink-300 px-3 py-8 text-center text-[12.5px] text-ink-400">Nada por aqui</p>}
                </div>
              </section>
            ))}
          </div>
          {porStatus.recusada.length > 0 && (
            <p className="mt-4 text-center text-[12.5px] text-ink-500">
              {porStatus.recusada.length} orçamento(s) recusado(s) —{" "}
              <button
                className="font-semibold underline"
                onClick={() => {
                  setVista("lista");
                  setFiltroLista("recusada");
                }}
              >
                ver na lista
              </button>
            </p>
          )}
        </>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex gap-2 overflow-x-auto border-b border-ink-100 p-3 scrollbar-none">
            {(["todas", "orcamento", "agendada", "na_obra", "finalizada", "recusada"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFiltroLista(s)}
                className={cx("h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold", filtroLista === s ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200")}
              >
                {s === "todas" ? "Todas" : STATUS[s].nome}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-ink-50 text-left text-[11.5px] font-semibold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Coleta</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[...lista]
                  .sort((a, b) => b.numero - a.numero)
                  .map((l) => {
                    const a = alertaPrazo(l);
                    return (
                      <tr key={l.id} className="cursor-pointer hover:bg-ink-50" onClick={() => router.push(`/locacoes/${l.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs text-ink-500">#{l.numero}</td>
                        <td className="px-4 py-3 font-semibold">{l.cliente_nome || "—"}</td>
                        <td className="px-4 py-3 text-ink-600">{l.endereco.bairro || l.endereco.logradouro || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge className={STATUS[l.status].cor} dot={STATUS[l.status].ponto}>
                              {STATUS[l.status].curto}
                            </Badge>
                            {a && <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", ALERTA_COR[a.tipo])}>{a.texto}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-600">{fmtDataCurta(l.data_entrega)}</td>
                        <td className="px-4 py-3 text-ink-600">{fmtDataCurta(l.data_coleta)}</td>
                        <td className="tnum px-4 py-3 text-right font-semibold">{brl(l.valor_total)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {lista.length === 0 && <p className="py-10 text-center text-sm text-ink-500">Nenhuma locação neste filtro.</p>}
          </div>
        </Card>
      )}
    </>
  );
}
