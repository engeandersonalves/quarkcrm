"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui";
import { LOAD_LABEL } from "@/lib/sim/loads";
import { TECHS } from "@/lib/sim/storage";
import type { SimResult } from "@/lib/sim/types";
import { brl0, kwh, n0, n1, n2, pct, Stat } from "./common";

export function KpiGrid({ r }: { r: SimResult }) {
  const k = r.kpis;
  const hasEvents = k.eventCurtailAvailKWh > 0.01;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      <Stat label="Solar disponível" value={kwh(k.pvAvailKWh)} sub={`${n0(k.specificYield)} kWh/kWp · PR ${pct(k.performanceRatio)}`} />
      <Stat
        label="Solar desperdiçada"
        value={pct(k.curtailedPct, 1)}
        tone={k.curtailedPct > 0.1 ? "bad" : k.curtailedPct > 0.02 ? "warn" : "good"}
        sub={`${kwh(k.curtailedKWh)} cortados`}
      />
      <Stat label="Autossuficiência" value={pct(k.selfSufficiency)} tone={k.selfSufficiency > 0.7 ? "good" : undefined} sub="consumo atendido sem rede/gerador" />
      <Stat label="Autoconsumo" value={pct(k.selfConsumption)} sub="da solar usada no local" />
      {hasEvents && (
        <Stat
          label="Salvo durante cortes"
          value={pct(k.eventRecoveredKWh / Math.max(k.eventCurtailAvailKWh, 1e-9))}
          tone={k.eventRecoveredKWh / k.eventCurtailAvailKWh > 0.5 ? "good" : "warn"}
          sub={`${kwh(k.eventRecoveredKWh)} de ${kwh(k.eventCurtailAvailKWh)} que seriam perdidos`}
        />
      )}
      <Stat label="Rede: compra / injeção" value={`${n0(k.importKWh)} / ${n0(k.exportKWh)}`} sub={`kWh · pico de compra ${n1(k.peakImportKW)} kW`} />
      <Stat
        label="Consumo não atendido"
        value={kwh(k.unservedKWh)}
        tone={k.unservedKWh > 0.05 ? "bad" : "good"}
        sub={k.lossOfLoadHours > 0 ? `${n1(k.lossOfLoadHours)} h com falta de energia` : "nenhuma falta"}
      />
      <Stat label="Economia anualizada" value={brl0(k.savingsYear)} tone={k.savingsYear > 0 ? "good" : "bad"} sub={`conta sem sistema ${brl0(k.costBaseline)} → com ${brl0(k.costWith)} no período`} />
      {k.genKWh > 0 && <Stat label="Gerador" value={kwh(k.genKWh)} sub={`${n0(k.fuelL)} L de combustível`} />}
      {k.waterM3 > 0 && <Stat label="Água bombeada" value={`${n1(k.waterM3)} m³`} sub="caixa-d'água como bateria hídrica" />}
      <Stat label="CO₂ evitado" value={`${n0(k.co2AvoidedKg)} kg`} sub={`fator da rede ${n2(r.scenario.tariff.co2)} kg/kWh`} />
    </div>
  );
}

export function Warnings({ r }: { r: SimResult }) {
  if (!r.warnings.length) return null;
  return (
    <div className="rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
      {r.warnings.map((w) => (
        <div key={w} className="flex items-start gap-2 text-[12.5px] leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {w}
        </div>
      ))}
    </div>
  );
}

export function StorageTable({ r }: { r: SimResult }) {
  if (!r.kpis.storage.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70">
      <div className="px-4 pt-4 pb-2 text-[14px] font-bold text-ink-900">Desempenho do armazenamento</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-b border-ink-100 text-left text-[11px] font-semibold text-ink-500">
              <th className="px-4 py-2">Unidade</th>
              <th className="px-2 py-2 text-right">Carregado</th>
              <th className="px-2 py-2 text-right">Entregue</th>
              <th className="px-2 py-2 text-right">Perdas</th>
              <th className="px-2 py-2 text-right">Ida e volta</th>
              <th className="px-2 py-2 text-right">Ciclos</th>
              <th className="px-2 py-2 text-right">Vida estimada</th>
              <th className="px-4 py-2 text-right">LCOS</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {r.kpis.storage.map((s) => (
              <tr key={s.id} className="border-b border-ink-50 last:border-0">
                <td className="px-4 py-2 font-semibold text-ink-800">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: TECHS[s.tech].color }} />
                  {s.name}
                </td>
                <td className="px-2 py-2 text-right">{kwh(s.chargedKWh)}</td>
                <td className="px-2 py-2 text-right">{kwh(s.dischargedKWh)}</td>
                <td className="px-2 py-2 text-right">{kwh(s.lossesKWh)}</td>
                <td className="px-2 py-2 text-right">{s.chargedKWh > 0.01 ? pct(s.roundTrip) : "—"}</td>
                <td className="px-2 py-2 text-right">{n1(s.cycles)}</td>
                <td className="px-2 py-2 text-right">{s.dischargedKWh > 0.01 ? `${n0(s.lifeYears)} anos` : "—"}</td>
                <td className="px-4 py-2 text-right">{s.lcos > 0 ? `R$ ${n2(s.lcos)}/kWh` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 pb-3 text-[11px] text-ink-400">
        Ida e volta inclui autodescarga e a energia ainda estocada no fim. Vida = menor entre vida em ciclos (no ritmo simulado) e vida de calendário (até 80% da capacidade). LCOS =
        investimento ÷ energia entregue na vida útil.
      </p>
    </div>
  );
}

export function LoadTable({ r }: { r: SimResult }) {
  const rows = r.kpis.loadEnergy;
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70">
      <div className="px-4 pt-4 pb-2 text-[14px] font-bold text-ink-900">Consumo por carga</div>
      <table className="w-full text-[12.5px]">
        <tbody className="tnum">
          {rows.map((l) => (
            <tr key={l.id} className="border-t border-ink-50">
              <td className="px-4 py-2">
                <div className="font-semibold text-ink-800">{l.name}</div>
                <div className="text-[11px] text-ink-400">{LOAD_LABEL[l.kind]}</div>
              </td>
              <td className="px-2 py-2 text-right font-semibold">{kwh(l.kWh)}</td>
              <td className="px-4 py-2 text-right text-ink-500">{l.solarKWh > 0 ? `${pct(l.solarKWh / Math.max(l.kWh, 1e-9))} com sobra solar` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DailyTable({ r }: { r: SimResult }) {
  return (
    <details className="rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70">
      <summary className="cursor-pointer px-4 py-3 text-[14px] font-bold text-ink-900">Tabela diária (dados dos gráficos)</summary>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-ink-100 text-right text-[11px] font-semibold text-ink-500">
              <th className="px-4 py-2 text-left">Dia</th>
              <th className="px-2 py-2">Solar disp.</th>
              <th className="px-2 py-2">Aproveitada</th>
              <th className="px-2 py-2">Cortada</th>
              <th className="px-2 py-2">Consumo</th>
              <th className="px-2 py-2">Compra</th>
              <th className="px-2 py-2">Injeção</th>
              <th className="px-2 py-2">Gerador</th>
              <th className="px-4 py-2">Não atendido</th>
            </tr>
          </thead>
          <tbody className="tnum text-right">
            {r.daily.map((d) => (
              <tr key={d.day} className={d.events > 0 ? "bg-rose-50/40" : ""}>
                <td className="px-4 py-1.5 text-left font-semibold text-ink-700">{d.label}</td>
                <td className="px-2 py-1.5">{n1(d.pvAvail)}</td>
                <td className="px-2 py-1.5">{n1(d.pvUsed)}</td>
                <td className="px-2 py-1.5">{n1(d.curtailed)}</td>
                <td className="px-2 py-1.5">{n1(d.load)}</td>
                <td className="px-2 py-1.5">{n1(d.import)}</td>
                <td className="px-2 py-1.5">{n1(d.export)}</td>
                <td className="px-2 py-1.5">{n1(d.gen)}</td>
                <td className="px-4 py-1.5">{n1(d.unserved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Exporta a série completa (passo a passo) em CSV com separador ";" e vírgula decimal (Excel pt-BR). */
export function exportCsv(r: SimResult) {
  const s = r.series;
  const head = [
    "dia",
    "hora",
    "ghi_Wm2",
    "poa_Wm2",
    "t_ar_C",
    "t_celula_C",
    "fv_disponivel_kW",
    "fv_aproveitada_kW",
    "fv_cortada_kW",
    "carga_fixa_kW",
    "carga_flexivel_kW",
    "nao_atendido_kW",
    "rede_compra_kW",
    "rede_injecao_kW",
    "gerador_kW",
    ...r.scenario.storage.flatMap((u, k) => [`arm${k + 1}_kW`, `arm${k + 1}_soc`]),
    "agua_boiler_C",
    "tarifa_RSkWh",
    "corte",
    "gd_desligada",
    "apagao",
  ];
  const f = (v: number) => (Number.isFinite(v) ? (Math.round(v * 10000) / 10000).toString().replace(".", ",") : "");
  const lines = [head.join(";")];
  for (let i = 0; i < s.t.length; i++) {
    lines.push(
      [
        r.daily[Math.floor(s.t[i] / 24)]?.label ?? "",
        f(s.hour[i]),
        f(s.ghi[i]),
        f(s.poa[i]),
        f(s.tAmb[i]),
        f(s.tCell[i]),
        f(s.pvAvail[i]),
        f(s.pvUsed[i]),
        f(s.curtailed[i]),
        f(s.loadFixed[i]),
        f(s.loadFlex[i]),
        f(s.unserved[i]),
        f(s.gridImport[i]),
        f(s.gridExport[i]),
        f(s.gen[i]),
        ...r.scenario.storage.flatMap((_, k) => [f(s.storagePower[k][i]), f(s.soc[k][i])]),
        f(s.waterTemp[i]),
        f(s.price[i]),
        s.flags[i] & 1 ? "1" : "0",
        s.flags[i] & 2 ? "1" : "0",
        s.flags[i] & 4 ? "1" : "0",
      ].join(";"),
    );
  }
  download(`${slug(r.scenario.name)}.csv`, "﻿" + lines.join("\n"), "text/csv;charset=utf-8");
}

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "cenario";

export function CsvButton({ r }: { r: SimResult }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => exportCsv(r)}>
      <Download className="h-3.5 w-3.5" /> CSV passo a passo
    </Button>
  );
}
