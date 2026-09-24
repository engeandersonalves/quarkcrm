"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { useDados } from "@/lib/store";
import { fmtDataCurta } from "@/lib/format";
import { brl, descreverModalidade } from "@/lib/pricing";
import { ALERTA_COR, alertaPrazo, progresso, saldoLocacao } from "@/lib/status";
import type { Locacao } from "@/lib/types";
import { Button, cx } from "./ui";

export const resumoItens = (l: Locacao) => l.itens.map((i) => `${i.quantidade} ${i.nome}`).join(" · ");

export function ProximaAcao({ l, size = "sm", className }: { l: Locacao; size?: "sm" | "md"; className?: string }) {
  const { aprovar, marcarEntregue, marcarRecolhido } = useDados();
  const [busy, setBusy] = useState(false);
  const cfg = {
    orcamento: { label: "Aprovar", fn: aprovar, v: "brand" as const },
    agendada: { label: "Marcar entregue", fn: marcarEntregue, v: "primary" as const },
    na_obra: { label: "Marcar recolhido", fn: marcarRecolhido, v: "primary" as const },
  }[l.status as "orcamento" | "agendada" | "na_obra"];
  if (!cfg) return null;
  return (
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
      {cfg.label} <ArrowRight className="h-3.5 w-3.5" />
    </Button>
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
        <span className="font-mono text-[11px] font-semibold text-ink-400">#{String(l.numero).padStart(4, "0")}</span>
        {alerta && <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-bold", ALERTA_COR[alerta.tipo])}>{alerta.texto}</span>}
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
            {l.status === "na_obra" ? "Coleta " : "Entrega "}
            <b className="text-ink-700">{fmtDataCurta(l.status === "na_obra" || l.status === "finalizada" ? l.data_coleta : l.data_entrega)}</b>
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
