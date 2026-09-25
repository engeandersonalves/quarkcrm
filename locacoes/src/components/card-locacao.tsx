"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSignature, MapPin, PackageCheck } from "lucide-react";
import { useDados, type Conferencia } from "@/lib/store";
import { codigo, fmtDataCurta } from "@/lib/format";
import { brl, descreverModalidade } from "@/lib/pricing";
import { ALERTA_COR, alertaPrazo, progresso, saldoLocacao } from "@/lib/status";
import type { Locacao } from "@/lib/types";
import { Button, cx, Modal, MoneyInput, Stepper, Switch } from "./ui";

export const resumoItens = (l: Locacao) => l.itens.map((i) => `${i.quantidade} ${i.nome}`).join(" · ");

/** Conferência na coleta: um toque se está tudo certo; senão, marca avarias e peças faltando. */
function ConferenciaColeta({ l, onClose }: { l: Locacao; onClose: () => void }) {
  const { dados, marcarRecolhido } = useDados();
  const [itens, setItens] = useState(l.itens.map((i) => ({ equipamento_id: i.equipamento_id, avariadas: 0, perdidas: 0 })));
  const [ocorrencias, setOcorrencias] = useState(false);
  const [cobrarPerdas, setCobrarPerdas] = useState(true);
  const [valorConserto, setValorConserto] = useState(0);
  const [busy, setBusy] = useState(false);
  const reposicao = itens.reduce((s, c) => s + c.perdidas * (dados.equipamentos.find((e) => e.id === c.equipamento_id)?.valor_reposicao ?? 0), 0);
  const temProblema = itens.some((c) => c.avariadas > 0 || c.perdidas > 0);

  async function concluir(conf?: Conferencia) {
    setBusy(true);
    try {
      await marcarRecolhido(l, conf);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Conferir a coleta ${codigo(l.numero)}`}
      subtitle="Confira as quantidades e o estado das peças antes de finalizar."
      footer={
        ocorrencias ? (
          <>
            <Button variant="ghost" onClick={() => setOcorrencias(false)}>
              Voltar
            </Button>
            <Button variant="brand" loading={busy} onClick={() => concluir({ itens, cobrarPerdas, valorConserto })}>
              Finalizar coleta
            </Button>
          </>
        ) : undefined
      }
    >
      {!ocorrencias ? (
        <div className="grid gap-3">
          <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
            {l.itens.map((i) => (
              <li key={i.equipamento_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{i.nome}</span>
                <b className="tnum">
                  {i.quantidade} {i.unidade}
                </b>
              </li>
            ))}
          </ul>
          <Button variant="brand" size="lg" loading={busy} onClick={() => concluir()}>
            <CheckCircle2 className="h-5 w-5" /> Tudo certo — finalizar coleta
          </Button>
          <Button variant="secondary" onClick={() => setOcorrencias(true)}>
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Teve avaria ou faltou peça
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {l.itens.map((i, idx) => (
            <div key={i.equipamento_id} className="rounded-2xl p-3.5 ring-1 ring-ink-200">
              <p className="text-sm font-semibold">
                {i.nome} <span className="font-normal text-ink-500">· {i.quantidade} {i.unidade} na locação</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(["avariadas", "perdidas"] as const).map((k) => (
                  <div key={k}>
                    <p className="mb-1.5 text-[12.5px] font-medium text-ink-600">{k === "avariadas" ? "Com avaria (vai p/ manutenção)" : "Faltando (sai do estoque)"}</p>
                    <Stepper
                      value={itens[idx][k]}
                      max={i.quantidade - (k === "avariadas" ? itens[idx].perdidas : itens[idx].avariadas)}
                      onChange={(v) => setItens((xs) => xs.map((x, j) => (j === idx ? { ...x, [k]: v } : x)))}
                      className="w-full justify-between"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {reposicao > 0 && <Switch checked={cobrarPerdas} onChange={setCobrarPerdas} label={<>Cobrar do cliente a reposição das peças que faltaram ({brl(reposicao)})</>} />}
          {itens.some((c) => c.avariadas > 0) && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-600">Cobrar conserto das avarias (opcional)</p>
              <MoneyInput value={valorConserto} onChange={setValorConserto} />
            </div>
          )}
          {!temProblema && <p className="text-[12.5px] text-ink-500">Marque ao menos uma peça com avaria ou faltando — ou volte e finalize como “tudo certo”.</p>}
        </div>
      )}
    </Modal>
  );
}

export function ProximaAcao({ l, size = "sm", className }: { l: Locacao; size?: "sm" | "md"; className?: string }) {
  const { aprovar, marcarEntregue } = useDados();
  const [busy, setBusy] = useState(false);
  const [conferir, setConferir] = useState(false);
  const cfg = {
    orcamento: { label: "Aprovar", fn: aprovar, v: "brand" as const },
    agendada: { label: "Marcar entregue", fn: marcarEntregue, v: "primary" as const },
    na_obra: { label: "Marcar recolhido", fn: async () => setConferir(true), v: "primary" as const },
  }[l.status as "orcamento" | "agendada" | "na_obra"];
  if (!cfg) return null;
  return (
    <>
    {conferir && (
      // O card inteiro é clicável: impede que cliques na janela abram a locação.
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <ConferenciaColeta l={l} onClose={() => setConferir(false)} />
      </div>
    )}
    <Button
      size={size}
      variant={cfg.v}
      loading={busy}
      className={className}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          await cfg.fn(l);
        } finally {
          setBusy(false);
        }
      }}
    >
      {l.status === "na_obra" ? <PackageCheck className="h-4 w-4" /> : null}
      {cfg.label} <ArrowRight className="h-3.5 w-3.5" />
    </Button>
    </>
  );
}

export function CardLocacao({ l }: { l: Locacao }) {
  const { dados } = useDados();
  const router = useRouter();
  const abrir = () => router.push(`/locacoes/${l.id}`);
  const alerta = alertaPrazo(l);
  const prog = progresso(l);
  const saldo = l.status === "orcamento" ? null : saldoLocacao(l, dados.lancamentos);
  const lugar = [l.endereco.bairro, l.endereco.cidade].filter(Boolean).join(", ") || l.endereco.logradouro;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && abrir()}
      className="group block cursor-pointer rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70 transition hover:-translate-y-0.5 hover:shadow-lift hover:ring-ink-300"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-ink-400">{codigo(l.numero)}</span>
        <span className="flex items-center gap-1">
          {l.assinado_em && (
            <span title="Termo assinado" className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-brand-700">
              <FileSignature className="h-3 w-3" />
            </span>
          )}
          {alerta && <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-bold", ALERTA_COR[alerta.tipo])}>{alerta.texto}</span>}
        </span>
      </div>
      <p className="mt-1 truncate font-semibold text-ink-950">{l.cliente_nome || "Cliente sem nome"}</p>
      {lugar && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ink-500">
          <MapPin className="h-3 w-3 shrink-0" /> {lugar}
        </p>
      )}
      <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-600">{resumoItens(l)}</p>

      {l.status === "na_obra" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className={cx("h-full rounded-full", prog >= 1 ? "bg-rose-500" : prog > 0.8 ? "bg-amber-400" : "bg-brand-500")} style={{ width: `${Math.max(4, prog * 100)}%` }} />
        </div>
      )}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-[11.5px] text-ink-500">
          <p>{descreverModalidade(l.modalidade, l.quantidade_periodos)}</p>
          <p>
            {l.status === "na_obra" ? "Coleta " : l.status === "finalizada" ? "Recolhido " : "Entrega "}
            <b className="text-ink-700">{fmtDataCurta(l.status === "na_obra" ? l.data_coleta : l.status === "finalizada" ? (l.recolhido_em ?? l.data_coleta).slice(0, 10) : l.data_entrega)}</b>
          </p>
        </div>
        <div className="text-right">
          <p className="tnum font-display text-[15px] font-bold text-ink-950">{brl(l.valor_total)}</p>
          {saldo && saldo.aberto > 0.009 && <p className="tnum text-[11px] font-semibold text-amber-700">a receber {brl(saldo.aberto)}</p>}
          {saldo && saldo.cobrado > 0 && saldo.aberto <= 0.009 && <p className="text-[11px] font-semibold text-brand-700">✓ pago</p>}
        </div>
      </div>
      {["orcamento", "agendada", "na_obra"].includes(l.status) && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <ProximaAcao l={l} className="w-full" />
        </div>
      )}
    </div>
  );
}
