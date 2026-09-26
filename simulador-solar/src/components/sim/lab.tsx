"use client";

import { FlaskConical, FolderOpen, Pause, Play, RotateCcw, Save, SkipBack, SkipForward } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button, cx } from "@/components/ui";
import { simulate } from "@/lib/sim/engine";
import { PRESETS } from "@/lib/sim/presets";
import type { Scenario } from "@/lib/sim/types";
import { DailyChart, SocChart, SolarChart, SupplyChart, WeatherChart } from "./charts";
import { hhmm, n0 } from "./common";
import { Compare, type Snapshot } from "./compare";
import { FlowDiagram } from "./diagram";
import { Editor, type Update } from "./editor";
import { Method } from "./method";
import { CsvButton, DailyTable, download, KpiGrid, LoadTable, slug, StorageTable, Warnings } from "./results";
import { Studies } from "./studies";

type Tab = "sistema" | "painel" | "comparar" | "estudos" | "metodo";
const KEY = "quark-lab:scenario";
const KEY_SNAPS = "quark-lab:snaps";

const load = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
};

export function SolarLab() {
  const [scenario, setScenario] = useState<Scenario>(() => PRESETS[1].build());
  const [presetId, setPresetId] = useState<string | null>(PRESETS[1].id);
  const [tab, setTab] = useState<Tab>("painel");
  const [snaps, setSnapsState] = useState<Snapshot[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // restaura o último cenário e as comparações deste navegador
  useEffect(() => {
    const s = load<Scenario>(KEY);
    if (s?.pv && s.grid && s.sim) {
      setScenario(s);
      setPresetId(null);
    }
    const sn = load<Snapshot[]>(KEY_SNAPS);
    if (Array.isArray(sn)) setSnapsState(sn);
  }, []);
  useEffect(() => save(KEY, scenario), [scenario]);
  const setSnaps = (fn: (s: Snapshot[]) => Snapshot[]) =>
    setSnapsState((prev) => {
      const next = fn(prev);
      save(KEY_SNAPS, next);
      return next;
    });

  const deferred = useDeferredValue(scenario);
  const result = useMemo(() => simulate(deferred), [deferred]);
  const stale = deferred !== scenario;
  const nSteps = result.series.t.length;

  // cursor inicial: meio-dia do primeiro dia com evento (ou do primeiro dia)
  useEffect(() => {
    const s = result.series;
    let first = s.flags.findIndex((f) => (f & 7) !== 0);
    if (first < 0) first = Math.round(12.5 / (result.scenario.sim.stepMin / 60));
    setCursor(Math.min(first, s.t.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.scenario.sim.days, result.scenario.sim.stepMin, result.scenario.sim.startDay, result.scenario.id]);

  useEffect(() => {
    if (!playing) return;
    const perTick = Math.max(1, Math.round(15 / result.scenario.sim.stepMin));
    const id = setInterval(() => setCursor((c) => (c + perTick) % nSteps), 120);
    return () => clearInterval(id);
  }, [playing, nSteps, result.scenario.sim.stepMin]);

  const update: Update = (fn) =>
    setScenario((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });

  const openPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setScenario(p.build());
    setPresetId(id);
    setTab("painel");
  };

  const importJson = async (file: File) => {
    try {
      const s = JSON.parse(await file.text()) as Scenario;
      if (!s.pv || !s.grid || !s.sim || !Array.isArray(s.storage) || !Array.isArray(s.loads)) throw new Error("formato");
      setScenario(s);
      setPresetId(null);
      setImportError(null);
    } catch {
      setImportError("Não consegui abrir esse arquivo. Use um cenário .json exportado por este simulador (botão de disquete).");
    }
  };

  const preset = presetId ? PRESETS.find((p) => p.id === presetId) : null;
  const clampedCursor = Math.min(cursor, nSteps - 1);
  const s = result.series;
  const chartProps = { r: result, cursor: clampedCursor, onCursor: setCursor };

  const tabs: { id: Tab; label: string; mobileOnly?: boolean }[] = [
    { id: "sistema", label: "Sistema", mobileOnly: true },
    { id: "painel", label: "Simulação" },
    { id: "comparar", label: "Comparar" },
    { id: "estudos", label: "Estudos" },
    { id: "metodo", label: "Método" },
  ];

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* ---------------------------------------------------------- topo */}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-white/10 bg-ink-900 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sun-gradient text-ink-950">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold">Quark Lab</div>
              <div className="text-[11px] text-white/60">Simulador de sistemas de energia solar</div>
            </div>
          </div>
          <select
            value={presetId ?? ""}
            onChange={(e) => openPreset(e.target.value)}
            className="h-9 max-w-[260px] min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-[13px] font-semibold text-white ring-1 ring-white/15 focus:outline-none sm:flex-none"
            aria-label="Cenários prontos"
          >
            <option value="" className="text-ink-900">
              Cenários prontos…
            </option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="text-ink-900">
                {p.title}
              </option>
            ))}
          </select>
          <input
            value={scenario.name}
            onChange={(e) => update((d) => void (d.name = e.target.value))}
            className="hidden h-9 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-[14px] sm:block font-semibold text-white ring-1 ring-transparent hover:ring-white/15 focus:ring-white/30 focus:outline-none"
            aria-label="Nome do cenário"
          />
          <div className="flex items-center gap-1.5">
            <span suppressHydrationWarning className={cx("hidden text-[11px] text-white/50 md:inline", stale && "animate-pulse")}>
              {n0(nSteps)} passos · {result.ms.toFixed(0)} ms
            </span>
            <button type="button" onClick={() => download(`${slug(scenario.name)}.json`, JSON.stringify(scenario, null, 2), "application/json")} className="grid h-9 w-9 place-items-center rounded-xl text-white/80 hover:bg-white/10" title="Exportar cenário (JSON)" aria-label="Exportar cenário">
              <Save className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-9 w-9 place-items-center rounded-xl text-white/80 hover:bg-white/10" title="Importar cenário (JSON)" aria-label="Importar cenário">
              <FolderOpen className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => openPreset(presetId ?? PRESETS[0].id)} className="grid h-9 w-9 place-items-center rounded-xl text-white/80 hover:bg-white/10" title="Recomeçar do cenário pronto" aria-label="Recomeçar">
              <RotateCcw className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pb-2 lg:pl-[452px]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx(
                "h-8 shrink-0 rounded-lg px-3 text-[13px] font-semibold transition",
                t.mobileOnly && "lg:hidden",
                tab === t.id ? "bg-white text-ink-900" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        {/* ------------------------------------------------------ editor */}
        <aside className={cx("lg:sticky lg:top-[112px] lg:block lg:max-h-[calc(100dvh-128px)] lg:overflow-y-auto lg:pr-1 lg:pb-8", tab === "sistema" ? "block" : "hidden")}>
          <Editor s={scenario} update={update} />
        </aside>

        {/* ------------------------------------------------------ conteúdo */}
        <main className={cx("min-w-0 flex-col gap-4", tab === "sistema" ? "hidden lg:flex" : "flex")}>
          {(tab === "painel" || tab === "sistema") && (
            <>
              {preset && (
                <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-ink-800 p-4 text-white shadow-lift">
                  <div className="text-[11px] font-bold tracking-wider text-brand-lime uppercase">Pergunta de pesquisa</div>
                  <div className="mt-1 font-display text-[16px] leading-snug font-semibold">{preset.question}</div>
                  {scenario.description && <div className="mt-1.5 text-[12.5px] text-white/70">{scenario.description}</div>}
                </div>
              )}
              {importError && (
                <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl bg-rose-50 p-3.5 text-[12.5px] text-rose-900 ring-1 ring-rose-200">
                  {importError}
                  <button type="button" onClick={() => setImportError(null)} className="font-semibold underline">
                    Fechar
                  </button>
                </div>
              )}
              <Warnings r={result} />

              <div className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink-200/70 sm:p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[14px] font-bold text-ink-900">Fluxo de energia no instante</div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setCursor((c) => Math.max(0, c - Math.round(24 / (scenario.sim.stepMin / 60))))} aria-label="Dia anterior">
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant={playing ? "secondary" : "primary"} onClick={() => setPlaying((p) => !p)}>
                      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "Pausar" : "Animar"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setCursor((c) => Math.min(nSteps - 1, c + Math.round(24 / (scenario.sim.stepMin / 60))))} aria-label="Próximo dia">
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <FlowDiagram r={result} i={clampedCursor} />
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={nSteps - 1}
                    value={clampedCursor}
                    onChange={(e) => {
                      setPlaying(false);
                      setCursor(Number(e.target.value));
                    }}
                    className="flex-1 accent-ink-900"
                    aria-label="Instante da simulação"
                  />
                  <span className="tnum w-24 text-right text-[12px] font-semibold text-ink-600">
                    {result.daily[Math.floor(s.t[clampedCursor] / 24)]?.label} {hhmm(s.hour[clampedCursor])}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-400">Clique em qualquer gráfico para mover o instante.</p>
              </div>

              <KpiGrid r={result} />
              <SolarChart {...chartProps} />
              <SupplyChart {...chartProps} />
              <SocChart {...chartProps} />
              <DailyChart r={result} />
              <WeatherChart {...chartProps} />
              <div className="grid gap-4 xl:grid-cols-2">
                <StorageTable r={result} />
                <LoadTable r={result} />
              </div>
              <DailyTable r={result} />
              <div className="flex flex-wrap items-center gap-2">
                <CsvButton r={result} />
                <span className="text-[12px] text-ink-500">Série completa para análise no Excel, Python, R ou MATLAB.</span>
              </div>
            </>
          )}
          {tab === "comparar" && <Compare current={scenario} currentKpis={result.kpis} snaps={snaps} setSnaps={setSnaps} onLoad={(sc) => (setScenario(sc), setPresetId(null), setTab("painel"))} />}
          {tab === "estudos" && <Studies s={scenario} />}
          {tab === "metodo" && <Method />}
        </main>
      </div>
    </div>
  );
}
