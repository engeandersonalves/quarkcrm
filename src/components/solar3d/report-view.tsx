"use client";

import { AlertTriangle, CheckCircle2, Printer, XCircle } from "lucide-react";
import { cx } from "../ui";
import { n0, n1 } from "./ui-bits";
import { electricalBom, type ElectricalReport } from "@/lib/solar3d/board";
import { cardinal, MONTHS } from "@/lib/solar3d/irradiance";
import { SYSTEM_LABEL, fmt } from "@/lib/solar3d/electrical";
import type { Project, ProjectReport } from "@/lib/solar3d/project";
import { ROOF_TYPES, brandById } from "@/lib/solar3d/structures";

export function ReportView({ project, report, elec, images }: { project: Project; report: ProjectReport; elec: ElectricalReport; images: { roof?: string; board?: string } }) {
  const bom = electricalBom(project, elec);
  const max = Math.max(1, ...report.monthly);
  return (
    <div className="s3d-report mx-auto max-w-4xl space-y-5 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink-200/70 sm:p-8 print:p-0 print:shadow-none print:ring-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-[0.18em] text-sun-600 uppercase">Memorial do projeto</div>
          <h2 className="font-display text-2xl font-semibold text-ink-950">{project.name}</h2>
          <p className="text-sm text-ink-500">
            {project.site.name} · {n1(project.site.lat, 4)}, {n1(project.site.lon, 4)} · HSP {n1(project.site.hsp, 2)} ({project.site.hspSource})
          </p>
        </div>
        <button onClick={() => window.print()} className="flex h-9 items-center gap-1.5 rounded-xl bg-ink-900 px-3 text-sm font-semibold text-white print:hidden">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
      </div>

      {(images.roof || images.board) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.roof && <img src={images.roof} alt="Vista 3D do telhado" className="w-full rounded-xl ring-1 ring-ink-200" />}
          {images.board && <img src={images.board} alt="Vista 3D do quadro elétrico" className="w-full rounded-xl ring-1 ring-ink-200" />}
        </div>
      )}

      <section>
        <H>Gerador fotovoltaico</H>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi l="Módulos" v={`${report.modules} × ${project.module.power} Wp`} />
          <Kpi l="Potência" v={`${n1(report.kwp, 2)} kWp`} />
          <Kpi l="Geração média" v={`${n0(report.monthlyAvg)} kWh/mês`} />
          <Kpi l="Produtividade" v={`${n0(report.specificYield)} kWh/kWp·ano`} />
        </div>
        <div className="mt-3 flex h-28 items-end gap-1.5">
          {report.monthly.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="tnum text-[9.5px] text-ink-500">{n0(v)}</span>
              <div className="w-full rounded-t bg-sun-400" style={{ height: `${(v / max) * 80}px` }} />
              <span className="text-[10px] text-ink-500">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
        <table className="mt-3 w-full text-[12.5px]">
          <thead className="text-left text-ink-500">
            <tr className="border-b border-ink-100">
              <th className="py-1.5">Local</th>
              <th>Cobertura</th>
              <th className="text-right">Incl./Orient.</th>
              <th className="text-right">Módulos</th>
              <th className="text-right">HSP plano</th>
              <th className="text-right">Sombra</th>
              <th className="text-right">kWh/mês</th>
            </tr>
          </thead>
          <tbody>
            {report.arrays.map((a) => (
              <tr key={a.array.id} className="border-b border-ink-50">
                <td className="py-1.5">
                  {a.building.name} — {a.plane.label}
                </td>
                <td>{ROOF_TYPES[a.plane.roofType].label}</td>
                <td className="tnum text-right">
                  {n1(a.tilt, 0)}° {cardinal(a.azimuth)}
                </td>
                <td className="tnum text-right">{a.modules}</td>
                <td className="tnum text-right">{n1(a.poaAnnual, 2)}</td>
                <td className="tnum text-right">{project.shading[a.array.id] ? `${n1(a.shadingLoss * 100)}%` : "—"}</td>
                <td className="tnum text-right">{n0(a.annual / 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11.5px] text-ink-500">
          Irradiação transposta para o plano de cada água (Liu-Jordan + Erbs), PR {Math.round(project.performanceRatio * 100)}% e perdas por sombra calculadas por traçado de raios no dia médio de cada mês. Estimativa para estudo — a geração real varia com o clima de cada ano.
        </p>
      </section>

      <section>
        <H>Estrutura — {brandById(project.structureBrand).name}</H>
        <List rows={report.bom.map((l) => [l.item + (l.note ? ` (${l.note})` : ""), l.qty ? `${l.qty} ${l.unit}` : ""])} />
      </section>

      <section>
        <H>Instalação elétrica</H>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi l="Entrada" v={`${SYSTEM_LABEL[project.electrical.grid.system]} ${project.electrical.grid.vFN}/${project.electrical.grid.vFN === 127 ? 220 : 380} V`} />
          <Kpi l="Inversor" v={`${project.electrical.inverter.brand} ${fmt(project.electrical.inverter.powerKw)} kW`} />
          <Kpi l="Strings" v={elec.strings.strings.map((s) => s.modules).join(" + ") || "—"} />
          <Kpi l="Quadro" v={`${project.electrical.board.modules} módulos`} />
        </div>
        <table className="mt-3 w-full text-[12.5px]">
          <thead className="text-left text-ink-500">
            <tr className="border-b border-ink-100">
              <th className="py-1.5">Circuito</th>
              <th className="text-right">Ib</th>
              <th className="text-right">Disjuntor</th>
              <th className="pl-2">Cabos</th>
              <th className="text-right">Eletroduto</th>
              <th className="text-right">Queda</th>
            </tr>
          </thead>
          <tbody>
            {[elec.inverter, ...(elec.ev ? [elec.ev] : []), ...elec.extra].map((c) => (
              <tr key={c.id} className="border-b border-ink-50">
                <td className="py-1.5">{c.name}</td>
                <td className="tnum text-right">{n1(c.sizing.ib)} A</td>
                <td className="tnum text-right">
                  {c.sizing.poles}P {c.sizing.breaker} A {c.sizing.curve}
                </td>
                <td className="pl-2">{c.sizing.cableSpec}</td>
                <td className="text-right">{c.sizing.conduit.label}</td>
                <td className="tnum text-right">{n1(c.sizing.drop, 2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-3 space-y-1 text-[12.5px]">
          {elec.checks.map((c, i) => (
            <li key={i} className="flex gap-2">
              {c.level === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" /> : c.level === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
              {c.text}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <H>Materiais elétricos</H>
        <List rows={bom.map((l) => [l.item, l.qty])} />
      </section>

      <p className="rounded-xl bg-amber-50 p-3 text-[12px] text-amber-900 ring-1 ring-amber-200">
        Pré-dimensionamento com base na NBR 5410, NBR 16690, NBR 17019 e REN 1000/ANEEL. O projeto executivo, a homologação na distribuidora e a execução exigem profissional habilitado com ART/TRT; confirme dados de
        catálogo de módulos, inversor, estruturas e o cálculo estrutural de vento (NBR 6123).
      </p>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 font-display text-[15px] font-semibold text-ink-950">{children}</h3>;
}
function Kpi({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2 ring-1 ring-ink-100">
      <div className="text-[11px] text-ink-500">{l}</div>
      <div className="font-semibold text-ink-900">{v}</div>
    </div>
  );
}
function List({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="divide-y divide-ink-100 text-[12.5px]">
      {rows.map(([a, b], i) => (
        <li key={i} className={cx("flex justify-between gap-4 py-1.5", a.startsWith("⚠") && "text-amber-700")}>
          <span>{a}</span>
          <span className="tnum shrink-0 font-semibold">{b}</span>
        </li>
      ))}
    </ul>
  );
}
