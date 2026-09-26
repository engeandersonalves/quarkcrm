"use client";

import {
  Box,
  Camera,
  Compass,
  Copy,
  Crosshair,
  Eye,
  Flame,
  Grid3x3,
  LocateFixed,
  Loader2,
  MapPin,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Ruler,
  Satellite,
  SquareDashed,
  Sun,
  Trash2,
  TreePine,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { cx } from "../ui";
import { RoofScene, type RoofTool, type Selection } from "./roof-scene";
import { Chips, F, Num, Section, Sel, Stat, Toggle, ToolButton, Txt, n0, n1 } from "./ui-bits";
import type { Obstacle, RoofShape, RoofType } from "@/lib/solar3d/geometry";
import { CITIES, MONTHS, cardinal, fetchNasaPower, nearestCity } from "@/lib/solar3d/irradiance";
import { MODULE_PRESETS, newArray, newBuilding, uid, type Project, type ProjectReport } from "@/lib/solar3d/project";
import { ROOF_TYPES, STRUCTURE_BRANDS, brandById } from "@/lib/solar3d/structures";
import { fmtHour, guessTimezone, localToUtc, sunPath, sunPosition, sunriseSunset } from "@/lib/solar3d/sun";

export type Update = (fn: (p: Project) => Project, opts?: { geometry?: boolean; history?: boolean }) => void;

const ROOF_ORDER: RoofType[] = ["colonial", "fibrocimento", "metalico", "laje", "solo"];
const SHAPES: { value: RoofShape; label: string }[] = [
  { value: "uma-agua", label: "1 água" },
  { value: "duas-aguas", label: "2 águas" },
  { value: "quatro-aguas", label: "4 águas" },
];
const OBSTACLES: { value: Obstacle["kind"]; label: string; height: number; size: number }[] = [
  { value: "arvore", label: "Árvore", height: 6, size: 2 },
  { value: "caixa", label: "Caixa d'água", height: 1.3, size: 1.4 },
  { value: "chamine", label: "Chaminé", height: 1.2, size: 0.5 },
  { value: "predio", label: "Prédio/muro vizinho", height: 9, size: 8 },
  { value: "poste", label: "Poste", height: 8, size: 0.3 },
];

export function RoofStudio({
  project,
  report,
  update,
  onSnapshot,
}: {
  project: Project;
  report: ProjectReport;
  update: Update;
  onSnapshot: (img: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoofScene | null>(null);
  const [tool, setTool] = useState<RoofTool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [drawRoof, setDrawRoof] = useState<RoofType>("colonial");
  const [obstacleKind, setObstacleKind] = useState<Obstacle["kind"]>("arvore");
  const [heatmap, setHeatmap] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [measure, setMeasure] = useState<number | null>(null);
  const [shadeBusy, setShadeBusy] = useState<number | null>(null);
  const [nasaBusy, setNasaBusy] = useState(false);
  const cbRef = useRef({ update, setSelection, tool, drawRoof, obstacleKind, project });
  cbRef.current = { update, setSelection, tool, drawRoof, obstacleKind, project };

  // cria a cena uma vez
  useEffect(() => {
    if (!host.current) return;
    const s = new RoofScene(host.current, {
      onSelect: (sel) => cbRef.current.setSelection(sel),
      onCreateBuilding: (r) => {
        const { drawRoof: t, update: up, project: p } = cbRef.current;
        const b = newBuilding({
          name: t === "solo" ? `Área de solo ${p.buildings.length + 1}` : `Edificação ${p.buildings.length + 1}`,
          roofType: t,
          x: Number(r.x.toFixed(2)),
          z: Number(r.z.toFixed(2)),
          length: Number(r.length.toFixed(2)),
          width: Number(r.width.toFixed(2)),
          height: t === "solo" ? 0 : 3,
        });
        up((q) => ({ ...q, buildings: [...q.buildings, b] }), { geometry: true });
        cbRef.current.setSelection({ kind: "building", id: b.id });
        setTool("select");
      },
      onMoveBuilding: (id, x, z) => cbRef.current.update((q) => ({ ...q, buildings: q.buildings.map((b) => (b.id === id ? { ...b, x, z } : b)) }), { geometry: true }),
      onMoveObstacle: (id, x, z) => cbRef.current.update((q) => ({ ...q, obstacles: q.obstacles.map((o) => (o.id === id ? { ...o, x, z } : o)) }), { geometry: true }),
      onPlaneClick: (planeId) => {
        const { project: p, update: up } = cbRef.current;
        const existing = p.arrays.find((a) => a.planeId === planeId);
        if (existing) {
          cbRef.current.setSelection({ kind: "array", id: existing.id });
          return;
        }
        const arr = newArray(planeId, reportRef.current.planes.find((x) => x.id === planeId), p.site.lat);
        up((q) => ({ ...q, arrays: [...q.arrays, arr] }), { geometry: true });
        cbRef.current.setSelection({ kind: "array", id: arr.id });
      },
      onPanelToggle: (arrayId, key) =>
        cbRef.current.update(
          (q) => ({
            ...q,
            arrays: q.arrays.map((a) => (a.id === arrayId ? { ...a, disabled: a.disabled.includes(key) ? a.disabled.filter((k) => k !== key) : [...a.disabled, key] } : a)),
          }),
          { geometry: true },
        ),
      onPlaceObstacle: (pt) => {
        const { obstacleKind: k, update: up } = cbRef.current;
        const def = OBSTACLES.find((o) => o.value === k)!;
        const o: Obstacle = { id: uid("o"), kind: k, x: pt.x, z: pt.z, baseY: Number(pt.y.toFixed(2)), height: def.height, size: def.size, rotation: 0 };
        up((q) => ({ ...q, obstacles: [...q.obstacles, o] }), { geometry: true });
        cbRef.current.setSelection({ kind: "obstacle", id: o.id });
      },
      onMeasure: (d) => setMeasure(d),
    });
    scene.current = s;
    s.frameAll();
    return () => {
      s.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    scene.current?.setTool(tool);
    if (tool !== "measure") setMeasure(null);
  }, [tool]);

  useEffect(() => {
    scene.current?.update(project, report, selection, heatmap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, selection, heatmap]);

  // sol
  const { lat, lon, tz } = project.site;
  const { month, day, hour } = project.date;
  const year = new Date().getFullYear();
  const sunNow = useMemo(() => sunPosition(localToUtc(year, month, day, hour, tz), lat, lon), [year, month, day, hour, tz, lat, lon]);
  const daylight = useMemo(() => sunriseSunset(lat, lon, tz, year, month, day), [lat, lon, tz, year, month, day]);
  useEffect(() => {
    const mk = (m: number, d: number, color: string, hours: boolean) => {
      const path = sunPath(lat, lon, tz, year, m, d, 10);
      return {
        pts: path.map((q) => q.pos.vector),
        color,
        hours: hours ? path.filter((q) => Math.abs(q.hour - Math.round(q.hour)) < 1e-6).map((q) => ({ h: Math.round(q.hour), v: q.pos.vector })) : undefined,
      };
    };
    scene.current?.setSun(sunNow.vector, [mk(month, day, "#f59e0b", true), mk(12, 21, "#fb7185", false), mk(6, 21, "#60a5fa", false)]);
  }, [sunNow, lat, lon, tz, year, month, day, report]);

  // animação do dia
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      update(
        (p) => {
          const start = daylight ? Math.floor(daylight.sunrise * 4) / 4 : 6;
          const end = daylight ? daylight.sunset : 18;
          const h = p.date.hour + 0.1 > end ? start : p.date.hour + 0.1;
          return { ...p, date: { ...p.date, hour: Number(h.toFixed(2)) } };
        },
        { history: false },
      );
    }, 60);
    return () => clearInterval(t);
  }, [playing, daylight, update]);

  // sombreamento automático (depois que a geometria para de mudar)
  const geoSig = useMemo(
    () => JSON.stringify([project.buildings, project.arrays, project.obstacles, project.module.length, project.module.width, project.site.lat]),
    [project.buildings, project.arrays, project.obstacles, project.module.length, project.module.width, project.site.lat],
  );
  const runShading = useCallback(async () => {
    const s = scene.current;
    if (!s) return;
    const p = cbRef.current.project;
    if (!reportRef.current.arrays.length) return;
    setShadeBusy(0);
    const res = await s.computeShading(p, reportRef.current, (f) => setShadeBusy(f));
    setShadeBusy(null);
    cbRef.current.update((q) => ({ ...q, shading: res }), { history: false });
  }, []);
  useEffect(() => {
    const t = setTimeout(runShading, 900);
    return () => clearTimeout(t);
  }, [geoSig, runShading]);

  // teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setTool("select");
        setSelection(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        remove(selection);
      }
      const map: Record<string, RoofTool> = { v: "select", r: "draw", p: "panels", o: "obstacle", m: "measure" };
      if (!e.ctrlKey && !e.metaKey && map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const remove = (sel: NonNullable<Selection>) => {
    if (sel.kind === "building") update((p) => ({ ...p, buildings: p.buildings.filter((b) => b.id !== sel.id), arrays: p.arrays.filter((a) => !a.planeId.startsWith(`${sel.id}:`)) }), { geometry: true });
    if (sel.kind === "obstacle") update((p) => ({ ...p, obstacles: p.obstacles.filter((o) => o.id !== sel.id) }), { geometry: true });
    if (sel.kind === "array") update((p) => ({ ...p, arrays: p.arrays.filter((a) => a.id !== sel.id) }), { geometry: true });
    setSelection(null);
  };

  const setDate = (d: Partial<Project["date"]>) => update((p) => ({ ...p, date: { ...p.date, ...d } }), { history: false });

  const building = selection?.kind === "building" ? project.buildings.find((b) => b.id === selection.id) : undefined;
  const obstacle = selection?.kind === "obstacle" ? project.obstacles.find((o) => o.id === selection.id) : undefined;
  const arrReport = selection?.kind === "array" ? report.arrays.find((a) => a.array.id === selection.id) : undefined;

  const setB = (patch: Partial<NonNullable<typeof building>>) => building && update((p) => ({ ...p, buildings: p.buildings.map((b) => (b.id === building.id ? { ...b, ...patch } : b)) }), { geometry: true });
  const setO = (patch: Partial<Obstacle>) => obstacle && update((p) => ({ ...p, obstacles: p.obstacles.map((o) => (o.id === obstacle.id ? { ...o, ...patch } : o)) }), { geometry: true });
  const setA = (patch: Partial<Project["arrays"][number]>) => arrReport && update((p) => ({ ...p, arrays: p.arrays.map((a) => (a.id === arrReport.array.id ? { ...a, ...patch } : a)) }), { geometry: true });

  const pickCity = (name: string) => {
    const c = CITIES.find((x) => `${x.name} - ${x.uf}` === name);
    if (!c) return;
    update((p) => ({ ...p, site: { ...p.site, name, lat: c.lat, lon: c.lon, tz: guessTimezone(c.lat, c.lon), hsp: c.hsp, monthlyGhi: null, hspSource: "Referência da capital (estimativa)" } }), { geometry: true });
  };
  const setCoords = (latV: number, lonV: number) => {
    const c = nearestCity(latV, lonV);
    update(
      (p) => ({
        ...p,
        site: { ...p.site, lat: latV, lon: lonV, tz: guessTimezone(latV, lonV), name: `${latV.toFixed(4)}, ${lonV.toFixed(4)}`, monthlyGhi: null, hsp: p.site.monthlyGhi ? c.hsp : p.site.hsp, hspSource: p.site.monthlyGhi ? `Estimativa (${c.name})` : p.site.hspSource },
      }),
      { geometry: true },
    );
  };
  const locate = () => {
    if (!navigator.geolocation) return toast.error("Localização indisponível neste aparelho.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords(Number(pos.coords.latitude.toFixed(5)), Number(pos.coords.longitude.toFixed(5)));
        toast.success("Localização aplicada. Busque o HSP na NASA para maior precisão.");
      },
      () => toast.error("Não foi possível obter a localização."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const nasa = async () => {
    setNasaBusy(true);
    const r = await fetchNasaPower(lat, lon);
    setNasaBusy(false);
    if (!r) return toast.error("Não consegui acessar a NASA POWER agora. Mantive o HSP atual.");
    update((p) => ({ ...p, site: { ...p.site, hsp: Number(r.annual.toFixed(2)), monthlyGhi: r.monthly, hspSource: "NASA POWER (climatologia mensal)" } }), { geometry: true });
    toast.success(`HSP ${n1(r.annual, 2)} kWh/m²/dia com série mensal da NASA.`);
  };

  const brand = brandById(project.structureBrand);
  const roofTypesUsed = [...new Set(report.arrays.map((a) => a.plane.roofType))];

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-150px)] lg:min-h-[620px] lg:flex-row">
      {/* Viewport */}
      <div className="relative h-[62dvh] min-h-[420px] overflow-hidden rounded-2xl bg-ink-900 shadow-lift ring-1 ring-ink-200 lg:h-auto lg:flex-1">
        <div ref={host} className="absolute inset-0" />

        {/* Ferramentas */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <ToolButton title="Selecionar / mover (V)" active={tool === "select"} onClick={() => setTool("select")}>
            <MousePointer2 className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Desenhar edificação — arraste no chão (R)" active={tool === "draw"} onClick={() => setTool("draw")}>
            <SquareDashed className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Módulos — clique numa água para preencher e em um módulo para tirar/colocar (P)" active={tool === "panels"} onClick={() => setTool("panels")}>
            <Grid3x3 className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Obstáculo — árvore, caixa d'água, prédio vizinho (O)" active={tool === "obstacle"} onClick={() => setTool("obstacle")}>
            <TreePine className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Medir distância (M)" active={tool === "measure"} onClick={() => setTool("measure")}>
            <Ruler className="h-[18px] w-[18px]" />
          </ToolButton>
          <div className="my-1 h-px bg-white/30" />
          <ToolButton title="Mapa de sombras nos módulos" active={heatmap} onClick={() => setHeatmap((v) => !v)}>
            <Flame className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Salvar imagem da cena" onClick={() => scene.current && onSnapshot(scene.current.snapshot())}>
            <Camera className="h-[18px] w-[18px]" />
          </ToolButton>
        </div>

        {/* Vistas */}
        <div className="absolute top-3 right-3 flex gap-1 rounded-xl bg-white/90 p-1 shadow-soft ring-1 ring-ink-200 backdrop-blur">
          {(
            [
              ["iso", "3D"],
              ["top", "Topo"],
              ["north", "Norte"],
              ["south", "Sul"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => scene.current?.view(k)} className="h-7 rounded-lg px-2 text-xs font-semibold text-ink-700 hover:bg-ink-100">
              {l}
            </button>
          ))}
        </div>

        {/* Opções da ferramenta */}
        {tool === "draw" && (
          <ToolHint>
            <span className="font-semibold">Arraste no chão</span> para criar a edificação. Tipo:
            <select value={drawRoof} onChange={(e) => setDrawRoof(e.target.value as RoofType)} className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-white">
              {ROOF_ORDER.map((r) => (
                <option key={r} value={r} className="text-ink-900">
                  {ROOF_TYPES[r].label}
                </option>
              ))}
            </select>
          </ToolHint>
        )}
        {tool === "panels" && <ToolHint>Clique numa água/laje/solo para preencher com módulos. Clique num módulo para tirar (ou recolocar).</ToolHint>}
        {tool === "obstacle" && (
          <ToolHint>
            Clique para posicionar:
            <select value={obstacleKind} onChange={(e) => setObstacleKind(e.target.value as Obstacle["kind"])} className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-white">
              {OBSTACLES.map((o) => (
                <option key={o.value} value={o.value} className="text-ink-900">
                  {o.label}
                </option>
              ))}
            </select>
          </ToolHint>
        )}
        {tool === "measure" && <ToolHint>{measure === null ? "Clique no ponto inicial e depois no final." : `Distância: ${n1(measure, 2)} m — clique para medir de novo.`}</ToolHint>}
        {tool === "select" && selection && (selection.kind === "building" || selection.kind === "obstacle") && <ToolHint>Arraste o item selecionado para mover · Delete remove</ToolHint>}

        {shadeBusy !== null && (
          <div className="absolute top-16 right-3 flex items-center gap-2 rounded-xl bg-ink-950/85 px-3 py-2 text-xs font-semibold text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando sombras {Math.round(shadeBusy * 100)}%
          </div>
        )}

        {/* Barra do sol */}
        <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/92 p-3 shadow-lift ring-1 ring-ink-200 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button onClick={() => setPlaying((v) => !v)} className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-sun-300" title={playing ? "Pausar" : "Animar o dia"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <select value={month} onChange={(e) => setDate({ month: Number(e.target.value), day: Math.min(day, 28) })} className="h-8 rounded-lg bg-white px-1.5 text-sm font-semibold ring-1 ring-ink-200">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input type="number" min={1} max={31} value={day} onChange={(e) => setDate({ day: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })} className="h-8 w-14 rounded-lg bg-white px-2 text-sm font-semibold ring-1 ring-ink-200" />
            <div className="flex gap-1">
              {(
                [
                  ["Inverno", 6, 21],
                  ["Verão", 12, 21],
                  ["Equinócio", 3, 20],
                ] as const
              ).map(([l, m, d]) => (
                <button key={l} onClick={() => setDate({ month: m, day: d })} className={cx("h-7 rounded-lg px-2 text-[11px] font-semibold ring-1", month === m && day === d ? "bg-sun-100 text-sun-700 ring-sun-300" : "text-ink-500 ring-ink-200 hover:bg-ink-50")}>
                  {l}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 text-[11.5px] text-ink-600">
              <span className="tnum flex items-center gap-1">
                <Sun className="h-3.5 w-3.5 text-amber-500" /> {sunNow.elevation > 0 ? `${n1(sunNow.elevation)}° alt · ${cardinal(sunNow.azimuth)} ${Math.round(sunNow.azimuth)}°` : "sol abaixo do horizonte"}
              </span>
              {daylight && (
                <span className="tnum hidden sm:inline">
                  ☀ {fmtHour(daylight.sunrise)} – {fmtHour(daylight.sunset)} · {n1(daylight.sunset - daylight.sunrise)} h de luz
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="tnum w-12 font-display text-lg font-semibold text-ink-950">{fmtHour(hour)}</span>
            <input type="range" min={4} max={20} step={0.05} value={hour} onChange={(e) => setDate({ hour: Number(e.target.value) })} className="h-2 flex-1 accent-amber-500" />
          </div>
        </div>
      </div>

      {/* Painel lateral */}
      <aside className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70 lg:w-[380px]">
        <div className="flex-1 overflow-y-auto">
          <Section title="Geração estimada" icon={<Zap className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Módulos" value={`${report.modules} × ${project.module.power} W`} sub={`${n1(report.kwp, 2)} kWp · ${n1(report.area)} m²`} tone="sun" />
              <Stat label="Média mensal" value={`${n0(report.monthlyAvg)} kWh`} sub={`${n0(report.annual)} kWh/ano`} tone="sun" />
              <Stat label="HSP do local" value={`${n1(project.site.hsp, 2)} h`} sub="plano horizontal" />
              <Stat label="HSP efetivo nos módulos" value={`${n1(report.effectiveHsp, 2)} h`} sub={`${n0(report.specificYield)} kWh/kWp/ano`} />
            </div>
            {report.kwp > 0 && (
              <div className="h-40">
                <ResponsiveContainer>
                  <BarChart data={report.monthly.map((v, i) => ({ m: MONTHS[i], v: Math.round(v) }))} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eee" />
                    <XAxis dataKey="m" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [`${n0(Number(v))} kWh`, "Geração"]} cursor={{ fill: "rgba(127,203,134,.12)" }} />
                    <Bar dataKey="v" fill="#7fcb86" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {report.arrays.length > 0 ? (
              <div className="overflow-hidden rounded-xl ring-1 ring-ink-100">
                <table className="w-full text-[11.5px]">
                  <thead className="bg-ink-50 text-ink-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold">Água</th>
                      <th className="px-1 py-1.5 text-right font-semibold">kWp</th>
                      <th className="px-1 py-1.5 text-right font-semibold">HSP</th>
                      <th className="px-1 py-1.5 text-right font-semibold">Rend.</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Sombra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.arrays.map((a) => (
                      <tr key={a.array.id} className={cx("cursor-pointer border-t border-ink-100 hover:bg-sun-50/50", selection?.id === a.array.id && "bg-sun-50")} onClick={() => setSelection({ kind: "array", id: a.array.id })}>
                        <td className="px-2 py-1.5">
                          <div className="font-semibold text-ink-800">{a.building.name}</div>
                          <div className="text-ink-500">
                            {Math.round(a.tilt)}° · {cardinal(a.azimuth)} · {a.modules} mód.
                          </div>
                        </td>
                        <td className="tnum px-1 text-right">{n1(a.kwp, 2)}</td>
                        <td className="tnum px-1 text-right">{n1(a.poaAnnual, 2)}</td>
                        <td className={cx("tnum px-1 text-right font-semibold", a.relative >= 0.95 ? "text-sun-700" : a.relative >= 0.85 ? "text-amber-600" : "text-rose-600")}>{Math.round(a.relative * 100)}%</td>
                        <td className={cx("tnum px-2 text-right", a.shadingLoss > 0.05 ? "font-semibold text-rose-600" : "text-ink-600")}>{project.shading[a.array.id] ? `${n1(a.shadingLoss * 100)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl bg-ink-50 p-3 text-[12.5px] text-ink-600">
                Use a ferramenta <Grid3x3 className="inline h-3.5 w-3.5" /> <b>Módulos</b> e clique numa água do telhado para posicionar as placas.
              </p>
            )}
            <p className="text-[11.5px] leading-snug text-ink-500">
              Orientação ótima neste local: <b>{report.optimal.tilt}°</b> voltado para o <b>{cardinal(report.optimal.azimuth) === "N" ? "Norte" : "Sul"}</b> ({n1(report.optimal.annual, 2)} kWh/m²/dia). “Rend.” compara cada água com
              essa orientação ideal; “Sombra” vem do traçado de raios ao longo do ano.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={runShading} className="flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-200">
                <Eye className="h-3.5 w-3.5" /> Recalcular sombras
              </button>
              <span className="flex-1 text-right text-[11.5px] text-ink-500" title="Performance ratio: perdas elétricas, temperatura e sujeira (a sombra é calculada à parte)">
                PR
              </span>
              <Num value={project.performanceRatio * 100} onChange={(v) => update((p) => ({ ...p, performanceRatio: Math.max(0.5, Math.min(0.95, v / 100)) }))} suffix="%" digits={0} className="w-20" />
            </div>
          </Section>

          {selectionPanel()}

          <Section title="Localização e irradiação" icon={<MapPin className="h-4 w-4" />} defaultOpen={false}>
            <F label="Cidade de referência">
              <Sel value={CITIES.some((c) => `${c.name} - ${c.uf}` === project.site.name) ? project.site.name : ""} onChange={pickCity} options={[{ value: "", label: "— coordenadas personalizadas —" }, ...CITIES.map((c) => ({ value: `${c.name} - ${c.uf}`, label: `${c.name} - ${c.uf}` }))]} />
            </F>
            <div className="grid grid-cols-3 gap-2">
              <F label="Latitude">
                <Num value={lat} onChange={(v) => setCoords(v, lon)} digits={5} min={-60} max={60} />
              </F>
              <F label="Longitude">
                <Num value={lon} onChange={(v) => setCoords(lat, v)} digits={5} min={-180} max={180} />
              </F>
              <F label="Fuso (UTC)">
                <Num value={tz} onChange={(v) => update((p) => ({ ...p, site: { ...p.site, tz: v } }), { history: false })} digits={1} min={-12} max={14} />
              </F>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={locate} className="flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-200">
                <LocateFixed className="h-3.5 w-3.5" /> Minha localização
              </button>
              <button onClick={nasa} disabled={nasaBusy} className="flex h-8 items-center gap-1.5 rounded-lg bg-sun-100 px-2.5 text-xs font-semibold text-sun-700 hover:bg-sun-200 disabled:opacity-60">
                {nasaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Satellite className="h-3.5 w-3.5" />} HSP real (NASA POWER)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="HSP médio anual" hint={project.site.hspSource}>
                <Num value={project.site.hsp} onChange={(v) => update((p) => ({ ...p, site: { ...p.site, hsp: v, monthlyGhi: null, hspSource: "Informado manualmente" } }))} suffix="h/dia" min={1} max={8} />
              </F>
              <F label="Albedo do entorno">
                <Sel
                  value={project.site.albedo}
                  onChange={(v) => update((p) => ({ ...p, site: { ...p.site, albedo: v } }))}
                  options={[
                    { value: 0.15, label: "Grama/terra (0,15)" },
                    { value: 0.2, label: "Padrão (0,20)" },
                    { value: 0.3, label: "Concreto (0,30)" },
                    { value: 0.5, label: "Telhado branco (0,50)" },
                  ]}
                />
              </F>
            </div>
            {project.site.monthlyGhi && (
              <div className="grid grid-cols-6 gap-1 text-center text-[10.5px]">
                {project.site.monthlyGhi.map((v, i) => (
                  <div key={i} className="rounded-md bg-ink-50 py-1">
                    <div className="text-ink-400">{MONTHS[i]}</div>
                    <div className="tnum font-semibold text-ink-800">{n1(v, 2)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Módulo e estrutura" icon={<Box className="h-4 w-4" />} defaultOpen={false}>
            <F label="Modelo do módulo">
              <Sel
                value={MODULE_PRESETS.findIndex((m) => m.brand === project.module.brand)}
                onChange={(i) => i >= 0 && update((p) => ({ ...p, module: MODULE_PRESETS[i] }), { geometry: true })}
                options={[{ value: -1, label: "Personalizado" }, ...MODULE_PRESETS.map((m, i) => ({ value: i, label: m.brand }))]}
              />
            </F>
            <div className="grid grid-cols-3 gap-2">
              <F label="Potência">
                <Num value={project.module.power} onChange={(v) => update((p) => ({ ...p, module: { ...p.module, power: v, brand: "Personalizado" } }))} suffix="W" digits={0} />
              </F>
              <F label="Comprimento">
                <Num value={project.module.length} onChange={(v) => update((p) => ({ ...p, module: { ...p.module, length: v, brand: "Personalizado" } }), { geometry: true })} suffix="m" digits={3} min={0.5} max={3} />
              </F>
              <F label="Largura">
                <Num value={project.module.width} onChange={(v) => update((p) => ({ ...p, module: { ...p.module, width: v, brand: "Personalizado" } }), { geometry: true })} suffix="m" digits={3} min={0.5} max={2} />
              </F>
              <F label="Voc">
                <Num value={project.module.voc} onChange={(v) => update((p) => ({ ...p, module: { ...p.module, voc: v } }))} suffix="V" />
              </F>
              <F label="Vmp">
                <Num value={project.module.vmp} onChange={(v) => update((p) => ({ ...p, module: { ...p.module, vmp: v } }))} suffix="V" />
              </F>
              <F label="Isc">
                <Num value={project.module.isc} onChange={(v) => update((p) => ({ ...p, module: { ...p.module, isc: v } }))} suffix="A" />
              </F>
            </div>
            <F label="Fabricante da estrutura">
              <Sel value={project.structureBrand} onChange={(v) => update((p) => ({ ...p, structureBrand: v }))} options={STRUCTURE_BRANDS.map((b) => ({ value: b.id, label: b.name }))} />
            </F>
            {roofTypesUsed.map((t) => (
              <div key={t} className="rounded-xl bg-ink-50 p-3 text-[12px] text-ink-600">
                <div className="font-semibold text-ink-800">
                  {ROOF_TYPES[t].label}: {brand.lines[t] ?? "linha padrão"}
                </div>
                <p className="mt-1">{ROOF_TYPES[t].structure}</p>
              </div>
            ))}
            <p className="text-[11.5px] text-ink-500">{brand.notes} Trilho padrão de {n1(brand.railLength, 2)} m. Confirme vãos e códigos no catálogo do fabricante.</p>
            {roofTypesUsed.some((t) => t === "fibrocimento" || t === "colonial") && (
              <F label="Espaçamento das terças / caibros" hint="As fixações sempre caem sobre o apoio — o app pula apoios até o vão máximo do trilho.">
                <Num value={project.supportSpacing} onChange={(v) => update((p) => ({ ...p, supportSpacing: v }))} suffix="m" min={0.3} max={3} />
              </F>
            )}
          </Section>

          <Section title="Materiais da estrutura" icon={<Copy className="h-4 w-4" />} defaultOpen={false} badge={<span className="rounded-full bg-ink-100 px-2 text-[11px] font-semibold text-ink-600">{report.bom.length}</span>}>
            {report.bom.length ? (
              <ul className="divide-y divide-ink-100 text-[12.5px]">
                {report.bom.map((l) => (
                  <li key={l.item} className={cx("flex items-start justify-between gap-3 py-1.5", l.item.startsWith("⚠") && "text-amber-700")}>
                    <span>
                      {l.item}
                      {l.note && <span className="block text-[11px] text-ink-400">{l.note}</span>}
                    </span>
                    {l.qty > 0 && (
                      <span className="tnum shrink-0 font-semibold text-ink-900">
                        {l.qty} {l.unit}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-ink-500">Posicione módulos para gerar a lista de materiais.</p>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );

  function selectionPanel() {
    if (building) {
      const info = ROOF_TYPES[building.roofType];
      const pctSlope = Math.tan((building.pitch * Math.PI) / 180) * 100;
      return (
        <Section title={building.roofType === "solo" ? "Área de solo" : "Edificação"} icon={<Box className="h-4 w-4" />}>
          <F label="Nome">
            <Txt value={building.name} onChange={(v) => setB({ name: v })} />
          </F>
          <F label="Cobertura / instalação">
            <Chips
              value={building.roofType}
              onChange={(t) =>
                setB({
                  roofType: t,
                  pitch: ROOF_TYPES[t].defaultPitch,
                  roofShape: t === "laje" || t === "solo" ? "plano" : building.roofShape === "plano" ? "duas-aguas" : building.roofShape,
                  overhang: t === "laje" || t === "solo" ? 0 : building.overhang || 0.5,
                  parapet: t === "laje" ? building.parapet || 0.6 : 0,
                  height: t === "solo" ? 0 : building.height || 3,
                })
              }
              options={ROOF_ORDER.map((r) => ({ value: r, label: ROOF_TYPES[r].short, title: ROOF_TYPES[r].description }))}
            />
          </F>
          {!info.flat && (
            <F label="Formato do telhado">
              <Chips value={building.roofShape} onChange={(s) => setB({ roofShape: s })} options={SHAPES} />
            </F>
          )}
          <div className="grid grid-cols-3 gap-2">
            <F label="Comprimento">
              <Num value={building.length} onChange={(v) => setB({ length: v })} suffix="m" min={1} max={200} step={0.5} />
            </F>
            <F label="Largura">
              <Num value={building.width} onChange={(v) => setB({ width: v })} suffix="m" min={1} max={200} step={0.5} />
            </F>
            {building.roofType !== "solo" && (
              <F label="Paredes (altura)">
                <Num value={building.height} onChange={(v) => setB({ height: v })} suffix="m" min={2} max={60} step={0.5} />
              </F>
            )}
          </div>
          {building.roofType !== "solo" && (
            <div className="flex flex-wrap gap-1">
              {[2.6, 3, 5.6, 8.4].map((h) => (
                <button key={h} onClick={() => setB({ height: h })} className="h-7 rounded-lg px-2 text-[11px] font-semibold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50">
                  {h === 2.6 ? "Térreo baixo" : h === 3 ? "Térreo" : h === 5.6 ? "Sobrado" : "3 pavimentos"}
                </button>
              ))}
            </div>
          )}
          {!info.flat && (
            <div className="grid grid-cols-2 gap-2">
              <F label={`Inclinação (${n0(pctSlope)}%)`} hint={`${info.label}: ${info.minPitch}°–${info.maxPitch}°`}>
                <Num value={building.pitch} onChange={(v) => setB({ pitch: v })} suffix="°" min={0} max={60} step={1} digits={1} />
              </F>
              <F label="Beiral">
                <Num value={building.overhang} onChange={(v) => setB({ overhang: v })} suffix="m" min={0} max={2} step={0.1} />
              </F>
            </div>
          )}
          {building.roofType === "laje" && (
            <F label="Platibanda">
              <Num value={building.parapet} onChange={(v) => setB({ parapet: v })} suffix="m" min={0} max={2} step={0.1} />
            </F>
          )}
          <F label={`Rotação: ${n1(building.rotation, 0)}° — gire para alinhar com o lote real`}>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setB({ rotation: ((building.rotation + 90 + 180) % 360) - 180 })} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-ink-200 hover:bg-ink-50" title="+90°">
                <RotateCcw className="h-4 w-4" />
              </button>
              <input type="range" min={-180} max={180} step={1} value={building.rotation} onChange={(e) => setB({ rotation: Number(e.target.value) })} className="flex-1 accent-sun-600" />
              <button onClick={() => setB({ rotation: ((building.rotation - 90 + 540) % 360) - 180 })} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-ink-200 hover:bg-ink-50" title="−90°">
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          </F>
          <div className="grid grid-cols-2 gap-2">
            <F label="Posição X (leste)">
              <Num value={building.x} onChange={(v) => setB({ x: v })} suffix="m" step={0.5} />
            </F>
            <F label="Posição Z (sul)">
              <Num value={building.z} onChange={(v) => setB({ z: v })} suffix="m" step={0.5} />
            </F>
          </div>
          {building.roofType !== "solo" && (
            <F label="Cor das paredes">
              <div className="flex gap-1.5">
                {["#f3efe6", "#e8dcc6", "#d9e4ea", "#f1d9c9", "#c9c9c9", "#fff"].map((c) => (
                  <button key={c} onClick={() => setB({ wallColor: c })} className={cx("h-7 w-7 rounded-full ring-2", building.wallColor === c ? "ring-sun-500" : "ring-ink-200")} style={{ background: c }} />
                ))}
              </div>
            </F>
          )}
          <div className="rounded-xl bg-sun-50/70 p-3 text-[12px] text-ink-700 ring-1 ring-sun-200/60">
            <div className="font-semibold text-ink-900">Fixação: {info.label}</div>
            <p className="mt-0.5">{info.structure}</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink-600">
              {info.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const copy = { ...building, id: uid("b"), name: `${building.name} (cópia)`, x: building.x + building.length + 2 };
                update((p) => ({ ...p, buildings: [...p.buildings, copy] }), { geometry: true });
                setSelection({ kind: "building", id: copy.id });
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-200"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </button>
            <button onClick={() => remove({ kind: "building", id: building.id })} className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
          </div>
        </Section>
      );
    }
    if (obstacle) {
      return (
        <Section title="Obstáculo" icon={<TreePine className="h-4 w-4" />}>
          <F label="Tipo">
            <Sel value={obstacle.kind} onChange={(k) => setO({ kind: k })} options={OBSTACLES.map((o) => ({ value: o.value, label: o.label }))} />
          </F>
          <div className="grid grid-cols-3 gap-2">
            <F label="Altura">
              <Num value={obstacle.height} onChange={(v) => setO({ height: v })} suffix="m" min={0.2} max={120} step={0.5} />
            </F>
            <F label={obstacle.kind === "arvore" ? "Raio da copa" : "Largura"}>
              <Num value={obstacle.size} onChange={(v) => setO({ size: v })} suffix="m" min={0.1} max={100} step={0.5} />
            </F>
            <F label="Apoio (base)">
              <Num value={obstacle.baseY} onChange={(v) => setO({ baseY: v })} suffix="m" min={0} max={100} step={0.5} />
            </F>
          </div>
          <F label={`Rotação ${obstacle.rotation}°`}>
            <input type="range" min={-180} max={180} value={obstacle.rotation} onChange={(e) => setO({ rotation: Number(e.target.value) })} className="w-full accent-sun-600" />
          </F>
          <button onClick={() => remove({ kind: "obstacle", id: obstacle.id })} className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </Section>
      );
    }
    if (arrReport) {
      const a = arrReport.array;
      const flat = arrReport.plane.flat;
      return (
        <Section title={`Módulos · ${arrReport.building.name} — ${arrReport.plane.label}`} icon={<Grid3x3 className="h-4 w-4" />}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Módulos" value={arrReport.modules} sub={`${n1(arrReport.kwp, 2)} kWp`} tone="sun" />
            <Stat label="Orientação" value={`${cardinal(arrReport.azimuth)} ${Math.round(arrReport.azimuth)}°`} sub={`${n1(arrReport.tilt)}° de inclinação`} />
            <Stat label="Geração" value={`${n0(arrReport.annual / 12)}`} sub="kWh/mês" />
            <Stat label="HSP no plano" value={n1(arrReport.poaAnnual, 2)} sub={`sem sombra ${n1(arrReport.poaNoShade, 2)}`} />
            <Stat label="Rendimento" value={`${Math.round(arrReport.relative * 100)}%`} sub="vs. orientação ótima" tone={arrReport.relative < 0.85 ? "warn" : undefined} />
            <Stat label="Perda por sombra" value={project.shading[a.id] ? `${n1(arrReport.shadingLoss * 100)}%` : "—"} tone={arrReport.shadingLoss > 0.05 ? "bad" : undefined} />
          </div>
          <F label="Disposição">
            <Chips
              value={a.orientation}
              onChange={(v) => setA({ orientation: v, disabled: [] })}
              options={[
                { value: "retrato", label: "Retrato" },
                { value: "paisagem", label: "Paisagem" },
              ]}
            />
          </F>
          {flat && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <F label="Inclinação da estrutura">
                  <Num value={a.rackTilt} onChange={(v) => setA({ rackTilt: v })} suffix="°" min={0} max={60} step={1} digits={0} />
                </F>
                <F label="Módulos por mesa">
                  <Sel value={a.stack} onChange={(v) => setA({ stack: v, disabled: [] })} options={[1, 2, 3, 4].map((x) => ({ value: x, label: `${x} (${x}${a.orientation === "retrato" ? "P" : "L"})` }))} />
                </F>
              </div>
              <F label={`Direção das placas: ${cardinal(a.rackAzimuth)} ${a.rackAzimuth}°`}>
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-ink-400" />
                  <input type="range" min={0} max={359} value={a.rackAzimuth} onChange={(e) => setA({ rackAzimuth: Number(e.target.value), disabled: [] })} className="flex-1 accent-sun-600" />
                  <button onClick={() => setA({ rackAzimuth: project.site.lat < 0 ? 0 : 180, disabled: [] })} className="h-7 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
                    {project.site.lat < 0 ? "Norte" : "Sul"}
                  </button>
                </div>
              </F>
              <F label="Distância entre fileiras" hint={a.rowSpacing > 0 ? "Manual" : `Automática: ${n1(arrReport.layout.rowPitch, 2)} m (sem sombra das 9h às 15h no inverno)`}>
                <div className="flex items-center gap-2">
                  <Num value={a.rowSpacing > 0 ? a.rowSpacing : arrReport.layout.rowPitch} onChange={(v) => setA({ rowSpacing: v })} suffix="m" min={0.5} max={20} step={0.1} />
                  {a.rowSpacing > 0 && (
                    <button onClick={() => setA({ rowSpacing: 0 })} className="h-9 shrink-0 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
                      Auto
                    </button>
                  )}
                </div>
              </F>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <F label="Afastamento das bordas">
              <Num value={a.margin} onChange={(v) => setA({ margin: v, disabled: [] })} suffix="m" min={0} max={3} step={0.05} />
            </F>
            <F label="Folga entre módulos">
              <Num value={a.gap * 100} onChange={(v) => setA({ gap: v / 100, disabled: [] })} suffix="cm" min={0} max={50} step={1} digits={1} />
            </F>
            <F label="Deslocar ↔">
              <Num value={a.offsetU} onChange={(v) => setA({ offsetU: v })} suffix="m" step={0.05} min={-5} max={5} />
            </F>
            <F label="Deslocar ↕">
              <Num value={a.offsetV} onChange={(v) => setA({ offsetV: v })} suffix="m" step={0.05} min={-5} max={5} />
            </F>
          </div>
          <p className="text-[11.5px] text-ink-500">
            Com a ferramenta <b>Módulos</b>, clique numa placa para tirar ou recolocar (as removidas aparecem em verde transparente enquanto este conjunto está selecionado).
          </p>
          <div className="flex gap-2">
            {a.disabled.length > 0 && (
              <button onClick={() => setA({ disabled: [] })} className="flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-200">
                <RotateCcw className="h-3.5 w-3.5" /> Recolocar {a.disabled.length}
              </button>
            )}
            <button onClick={() => remove({ kind: "array", id: a.id })} className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
              <Trash2 className="h-3.5 w-3.5" /> Remover módulos
            </button>
          </div>
        </Section>
      );
    }
    return (
      <Section title="Como montar" icon={<Crosshair className="h-4 w-4" />}>
        <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] text-ink-600">
          <li>
            <b>Desenhar</b> <SquareDashed className="inline h-3.5 w-3.5" />: arraste no chão para subir as paredes; escolha fibrocimento, metálico, laje, colonial ou solo.
          </li>
          <li>Selecione a edificação para ajustar medidas, altura, formato do telhado, inclinação e girar para o norte real.</li>
          <li>
            <b>Módulos</b> <Grid3x3 className="inline h-3.5 w-3.5" />: clique na água para preencher; clique numa placa para tirar.
          </li>
          <li>
            <b>Obstáculos</b> <TreePine className="inline h-3.5 w-3.5" />: árvores, caixa d&apos;água e prédios vizinhos entram na análise de sombra.
          </li>
          <li>Mova a hora e a data para ver o sol e as sombras. Arraste com o botão direito para deslocar a câmera.</li>
        </ol>
        <div className="flex flex-wrap gap-1.5">
          {project.buildings.map((b) => (
            <button key={b.id} onClick={() => setSelection({ kind: "building", id: b.id })} className="h-7 rounded-lg bg-ink-50 px-2 text-[11.5px] font-semibold text-ink-700 ring-1 ring-ink-200 hover:bg-white">
              {b.name}
            </button>
          ))}
        </div>
      </Section>
    );
  }
}

function ToolHint({ children }: { children: React.ReactNode }) {
  return <div className="absolute top-3 left-16 max-w-[calc(100%-200px)] rounded-xl bg-ink-950/85 px-3 py-2 text-[12px] text-white shadow-lift backdrop-blur">{children}</div>;
}
