"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, ExternalLink, MapPin, Navigation, PackageCheck, Route, Truck } from "lucide-react";
import { ProximaAcao, resumoItens } from "@/components/card-locacao";
import { Button, Card, cx, Empty, PageHeader, Segmented } from "@/components/ui";
import { useDados } from "@/lib/store";
import { addDias, diffDias, fmtDataCurta, hoje, linhaEndereco, linkMaps, linkWaze, linkWhatsApp, temEndereco } from "@/lib/format";
import { mensagemEntregador } from "@/lib/mensagens";
import type { Locacao } from "@/lib/types";

interface Tarefa {
  l: Locacao;
  tipo: "entrega" | "coleta";
  data: string;
}

function destino(l: Locacao) {
  const e = l.endereco;
  const coords = e.maps_url.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (coords) return `${coords[1]},${coords[2]}`;
  return [e.logradouro, e.numero, e.bairro, e.cidade, e.uf].filter(Boolean).join(", ");
}

/** Rota no Google Maps passando por todas as paradas do dia. */
function linkRota(ts: Tarefa[]) {
  const pontos = ts.filter((t) => temEndereco(t.l.endereco)).map((t) => destino(t.l));
  if (pontos.length === 0) return null;
  const dest = pontos[pontos.length - 1];
  const way = pontos.slice(0, -1).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${way ? `&waypoints=${encodeURIComponent(way)}` : ""}&travelmode=driving`;
}

function mensagemRota(ts: Tarefa[], titulo: string) {
  const partes = ts.map((t, i) => `*${i + 1}.* ${mensagemEntregador(t.l, t.tipo)}`);
  const rota = linkRota(ts);
  return [`🗓️ *Rota — ${titulo}* (${ts.length} ${ts.length === 1 ? "parada" : "paradas"})`, "", partes.join("\n\n———\n\n"), rota ? `\n🧭 Rota completa: ${rota}` : ""].join("\n");
}

function LinhaTarefa({ t }: { t: Tarefa }) {
  const { l, tipo } = t;
  const atraso = diffDias(t.data, hoje());
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className={cx("hidden h-11 w-11 shrink-0 place-items-center rounded-2xl sm:grid", tipo === "entrega" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>
        {tipo === "entrega" ? <Truck className="h-5 w-5" /> : <PackageCheck className="h-5 w-5" />}
      </div>
      <Link href={`/locacoes/${l.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase", tipo === "entrega" ? "bg-sky-600 text-white" : "bg-amber-400 text-ink-950")}>{tipo}</span>
          <span className="font-mono text-[11px] text-ink-400">#{l.numero}</span>
          {atraso > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10.5px] font-bold text-white">{atraso}d de atraso</span>}
        </div>
        <p className="mt-1 font-semibold text-ink-950">{l.cliente_nome}</p>
        <p className="flex items-start gap-1 text-[13px] text-ink-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {linhaEndereco(l.endereco) || "Sem endereço"}
            {l.endereco.referencia && <span className="text-ink-400"> · {l.endereco.referencia}</span>}
          </span>
        </p>
        <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-500">{resumoItens(l)}</p>
      </Link>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <a href={linkMaps(l.endereco)} target="_blank" rel="noreferrer" title="Google Maps">
          <Button variant="secondary" size="icon" disabled={!temEndereco(l.endereco)}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
        <a href={linkWaze(l.endereco)} target="_blank" rel="noreferrer" title="Waze">
          <Button variant="secondary" size="icon" disabled={!temEndereco(l.endereco)}>
            <Navigation className="h-4 w-4" />
          </Button>
        </a>
        <a href={linkWhatsApp("", mensagemEntregador(l, tipo))} target="_blank" rel="noreferrer" title="Enviar ao entregador">
          <Button variant="secondary" size="icon">
            <Truck className="h-4 w-4" />
          </Button>
        </a>
        <ProximaAcao l={l} size="md" className="flex-1 sm:flex-none" />
      </div>
    </div>
  );
}

export default function Agenda() {
  const { dados } = useDados();
  const [filtro, setFiltro] = useState<"todas" | "entrega" | "coleta">("todas");

  const grupos = useMemo(() => {
    const h = hoje();
    const tarefas: Tarefa[] = [];
    for (const l of dados.locacoes) {
      if (l.status === "agendada" && l.data_entrega) tarefas.push({ l, tipo: "entrega", data: l.data_entrega });
      if (l.status === "na_obra" && l.data_coleta) tarefas.push({ l, tipo: "coleta", data: l.data_coleta });
    }
    const f = tarefas.filter((t) => filtro === "todas" || t.tipo === filtro).sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
    const amanha = addDias(h, 1);
    return [
      { id: "atrasadas", titulo: "Atrasadas", cor: "text-rose-600", itens: f.filter((t) => t.data < h) },
      { id: "hoje", titulo: `Hoje · ${fmtDataCurta(h)}`, cor: "text-ink-950", itens: f.filter((t) => t.data === h) },
      { id: "amanha", titulo: `Amanhã · ${fmtDataCurta(amanha)}`, cor: "text-ink-950", itens: f.filter((t) => t.data === amanha) },
      { id: "semana", titulo: "Próximos 7 dias", cor: "text-ink-600", itens: f.filter((t) => t.data > amanha && diffDias(h, t.data) <= 7) },
      { id: "depois", titulo: "Mais adiante", cor: "text-ink-500", itens: f.filter((t) => diffDias(h, t.data) > 7) },
    ];
  }, [dados.locacoes, filtro]);

  const deHoje = [...grupos[0].itens, ...grupos[1].itens];
  const rota = linkRota(deHoje);
  const vazia = grupos.every((g) => g.itens.length === 0);

  return (
    <>
      <PageHeader
        title="Agenda de entregas e coletas"
        subtitle="O roteiro do entregador — com mapa, referência e itens."
        actions={
          <>
            <Segmented
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: "todas", label: "Todas" },
                { value: "entrega", label: "Entregas" },
                { value: "coleta", label: "Coletas" },
              ]}
            />
            {deHoje.length > 0 && (
              <>
                {rota && (
                  <a href={rota} target="_blank" rel="noreferrer">
                    <Button variant="secondary">
                      <Route className="h-4 w-4" /> Rota de hoje
                    </Button>
                  </a>
                )}
                <a href={linkWhatsApp("", mensagemRota(deHoje, `hoje, ${fmtDataCurta(hoje())}`))} target="_blank" rel="noreferrer">
                  <Button variant="brand">
                    <Truck className="h-4 w-4" /> Enviar rota ao entregador
                  </Button>
                </a>
              </>
            )}
          </>
        }
      />

      {vazia ? (
        <Card>
          <Empty icon={<CalendarCheck className="h-6 w-6" />} title="Agenda livre" text="Quando um orçamento for aprovado, a entrega aparece aqui. Depois de entregue, a coleta entra automaticamente na data de vencimento." />
        </Card>
      ) : (
        <div className="grid gap-6">
          {grupos
            .filter((g) => g.itens.length > 0)
            .map((g) => (
              <section key={g.id}>
                <h2 className={cx("mb-2.5 flex items-center gap-2 px-1 font-display text-[15px] font-semibold", g.cor)}>
                  {g.titulo}
                  <span className="tnum rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink-600 ring-1 ring-ink-200">{g.itens.length}</span>
                </h2>
                <Card className={cx("divide-y divide-ink-100 overflow-hidden", g.id === "atrasadas" && "ring-rose-200")}>
                  {g.itens.map((t) => (
                    <div key={`${t.l.id}-${t.tipo}`}>
                      {g.id === "semana" || g.id === "depois" ? <p className="px-4 pt-3 text-[11.5px] font-semibold text-ink-400 uppercase">{fmtDataCurta(t.data)}</p> : null}
                      <LinhaTarefa t={t} />
                    </div>
                  ))}
                </Card>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
