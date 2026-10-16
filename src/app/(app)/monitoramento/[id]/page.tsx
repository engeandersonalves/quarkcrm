"use client";

import { Activity, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Cpu, FileBarChart, FileSpreadsheet, Gauge, Link2, Loader2, MapPin, RefreshCw, Thermometer, Trash2, Waves, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { BarChart } from "@/components/charts";
import { ProviderMark } from "@/components/monitoring/connect-modal";
import { ImportModal } from "@/components/monitoring/import-modal";
import { Badge, Button, Card, Empty, Field, Segmented, Select, Skeleton, cx } from "@/components/ui";
import { DEFAULT_INPUTS } from "@/lib/defaults";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { providerInfo } from "@/lib/monitoring/catalog";
import { daysInMonth, monthLabel, monthShort, reportStats, shiftMonth } from "@/lib/monitoring/report";
import type { DayValue, DeviceData, MonthValue, PlantStatus } from "@/lib/monitoring/types";
import { STATUS_LABEL, fmtKw, fmtKwh, fmtKwp, yieldOf, type PlantRow } from "@/lib/monitoring/view";
import { supabase } from "@/lib/supabase/client";

const GREEN = "#9BD373";
const todayLocal = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const STATUS_STYLE: Record<PlantStatus, string> = {
  online: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  alarm: "bg-amber-50 text-amber-800 ring-amber-600/20",
  offline: "bg-rose-50 text-rose-700 ring-rose-600/20",
  unknown: "bg-ink-100 text-ink-600 ring-ink-500/15",
};
const nf = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: d }));

interface Detail {
  days: DayValue[];
  months: MonthValue[];
  devices: DeviceData[] | null;
  notes: Record<string, string>;
}

export default function PlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { profile, settings } = useApp();
  const isAdmin = profile?.role === "admin";
  const today = todayLocal();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const [view, setView] = useState<"dias" | "meses">("dias");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(search.get("importar") === "1");
  const [leadId, setLeadId] = useState<string | null>(null);

  const { data: plant, loading: loadingPlant, reload } = useLive(
    async () => must(await supabase().from("monitoring_plants").select("*, lead:leads(id,name)").eq("id", id).maybeSingle()) as PlantRow | null,
    [id],
    ["monitoring_plants"],
  );
  const { data: leads } = useLive(async () => must(await supabase().from("leads").select("id,name,city").order("name").limit(3000)) as { id: string; name: string; city: string | null }[], [], []);
  useEffect(() => {
    if (plant) setLeadId((v) => (v === null ? (plant.lead_id ?? "") : v));
  }, [plant]);

  const load = useCallback(
    async (opts: { devices?: boolean } = {}) => {
      setLoading(true);
      const res = await fetch(`/api/monitoring/plant/${id}?month=${month}&year=${year}&devices=${opts.devices === false ? 0 : 1}`).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      setLoading(false);
      if (!res?.ok || !json) {
        setDetail({ days: [], months: [], devices: null, notes: { geral: json?.error ?? "Não foi possível carregar os dados agora." } });
        return;
      }
      setDetail((d) => (opts.devices === false && d ? { ...json, devices: d.devices } : json));
    },
    [id, month, year],
  );
  useEffect(() => {
    load({ devices: detail === null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const inputs = { ...DEFAULT_INPUTS, ...settings.defaults };
  const capacity = plant?.capacity_kwp != null ? Number(plant.capacity_kwp) : null;
  const stats = useMemo(
    () => reportStats({ month, days: detail?.days ?? [], months: detail?.months ?? [], capacityKwp: capacity, tariff: inputs.tariff, sunHours: inputs.sunHours, performanceRatio: inputs.performanceRatio, today }),
    [detail, month, capacity, inputs.tariff, inputs.sunHours, inputs.performanceRatio, today],
  );

  const dayChart = useMemo(() => {
    const map = new Map((detail?.days ?? []).map((d) => [d.day, d.kwh]));
    return Array.from({ length: daysInMonth(month) }, (_, i) => {
      const day = `${month}-${String(i + 1).padStart(2, "0")}`;
      return { label: i % 3 === 0 ? String(i + 1) : "", full: new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }), value: map.get(day) ?? 0 };
    });
  }, [detail, month]);
  const monthChart = useMemo(() => {
    const map = new Map((detail?.months ?? []).map((m) => [m.month, m.kwh]));
    return Array.from({ length: 12 }, (_, i) => {
      const mm = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { label: monthShort(mm), full: monthLabel(mm), value: map.get(mm) ?? 0 };
    });
  }, [detail, year]);
  const yearTotal = monthChart.reduce((t, m) => t + m.value, 0);

  const saveLead = async () => {
    const { error } = await supabase().from("monitoring_plants").update({ lead_id: leadId || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(leadId ? "Usina vinculada ao cliente" : "Vínculo removido");
    reload();
  };
  const removeManual = async () => {
    if (!confirm("Remover esta usina e todo o histórico importado?")) return;
    const res = await fetch(`/api/monitoring/manual?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Não foi possível remover");
    toast.success("Usina removida");
    router.push("/monitoramento");
  };

  if (loadingPlant && !plant) return <Skeleton className="h-[60vh]" />;
  if (!plant)
    return (
      <Card>
        <Empty icon={<Activity className="h-6 w-6" />} title="Usina não encontrada" text="Ela pode ter sido removida." action={<Link href="/monitoramento"><Button variant="secondary">Voltar ao monitoramento</Button></Link>} />
      </Card>
    );

  const info = providerInfo(plant.provider);
  const isManual = plant.provider === "manual";
  const notes = detail?.notes ?? {};
  const atMonth = month >= today.slice(0, 7);

  return (
    <div className="animate-fade-up">
      {/* cabeçalho */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/monitoramento" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-600 shadow-soft ring-1 ring-ink-200/70 hover:text-ink-900" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <ProviderMark id={plant.provider} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">{info?.platform ?? plant.provider}</p>
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{plant.name}</h1>
        </div>
        <Badge className={STATUS_STYLE[plant.status]}>{STATUS_LABEL[plant.status]}</Badge>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {isManual && (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Importar planilha
            </Button>
          )}
          {!isManual && (
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} /> Atualizar
            </Button>
          )}
          <Link href={`/monitoramento/${id}/relatorio?mes=${month}`} className="flex-1 sm:flex-none">
            <Button className="w-full">
              <FileBarChart className="h-4 w-4" /> Relatório de geração
            </Button>
          </Link>
        </div>
      </div>

      {/* indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { k: "Potência agora", v: isManual ? "—" : fmtKw(plant.power_kw), icon: <Zap className="h-3.5 w-3.5" /> },
          { k: "Hoje", v: fmtKwh(plant.today_kwh), icon: <Activity className="h-3.5 w-3.5" /> },
          { k: "No mês", v: fmtKwh(plant.month_kwh), icon: <Activity className="h-3.5 w-3.5" /> },
          { k: "Total gerado", v: fmtKwh(plant.total_kwh), icon: <Activity className="h-3.5 w-3.5" /> },
          { k: "Capacidade", v: fmtKwp(plant.capacity_kwp), icon: <Gauge className="h-3.5 w-3.5" /> },
          { k: "Desempenho hoje", v: yieldOf(plant) !== null ? `${nf(yieldOf(plant), 2)} kWh/kWp` : "—", icon: <Gauge className="h-3.5 w-3.5" /> },
        ].map((x) => (
          <Card key={x.k} className="p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
              <span className="text-sun-600">{x.icon}</span> {x.k}
            </p>
            <p className="tnum mt-1 font-display text-lg font-semibold text-ink-900 sm:text-xl">{x.v}</p>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-500">
        {plant.last_update_at ? `Última leitura ${relativeTime(plant.last_update_at)}` : "Sem leitura ainda"}
        {plant.address ? ` · ${plant.address}` : ""}
      </p>

      {notes.geral && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {notes.geral}
        </p>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------ geração */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "dias", label: "Geração diária" },
                { value: "meses", label: "Geração mensal" },
              ]}
            />
            <div className="flex items-center gap-1">
              <button onClick={() => (view === "dias" ? setMonth(shiftMonth(month, -1)) : setYear(String(Number(year) - 1)))} className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 ring-1 ring-ink-200 hover:text-ink-900" aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[150px] text-center text-sm font-semibold inline-block text-ink-900 first-letter:uppercase">{view === "dias" ? monthLabel(month) : year}</span>
              <button
                onClick={() => (view === "dias" ? setMonth(shiftMonth(month, 1)) : setYear(String(Number(year) + 1)))}
                disabled={view === "dias" ? atMonth : year >= today.slice(0, 4)}
                className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 ring-1 ring-ink-200 hover:text-ink-900 disabled:opacity-30"
                aria-label="Próximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(view === "dias"
              ? [
                  { k: "Total do mês", v: fmtKwh(stats.total) },
                  { k: "Média por dia", v: fmtKwh(stats.avg) },
                  { k: "Melhor dia", v: stats.best ? `${fmtKwh(stats.best.kwh)} · ${stats.best.day.slice(8)}` : "—" },
                  { k: "Esperado (projeto)", v: stats.pctExpected !== null ? `${Math.round(stats.pctExpected * 100)}%` : "—", hint: stats.expected ? `de ${fmtKwh(stats.expected)}` : undefined },
                ]
              : [
                  { k: "Total do ano", v: fmtKwh(yearTotal) },
                  { k: "Média por mês", v: fmtKwh(yearTotal / Math.max(1, monthChart.filter((m) => m.value > 0).length)) },
                  { k: "Melhor mês", v: monthChart.some((m) => m.value > 0) ? monthChart.reduce((b, m) => (m.value > b.value ? m : b)).full : "—" },
                  { k: "Economia estimada", v: (yearTotal * inputs.tariff).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) },
                ]
            ).map((x) => (
              <div key={x.k} className="rounded-xl bg-ink-50 px-3 py-2.5 ring-1 ring-ink-200/60 dark:bg-white/[0.03]">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{x.k}</p>
                <p className="tnum mt-0.5 text-sm font-semibold text-ink-900 first-letter:uppercase">{x.v}</p>
                {"hint" in x && x.hint && <p className="text-[11px] text-ink-500">{x.hint}</p>}
              </div>
            ))}
          </div>

          <div className="mt-5">
            {loading && !detail ? (
              <Skeleton className="h-[240px]" />
            ) : (view === "dias" ? dayChart : monthChart).some((d) => d.value > 0) ? (
              <BarChart data={view === "dias" ? dayChart : monthChart} format={(v) => fmtKwh(v)} color={GREEN} height={260} />
            ) : (
              <div className="grid h-[240px] place-items-center rounded-2xl bg-ink-50 px-6 text-center text-sm text-ink-500 dark:bg-white/[0.03]">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : notes[view] ?? (isManual ? "Importe a planilha de geração para ver este período." : "Sem geração registrada neste período.")}
              </div>
            )}
          </div>
          {notes[view] && (view === "dias" ? dayChart : monthChart).some((d) => d.value > 0) && <p className="mt-2 text-xs text-amber-700">{notes[view]} Mostrando o histórico já gravado.</p>}
        </Card>

        {/* ------------------------------------------------ lateral */}
        <div className="grid content-start gap-5">
          <Card className="p-4 sm:p-5">
            <p className="text-sm font-semibold text-ink-900">Resumo de {monthLabel(month)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-ink-500">Geração</dt>
              <dd className="tnum text-right font-medium text-ink-900">{fmtKwh(stats.total)}</dd>
              <dt className="text-ink-500">Produtividade</dt>
              <dd className="tnum text-right font-medium text-ink-900">{stats.specific !== null ? `${nf(stats.specific, 1)} kWh/kWp` : "—"}</dd>
              <dt className="text-ink-500">Economia estimada</dt>
              <dd className="tnum text-right font-medium text-ink-900">{stats.savings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
              <dt className="text-ink-500">CO₂ evitado</dt>
              <dd className="tnum text-right font-medium text-ink-900">{nf(stats.co2Kg, 0)} kg</dd>
              <dt className="text-ink-500">Dias com geração</dt>
              <dd className="tnum text-right font-medium text-ink-900">
                {stats.daysWithData}/{stats.elapsed}
              </dd>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
              Esperado = {fmtKwp(capacity)} × {nf(inputs.sunHours, 2)} h de sol × {Math.round(inputs.performanceRatio * 100)}% de rendimento. Tarifa {inputs.tariff.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}/kWh (Configurações → Orçamento).
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <Field label="Cliente do CRM" hint="Vinculada, a usina aparece na ficha do cliente">
              <div className="flex gap-2">
                <Select value={leadId ?? ""} onChange={(e) => setLeadId(e.target.value)} className="flex-1">
                  <option value="">Sem vínculo</option>
                  {(leads ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.city ? ` — ${l.city}` : ""}
                    </option>
                  ))}
                </Select>
                <Button variant="secondary" onClick={saveLead} disabled={(leadId ?? "") === (plant.lead_id ?? "")}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            {plant.lead_id && (
              <Link href={`/leads/${plant.lead_id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sun-700 hover:underline">
                Abrir ficha do cliente <ChevronRight className="h-4 w-4" />
              </Link>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-ink-100 pt-3 text-xs">
              <dt className="text-ink-500">Fabricante</dt>
              <dd className="text-right text-ink-800">{isManual ? plant.address?.split(" · ")[0] ?? "Outro" : info?.name}</dd>
              <dt className="text-ink-500">ID no fabricante</dt>
              <dd className="truncate text-right font-mono text-ink-700">{isManual ? "—" : plant.external_id}</dd>
              {plant.address && !isManual && (
                <>
                  <dt className="text-ink-500">Endereço</dt>
                  <dd className="flex items-center justify-end gap-1 text-right text-ink-800">
                    <MapPin className="h-3 w-3" /> {plant.address}
                  </dd>
                </>
              )}
            </dl>
            {isManual && isAdmin && (
              <Button variant="ghost" size="sm" className="mt-3 text-rose-600" onClick={removeManual}>
                <Trash2 className="h-4 w-4" /> Remover usina
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------ inversores */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-sun-600" />
          <h2 className="font-display text-lg font-semibold text-ink-900">Inversores · leituras elétricas</h2>
        </div>
        {loading && detail?.devices === undefined ? (
          <Skeleton className="h-40" />
        ) : detail?.devices?.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {detail.devices.map((d) => (
              <DeviceCard key={d.sn} d={d} />
            ))}
          </div>
        ) : (
          <Card className="p-5 text-sm text-ink-500">
            {isManual
              ? "Usinas cadastradas por planilha não têm leituras elétricas em tempo real."
              : notes.eletrica ??
                (info?.features.includes("eletrica") ? (loading ? "Carregando leituras…" : "O fabricante não devolveu inversores para esta usina agora.") : `A API da ${info?.platform ?? "plataforma"} não fornece tensão e corrente por inversor.`)}
          </Card>
        )}
      </section>

      {isManual && <ImportModal plantId={id} open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { reload(); load({ devices: false }); }} />}
    </div>
  );
}

function DeviceCard({ d }: { d: DeviceData }) {
  const maxDcV = Math.max(1, ...d.dc.map((x) => x.voltage ?? 0));
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sun-50 text-sun-700 ring-1 ring-sun-200/70">
          <Cpu className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-ink-900">{d.name}</p>
          <p className="truncate font-mono text-[11px] text-ink-500">
            {d.model ? `${d.model} · ` : ""}SN {d.sn}
          </p>
        </div>
        <Badge className={STATUS_STYLE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: "Potência", v: fmtKw(d.powerKw), icon: <Zap className="h-3.5 w-3.5" /> },
          { k: "Hoje", v: fmtKwh(d.todayKwh), icon: <Activity className="h-3.5 w-3.5" /> },
          { k: "Temperatura", v: d.temperatureC !== null ? `${nf(d.temperatureC, 1)} °C` : "—", icon: <Thermometer className="h-3.5 w-3.5" />, warn: (d.temperatureC ?? 0) >= 70 },
          { k: "Frequência", v: d.frequencyHz !== null ? `${nf(d.frequencyHz, 2)} Hz` : "—", icon: <Waves className="h-3.5 w-3.5" /> },
        ].map((x) => (
          <div key={x.k} className="rounded-xl bg-ink-50 px-3 py-2 ring-1 ring-ink-200/60 dark:bg-white/[0.03]">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
              {x.icon} {x.k}
            </p>
            <p className={cx("tnum mt-0.5 text-sm font-semibold", x.warn ? "text-amber-600" : "text-ink-900")}>{x.v}</p>
          </div>
        ))}
      </div>

      {d.ac.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Lado CA (rede)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-400">
                <th className="py-1 font-medium">Fase</th>
                <th className="py-1 text-right font-medium">Tensão</th>
                <th className="py-1 text-right font-medium">Corrente</th>
              </tr>
            </thead>
            <tbody>
              {d.ac.map((a) => (
                <tr key={a.label} className="border-t border-ink-100">
                  <td className="py-1.5 text-ink-700">{a.label}</td>
                  <td className={cx("tnum py-1.5 text-right font-medium", a.voltage !== null && (a.voltage > 242 || a.voltage < 198) && a.voltage > 150 ? "text-amber-600" : "text-ink-900")}>{a.voltage !== null ? `${nf(a.voltage, 1)} V` : "—"}</td>
                  <td className="tnum py-1.5 text-right font-medium text-ink-900">{a.current !== null ? `${nf(a.current, 2)} A` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.dc.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Lado CC (strings / MPPT)</p>
          <div className="grid gap-1.5">
            {d.dc.map((s) => (
              <div key={s.label} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <span className="font-semibold text-ink-700">{s.label}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#6CC690]" style={{ width: `${Math.round(((s.voltage ?? 0) / maxDcV) * 100)}%` }} />
                </div>
                <span className="tnum text-right text-xs text-ink-700">
                  {s.voltage !== null ? `${nf(s.voltage, 1)} V` : "—"} · {s.current !== null ? `${nf(s.current, 2)} A` : "—"}
                  {s.powerKw !== null ? ` · ${fmtKw(s.powerKw)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!d.ac.length && !d.dc.length && <p className="mt-4 text-xs text-ink-500">O fabricante não enviou tensão e corrente deste inversor.</p>}
      {d.updatedAt && <p className="mt-3 text-[11px] text-ink-400">Leitura de {relativeTime(d.updatedAt)}</p>}
    </Card>
  );
}
