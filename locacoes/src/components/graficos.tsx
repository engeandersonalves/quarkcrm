"use client";

import { useState } from "react";
import { brl } from "@/lib/pricing";
import { cx } from "./ui";

/** Cores validadas para daltonismo: entradas (verde-azulado) × saídas (laranja). */
export const COR_ENTRADA = "#0d9488";
export const COR_SAIDA = "#ea580c";

export function Legenda() {
  return (
    <div className="flex items-center gap-4 text-[12px] text-ink-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_ENTRADA }} /> Entradas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_SAIDA }} /> Saídas
      </span>
    </div>
  );
}

/** Barras lado a lado (entradas × saídas) por dia ou por mês, com valor ao passar o dedo/mouse. */
export function BarrasEntradaSaida({ dados, altura = 200 }: { dados: { chave: string; rotulo: string; entradas: number; saidas: number }[]; altura?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...dados.map((d) => Math.max(d.entradas, d.saidas)));
  const d = sel != null ? dados[sel] : null;
  const passo = dados.length > 20 ? 5 : 1;
  return (
    <div>
      <div className="mb-2 flex min-h-11 items-end justify-between gap-3">
        {d ? (
          <div className="animate-fade-up text-[12px]">
            <p className="font-semibold text-ink-800">{d.rotulo}</p>
            <p className="tnum text-ink-600">
              Entradas <b className="text-ink-900">{brl(d.entradas)}</b> · Saídas <b className="text-ink-900">{brl(d.saidas)}</b> · Resultado{" "}
              <b className={d.entradas - d.saidas < 0 ? "text-rose-600" : "text-ink-900"}>{brl(d.entradas - d.saidas)}</b>
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-ink-400">Passe o dedo ou o mouse nas barras para ver os valores</p>
        )}
        <Legenda />
      </div>
      <div className="relative" style={{ height: altura }} onMouseLeave={() => setSel(null)}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-200/80" style={{ bottom: `${g * 100}%` }}>
            <span className="tnum absolute -top-2 right-0 bg-white pl-1 text-[9.5px] text-ink-400 print:hidden">{brl(max * g).replace(",00", "")}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[3px] pr-12">
          {dados.map((x, i) => (
            <button
              key={x.chave}
              type="button"
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setSel(i)}
              aria-label={`${x.rotulo}: entradas ${brl(x.entradas)}, saídas ${brl(x.saidas)}`}
              className={cx("flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-md", sel === i && "bg-ink-100/70")}
            >
              {(["entradas", "saidas"] as const).map((k) => (
                <span
                  key={k}
                  className="block w-full max-w-[14px] rounded-t-[4px]"
                  style={{ background: k === "entradas" ? COR_ENTRADA : COR_SAIDA, height: x[k] > 0 ? `${Math.max(2, (x[k] / max) * 100)}%` : 0, opacity: sel == null || sel === i ? 1 : 0.45 }}
                />
              ))}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t border-ink-200 pt-1.5 pr-12">
        {dados.map((x, i) => (
          <span key={x.chave} className="tnum min-w-0 flex-1 text-center text-[10px] text-ink-400">
            {i % passo === 0 || i === dados.length - 1 ? x.rotulo.split(" ")[0] : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barra horizontal simples (ranking) com rótulo e valor escritos. */
export function Ranking({ itens, formato = brl, cor = COR_ENTRADA }: { itens: { nome: string; valor: number; extra?: string }[]; formato?: (n: number) => string; cor?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) return <p className="py-3 text-sm text-ink-400">Nada no período.</p>;
  return (
    <div className="grid gap-2.5">
      {itens.map((i) => (
        <div key={i.nome}>
          <div className="flex justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-ink-700">
              {i.nome}
              {i.extra && <span className="font-normal text-ink-400"> · {i.extra}</span>}
            </span>
            <span className="tnum shrink-0 font-semibold">{formato(i.valor)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-ink-100">
            <div className="h-2 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
          </div>
        </div>
      ))}
    </div>
  );
}
