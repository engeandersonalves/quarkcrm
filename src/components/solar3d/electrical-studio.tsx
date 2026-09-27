"use client";

import { PanelTop, AlertTriangle, ArrowDown, ArrowUp, BatteryCharging, Cable, Camera, CheckCircle2, CircleSlash, Cpu, Focus, Plus, ScanEye, ShieldCheck, Trash2, XCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";
import { BoardScene, WIRE, type BoardItem, type BoardSelection } from "./board-scene";
import type { Update } from "./roof-studio";
import { Chips, F, Num, Section, Sel, Stat, Toggle, ToolButton, Txt, n1 } from "./ui-bits";
import type { ElectricalReport } from "@/lib/solar3d/board";
import {
  BOARD_SIZES,
  BREAKERS,
  CIRCUIT_KIND,
  CONDULETE_INFO,
  CONNECTION_LABEL,
  INVERTER_BRANDS,
  INVERTER_SIZES,
  METHOD_LABEL,
  allowedConnections,
  fmt,
  inverterPreset,
  suggestInverterKw,
  type Connection,
  type System,
} from "@/lib/solar3d/electrical";
import { uid, type Device, type DeviceKind, type Electrical, type ExtraCircuit, type Project, type ProjectReport } from "@/lib/solar3d/project";

const DEVICE_LABEL: Record<DeviceKind, string> = {
  geral: "Disjuntor geral",
  disjuntor: "Disjuntor",
  dr: "Interruptor DR",
  dps: "DPS",
  "dps-cc": "DPS CC",
  "seccionadora-cc": "Seccionadora CC",
  reserva: "Espaço reserva",
};

export function ElectricalStudio({
  project,
  report,
  elec,
  update,
  onSnapshot,
}: {
  project: Project;
  report: ProjectReport;
  elec: ElectricalReport;
  update: Update;
  onSnapshot: (img: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BoardScene | null>(null);
  const [selection, setSelection] = useState<BoardSelection>(null);
  const [xray, setXray] = useState(false);
  const [cover, setCover] = useState(false);
  const e = project.electrical;
  const cb = useRef({ update, setSelection });
  cb.current = { update, setSelection };

  useEffect(() => {
    if (!host.current) return;
    const s = new BoardScene(host.current, {
      onSelect: (sel) => cb.current.setSelection(sel),
      onMoveItem: (id: BoardItem, x, y) =>
        cb.current.update((p) => {
          const el = p.electrical;
          const half = el.wallWidth / 2 - 0.2;
          const pos = { x: Math.max(-half, Math.min(half, x)), y: Math.max(0.3, Math.min(2.7, y)) };
          return { ...p, electrical: id === "inverter" ? { ...el, inverter: { ...el.inverter, ...pos } } : id === "board" ? { ...el, board: { ...el.board, ...pos } } : { ...el, ev: { ...el.ev, ...pos } } };
        }),
    });
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.update(project, elec, selection, xray, cover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elec, selection, xray, cover]);

  const setE = (patch: Partial<Electrical>) => update((p) => ({ ...p, electrical: { ...p.electrical, ...patch } }));
  const setGrid = (patch: Partial<Electrical["grid"]>) =>
    update((p) => {
      const grid = { ...p.electrical.grid, ...patch };
      const allowed = allowedConnections(grid.system);
      const fix = (c: Connection) => {
        // equipamentos monofásicos de 220 V: F-F na rede 127/220 e F-N na rede 220/380
        if (patch.vFN === 220 && c === "ff") c = "fn";
        if (patch.vFN === 127 && c === "fn" && allowed.includes("ff")) c = "ff";
        return allowed.includes(c) ? c : allowed[allowed.length - 1];
      };
      return { ...p, electrical: { ...p.electrical, grid, inverter: { ...p.electrical.inverter, connection: fix(p.electrical.inverter.connection) }, ev: { ...p.electrical.ev, connection: fix(p.electrical.ev.connection) } } };
    });
  const setInv = (patch: Partial<Electrical["inverter"]>) => update((p) => ({ ...p, electrical: { ...p.electrical, inverter: { ...p.electrical.inverter, ...patch } } }));
  const setEv = (patch: Partial<Electrical["ev"]>) => update((p) => ({ ...p, electrical: { ...p.electrical, ev: { ...p.electrical.ev, ...patch } } }));
  const setBoard = (patch: Partial<Electrical["board"]>) => update((p) => ({ ...p, electrical: { ...p.electrical, board: { ...p.electrical.board, ...patch } } }));

  /** Edição manual dos dispositivos: congela a montagem automática. */
  const editDevices = (fn: (list: Device[]) => Device[]) =>
    update((p) => {
      const base = p.electrical.autoDevices || !p.electrical.devices.length ? elec.devices.map((d) => ({ ...d })) : p.electrical.devices;
      return { ...p, electrical: { ...p.electrical, autoDevices: false, devices: fn(base) } };
    });
  const selDevice = selection?.kind === "device" ? elec.devices.find((d) => d.id === selection.id) : undefined;
  const allowed = allowedConnections(e.grid.system);
  const suggested = suggestInverterKw(report.kwp);
  const ratio = e.inverter.powerKw > 0 ? report.kwp / e.inverter.powerKw : 0;
  const errors = elec.checks.filter((c) => c.level === "error").length;
  const warns = elec.checks.filter((c) => c.level === "warn").length;
  const circuitOptions = [
    { value: "", label: "— nenhum —" },
    { value: "geral", label: "Geral / proteção" },
    { value: "inversor", label: "Inversor FV" },
    ...(elec.ev ? [{ value: "ve", label: "Carregador VE" }] : []),
    ...e.extra.map((c) => ({ value: c.id, label: c.name })),
  ];

  const connOptions = (list: Connection[]) => list.map((c) => ({ value: c, label: `${CONNECTION_LABEL[c]} (${c === "fn" ? e.grid.vFN : e.grid.vFN === 127 ? 220 : 380} V)` }));

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-150px)] lg:min-h-[620px] lg:flex-row">
      <div className="relative h-[62dvh] min-h-[420px] overflow-hidden rounded-2xl bg-ink-900 shadow-lift ring-1 ring-ink-200 lg:h-auto lg:flex-1">
        <div ref={host} className="absolute inset-0" />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <ToolButton title="Ver a parede toda" onClick={() => scene.current?.focus("all")}>
            <Focus className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Aproximar do quadro" onClick={() => scene.current?.focus("board")}>
            <Cpu className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Aproximar do inversor" onClick={() => scene.current?.focus("inverter")}>
            <Zap className="h-[18px] w-[18px]" />
          </ToolButton>
          {e.ev.enabled && (
            <ToolButton title="Aproximar do carregador" onClick={() => scene.current?.focus("ev")}>
              <BatteryCharging className="h-[18px] w-[18px]" />
            </ToolButton>
          )}
          <div className="my-1 h-px bg-white/30" />
          <ToolButton title="Raio-X: ver os cabos dentro dos eletrodutos" active={xray} onClick={() => setXray((v) => !v)}>
            <ScanEye className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Espelho (tampa interna) — esconder/mostrar a fiação" active={cover} onClick={() => setCover((v) => !v)}>
            <PanelTop className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton title="Salvar imagem" onClick={() => scene.current && onSnapshot(scene.current.snapshot())}>
            <Camera className="h-[18px] w-[18px]" />
          </ToolButton>
        </div>
        <div className="absolute top-3 left-16 max-w-[calc(100%-80px)] rounded-xl bg-ink-950/85 px-3 py-2 text-[12px] text-white shadow-lift backdrop-blur">
          Clique no inversor, quadro ou carregador para selecionar e <b>arraste na parede</b> para reposicionar — eletrodutos e conduletes se refazem sozinhos. Clique num disjuntor para editar.
        </div>
        <div className="absolute right-3 bottom-3 flex flex-wrap gap-1.5 rounded-xl bg-white/92 p-2 text-[10.5px] font-semibold text-ink-700 shadow-soft ring-1 ring-ink-200">
          {(
            [
              ["Fase L1", WIRE.L1],
              ["Fase L2", WIRE.L2],
              ["Fase L3", WIRE.L3],
              ["Neutro", WIRE.N],
              ["Terra (PE)", WIRE.PE],
              ["CC +", WIRE.DCp],
            ] as const
          ).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full ring-1 ring-ink-300" style={{ background: c }} /> {l}
            </span>
          ))}
        </div>
      </div>

      <aside className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70 lg:w-[400px]">
        <div className="flex-1 overflow-y-auto">
          <Section
            title="Verificações"
            icon={<ShieldCheck className="h-4 w-4" />}
            badge={
              <span className={cx("rounded-full px-2 text-[11px] font-semibold", errors ? "bg-rose-100 text-rose-700" : warns ? "bg-amber-100 text-amber-700" : "bg-sun-100 text-sun-700")}>
                {errors ? `${errors} erro(s)` : warns ? `${warns} alerta(s)` : "tudo certo"}
              </span>
            }
          >
            <ul className="space-y-1.5 text-[12.5px]">
              {elec.checks.map((c, i) => (
                <li key={i} className="flex gap-2">
                  {c.level === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" /> : c.level === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                  <span className="text-ink-700">{c.text}</span>
                </li>
              ))}
            </ul>
          </Section>

          {selDevice && (
            <Section title={`${DEVICE_LABEL[selDevice.kind]} — ${selDevice.label}`} icon={<Cpu className="h-4 w-4" />}>
              <DeviceEditor
                d={selDevice}
                circuitOptions={circuitOptions}
                onChange={(patch) => editDevices((list) => list.map((x) => (x.id === selDevice.id ? { ...x, ...patch } : x)))}
                onMove={(dir) =>
                  editDevices((list) => {
                    const i = list.findIndex((x) => x.id === selDevice.id);
                    const j = i + dir;
                    if (i < 0 || j < 0 || j >= list.length) return list;
                    const c = [...list];
                    [c[i], c[j]] = [c[j], c[i]];
                    return c;
                  })
                }
                onDelete={() => {
                  editDevices((list) => list.filter((x) => x.id !== selDevice.id));
                  setSelection(null);
                }}
              />
            </Section>
          )}

          <Section title="Entrada de energia" icon={<Zap className="h-4 w-4" />}>
            <F label="Tipo de ligação">
              <Chips
                value={e.grid.system}
                onChange={(v: System) => setGrid({ system: v })}
                options={[
                  { value: "mono", label: "Monofásico" },
                  { value: "bi", label: "Bifásico" },
                  { value: "tri", label: "Trifásico" },
                ]}
              />
            </F>
            <div className="grid grid-cols-3 gap-2">
              <F label="Tensão">
                <Sel
                  value={e.grid.vFN}
                  onChange={(v) => setGrid({ vFN: v })}
                  options={[
                    { value: 127, label: "127/220 V" },
                    { value: 220, label: "220/380 V" },
                  ]}
                />
              </F>
              <F label="Disjuntor do padrão">
                <Sel value={e.grid.mainBreaker} onChange={(v) => setGrid({ mainBreaker: v })} options={BREAKERS.filter((b) => b >= 32 && b <= 250).map((b) => ({ value: b, label: `${b} A` }))} />
              </F>
              <F label="Aterramento">
                <Sel
                  value={e.grid.earthing}
                  onChange={(v) => setGrid({ earthing: v })}
                  options={[
                    { value: "TN-S", label: "TN-S" },
                    { value: "TN-C-S", label: "TN-C-S" },
                    { value: "TT", label: "TT" },
                  ]}
                />
              </F>
            </div>
            <p className="text-[11.5px] text-ink-500">Potência disponibilizada ≈ {n1(elec.availableKw)} kW — o inversor não pode passar disso sem aumento de carga (REN 1000).</p>
          </Section>

          <Section title="Inversor" icon={<Cpu className="h-4 w-4" />}>
            {report.kwp > 0 && (
              <div className={cx("rounded-xl p-2.5 text-[12px] ring-1", ratio > 1.4 || ratio < 0.9 ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-sun-50 text-ink-700 ring-sun-200")}>
                Gerador de <b>{n1(report.kwp, 2)} kWp</b> no telhado → relação CC/CA <b>{n1(ratio, 2)}</b>. Sugerido: <b>{fmt(suggested)} kW</b>.
                {e.inverter.powerKw !== suggested && (
                  <button onClick={() => setInv({ ...inverterPreset(suggested, e.inverter.connection), model: `Inversor ${fmt(suggested)} kW` })} className="ml-1 font-semibold text-sun-700 underline">
                    Aplicar
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <F label="Marca">
                <Sel value={e.inverter.brand} onChange={(v) => setInv({ brand: v })} options={INVERTER_BRANDS.map((b) => ({ value: b, label: b }))} />
              </F>
              <F label="Modelo">
                <Txt value={e.inverter.model} onChange={(v) => setInv({ model: v })} />
              </F>
              <F label="Potência CA">
                <Sel value={e.inverter.powerKw} onChange={(v) => setInv({ ...inverterPreset(v, e.inverter.connection), model: e.inverter.model })} options={[...new Set([...INVERTER_SIZES, e.inverter.powerKw])].sort((a, b) => a - b).map((s) => ({ value: s, label: `${fmt(s)} kW` }))} />
              </F>
              <F label="Ligação na rede">
                <Sel value={e.inverter.connection} onChange={(v) => setInv({ connection: v, ...(v === "3f" ? { vdcMax: 1100, mpptMin: 180, mpptMax: 1000 } : {}) })} options={connOptions(allowed)} />
              </F>
              <F label="Corrente máx. saída" hint="0 = calcular por P/V">
                <Num value={e.inverter.maxCurrent} onChange={(v) => setInv({ maxCurrent: v })} suffix="A" min={0} max={400} digits={1} />
              </F>
              <F label="MPPTs × strings">
                <div className="flex gap-1">
                  <Num value={e.inverter.mppts} onChange={(v) => setInv({ mppts: Math.round(v) })} min={1} max={12} digits={0} />
                  <Num value={e.inverter.stringsPerMppt} onChange={(v) => setInv({ stringsPerMppt: Math.round(v) })} min={1} max={4} digits={0} />
                </div>
              </F>
              <F label="Tensão CC máx.">
                <Num value={e.inverter.vdcMax} onChange={(v) => setInv({ vdcMax: v })} suffix="V" digits={0} />
              </F>
              <F label="Corrente por MPPT">
                <Num value={e.inverter.iMaxMppt} onChange={(v) => setInv({ iMaxMppt: v })} suffix="A" digits={1} />
              </F>
              <F label="MPPT mín.">
                <Num value={e.inverter.mpptMin} onChange={(v) => setInv({ mpptMin: v })} suffix="V" digits={0} />
              </F>
              <F label="MPPT máx.">
                <Num value={e.inverter.mpptMax} onChange={(v) => setInv({ mpptMax: v })} suffix="V" digits={0} />
              </F>
            </div>
            <div className="flex flex-col gap-2">
              <Toggle checked={e.inverter.dcSwitch} onChange={(v) => setInv({ dcSwitch: v })} label="Chave seccionadora CC integrada" />
              <Toggle checked={e.inverter.dcSpd} onChange={(v) => setInv({ dcSpd: v })} label="DPS CC tipo II integrado" />
            </div>
          </Section>

          <Section title="Strings (lado CC)" icon={<Cable className="h-4 w-4" />} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Módulos no telhado" value={report.modules} sub={`${elec.strings.used} ligados`} tone={elec.strings.leftover ? "warn" : "sun"} />
              <Stat label="Arranjo" value={elec.strings.strings.length ? elec.strings.strings.map((s) => s.modules).join(" + ") : "—"} sub={`mín. ${elec.strings.minPerString} · máx. ${elec.strings.maxPerString} por string`} />
              <Stat label="Voc no frio (5 °C)" value={`${n1(elec.strings.stringVocMax, 0)} V`} sub={`limite ${e.inverter.vdcMax} V`} tone={elec.strings.stringVocMax > e.inverter.vdcMax ? "bad" : undefined} />
              <Stat label="Cabo solar" value={`${fmt(elec.strings.dcSection)} mm²`} sub={`queda ${n1(elec.strings.dcDrop, 2)}%`} />
            </div>
            {elec.strings.strings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                {elec.strings.strings.map((s, i) => (
                  <span key={i} className="rounded-lg bg-ink-50 px-2 py-1 ring-1 ring-ink-100">
                    String {i + 1} → MPPT {s.mppt}: <b>{s.modules}</b> módulos
                  </span>
                ))}
              </div>
            )}
            <F label="Comprimento do cabo CC (telhado → inversor)">
              <Num value={e.dcLength} onChange={(v) => setE({ dcLength: v })} suffix="m" min={1} max={300} digits={0} />
            </F>
            <p className="text-[11.5px] text-ink-500">{elec.dcSurge.text}. {e.inverter.dcSpd ? "O inversor já traz DPS CC — em cabos acima de 10 m, prefira DPS também junto aos módulos." : "Instale na string box."}</p>
          </Section>

          <Section title="Carregador de veículo elétrico" icon={<BatteryCharging className="h-4 w-4" />} defaultOpen={e.ev.enabled}>
            <Toggle checked={e.ev.enabled} onChange={(v) => setEv({ enabled: v })} label="Incluir carregador (wallbox)" />
            {e.ev.enabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <F label="Marca/modelo">
                    <Txt value={e.ev.brand} onChange={(v) => setEv({ brand: v })} />
                  </F>
                  <F label="Corrente">
                    <Sel value={e.ev.current} onChange={(v) => setEv({ current: v })} options={[16, 20, 25, 32, 40].map((a) => ({ value: a, label: `${a} A` }))} />
                  </F>
                  <F label="Ligação" className="col-span-2">
                    <Sel value={e.ev.connection} onChange={(v) => setEv({ connection: v })} options={connOptions(allowed)} />
                  </F>
                </div>
                <Toggle checked={e.ev.rdcdd} onChange={(v) => setEv({ rdcdd: v })} label="Carregador detecta fuga CC de 6 mA (RDC-DD)" />
                {elec.ev && elec.evDr && (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Potência" value={`${n1(elec.ev.powerW / 1000)} kW`} sub={`${fmt(elec.ev.voltage)} V · ${e.ev.current} A`} tone="sun" />
                    <Stat label="Proteção" value={`${elec.ev.sizing.poles}P ${elec.ev.sizing.breaker} A`} sub={`DR ${elec.evDr.poles}P 30 mA tipo ${elec.evDr.type}`} />
                  </div>
                )}
                <p className="text-[11.5px] text-ink-500">NBR 17019: circuito exclusivo, DR 30 mA (tipo A + detecção de 6 mA CC, ou tipo B), DPS e aterramento. O carregador soma carga — confira o padrão de entrada.</p>
              </>
            )}
          </Section>

          <Section title="Eletrodutos, cabos e conduletes" icon={<Cable className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <F label="Altura da rota horizontal">
                <Num value={e.routeY} onChange={(v) => setE({ routeY: v })} suffix="m" min={0.2} max={2.9} step={0.05} />
              </F>
              <F label="Temperatura ambiente">
                <Num value={e.ambient} onChange={(v) => setE({ ambient: v })} suffix="°C" min={10} max={60} digits={0} />
              </F>
              <F label="Largura da parede">
                <Num value={e.wallWidth} onChange={(v) => setE({ wallWidth: v })} suffix="m" min={3} max={40} step={0.5} />
              </F>
              <F label="Método de instalação">
                <Sel
                  value={e.method}
                  onChange={(v) => setE({ method: v })}
                  options={[
                    { value: "B1", label: "B1 — eletroduto aparente" },
                    { value: "C", label: "C — cabo na parede" },
                  ]}
                />
              </F>
            </div>
            <p className="text-[11px] text-ink-400">{METHOD_LABEL[e.method]}. Condulete em cada curva e caixa de passagem a cada 15 m (−3 m por curva).</p>
            {[elec.inverter, ...(elec.ev ? [elec.ev] : [])].map((c) => (
              <div key={c.id} className="rounded-xl bg-ink-50 p-3 text-[12px] ring-1 ring-ink-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink-900">{c.name}</span>
                  <span className={cx("rounded-full px-2 text-[10.5px] font-semibold", c.sizing.ok ? "bg-sun-100 text-sun-700" : "bg-amber-100 text-amber-700")}>{c.sizing.ok ? "ok" : "revisar"}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-ink-600">
                  <span>Corrente: <b className="text-ink-900">{n1(c.sizing.ib)} A</b></span>
                  <span>Disjuntor: <b className="text-ink-900">{c.sizing.poles}P {c.sizing.breaker} A curva {c.sizing.curve}</b></span>
                  <span className="col-span-2">Cabos: <b className="text-ink-900">{c.sizing.cableSpec}</b></span>
                  <span>Capacidade: <b className="text-ink-900">{n1(c.sizing.iz)} A</b></span>
                  <span>Queda: <b className={c.sizing.drop > c.sizing.maxDrop ? "text-rose-600" : "text-ink-900"}>{n1(c.sizing.drop, 2)}%</b> (máx. {fmt(c.sizing.maxDrop)}%)</span>
                  <span>Eletroduto: <b className="text-ink-900">{c.sizing.conduit.label}</b> ({Math.round(c.sizing.conduit.occupancy * 100)}% ocup.)</span>
                  <span>Trajeto: <b className="text-ink-900">{n1(c.length)} m</b></span>
                </div>
                {c.route && c.route.conduletes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.route.conduletes.map((k, i) => (
                      <span key={i} title={CONDULETE_INFO[k.type]} className="rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-700 ring-1 ring-ink-200">
                        Condulete {k.type} {c.sizing.conduit.label}
                      </span>
                    ))}
                  </div>
                )}
                <ul className="mt-1.5 list-disc pl-4 text-[11px] text-ink-500">
                  {c.sizing.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {c.sizing.warnings.map((w) => (
                    <li key={w} className="text-amber-700">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          <Section title="Circuitos adicionais no quadro" icon={<Plus className="h-4 w-4" />} defaultOpen={false}>
            {e.extra.map((c, i) => {
              const r = elec.extra[i];
              const setC = (patch: Partial<ExtraCircuit>) => setE({ extra: e.extra.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) });
              return (
                <div key={c.id} className="space-y-2 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-100">
                  <div className="grid grid-cols-2 gap-2">
                    <F label="Nome">
                      <Txt value={c.name} onChange={(v) => setC({ name: v })} />
                    </F>
                    <F label="Tipo">
                      <Sel value={c.kind} onChange={(v) => setC({ kind: v })} options={(["chuveiro", "ar", "tomadas", "iluminacao", "outro"] as const).map((k) => ({ value: k, label: CIRCUIT_KIND[k].label }))} />
                    </F>
                    <F label="Potência">
                      <Num value={c.powerW} onChange={(v) => setC({ powerW: v })} suffix="W" digits={0} />
                    </F>
                    <F label="Comprimento">
                      <Num value={c.length} onChange={(v) => setC({ length: v })} suffix="m" digits={0} />
                    </F>
                    <F label="Ligação" className="col-span-2">
                      <Sel value={c.connection} onChange={(v) => setC({ connection: v })} options={connOptions(allowed)} />
                    </F>
                  </div>
                  {r && (
                    <p className="text-[11.5px] text-ink-600">
                      {r.sizing.poles}P {r.sizing.breaker} A · {r.sizing.cableSpec} · queda {n1(r.sizing.drop, 2)}%
                    </p>
                  )}
                  <button onClick={() => setE({ extra: e.extra.filter((x) => x.id !== c.id) })} className="flex h-7 items-center gap-1 text-[11.5px] font-semibold text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setE({ extra: [...e.extra, { id: uid("c"), name: `Circuito ${e.extra.length + 1}`, kind: "tomadas", powerW: 1500, connection: allowed[0], length: 15 }] })}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-200"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar circuito
            </button>
          </Section>

          <Section title="Quadro de distribuição" icon={<Cpu className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <F label="Tamanho" hint={`Sugerido: ${elec.boardSuggestion} módulos`}>
                <Sel value={e.board.modules} onChange={(v) => setBoard({ modules: v })} options={BOARD_SIZES.map((b) => ({ value: b.modules, label: `${b.modules} módulos (${b.rows}×${b.perRow})` }))} />
              </F>
              <F label="Marca dos dispositivos" hint="Aparece impressa nos disjuntores, DR e DPS">
                <Sel
                  value={e.board.brand}
                  onChange={(v) => setBoard({ brand: v })}
                  options={["steck", "schneider", "siemens", "abb", "weg", "soprano", "tramontina", "genérico"].map((b) => ({ value: b, label: b[0].toUpperCase() + b.slice(1) }))}
                />
              </F>
              <F label="Instalação">
                <Sel
                  value={e.board.kind}
                  onChange={(v) => setBoard({ kind: v })}
                  options={[
                    { value: "sobrepor", label: "Sobrepor" },
                    { value: "embutir", label: "Embutir" },
                  ]}
                />
              </F>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Toggle checked={e.autoDevices} onChange={(v) => setE({ autoDevices: v, devices: v ? [] : elec.devices })} label="Montagem automática" />
              <span className="text-[11.5px] text-ink-500">
                {elec.modulesUsed}/{e.board.modules} módulos
              </span>
            </div>
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl ring-1 ring-ink-100">
              {elec.devices.map((d) => (
                <li key={d.id}>
                  <button onClick={() => setSelection({ kind: "device", id: d.id })} className={cx("flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-ink-50", selection?.id === d.id && "bg-sun-50")}>
                    <span className="grid h-6 min-w-6 place-items-center rounded-md bg-ink-100 px-1 text-[10.5px] font-bold text-ink-600">{d.poles}P</span>
                    <span className="flex-1 truncate font-semibold text-ink-800">{d.label}</span>
                    <span className="text-ink-500">
                      {d.kind === "reserva" ? "—" : d.kind === "dps" ? `${d.uc} V · ${d.current} kA` : d.kind === "dr" ? `${d.current} A ${d.sens} mA ${d.drType}` : `${d.curve}${d.current} ${d.breakingKa} kA`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["disjuntor", "Disjuntor"],
                  ["dr", "DR"],
                  ["dps", "DPS"],
                  ["reserva", "Reserva"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => {
                    const d: Device = {
                      id: uid("d"),
                      kind: k,
                      label: l,
                      poles: k === "dr" ? 2 : 1,
                      current: k === "dps" ? 20 : k === "dr" ? 40 : k === "disjuntor" ? 20 : 0,
                      curve: "C",
                      breakingKa: 6,
                      sens: k === "dr" ? 30 : 0,
                      drType: "A",
                      uc: k === "dps" ? elec.surge.uc : 0,
                      circuitId: null,
                    };
                    editDevices((list) => [...list, d]);
                    setSelection({ kind: "device", id: d.id });
                  }}
                  className="flex h-8 items-center gap-1 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-200"
                >
                  <Plus className="h-3.5 w-3.5" /> {l}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-ink-500">
              DPS: {elec.surge.text} — {elec.surge.topology}. Espaços reserva exigidos: {elec.reserve}.
            </p>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function DeviceEditor({
  d,
  onChange,
  onMove,
  onDelete,
  circuitOptions,
}: {
  d: Device;
  onChange: (p: Partial<Device>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  circuitOptions: { value: string; label: string }[];
}) {
  const breaker = d.kind === "disjuntor" || d.kind === "geral";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <F label="Identificação">
          <Txt value={d.label} onChange={(v) => onChange({ label: v })} />
        </F>
        <F label="Circuito">
          <Sel value={d.circuitId ?? ""} onChange={(v) => onChange({ circuitId: v || null })} options={circuitOptions} />
        </F>
        {d.kind !== "reserva" && d.kind !== "dps" && (
          <F label="Polos">
            <Chips value={d.poles} onChange={(v) => onChange({ poles: v })} options={(d.kind === "dr" ? [2, 4] : [1, 2, 3]).map((p) => ({ value: p, label: `${p}P` }))} />
          </F>
        )}
        {breaker && (
          <>
            <F label="Corrente nominal">
              <Sel value={d.current} onChange={(v) => onChange({ current: v })} options={BREAKERS.map((b) => ({ value: b, label: `${b} A` }))} />
            </F>
            <F label="Curva">
              <Chips value={d.curve} onChange={(v) => onChange({ curve: v })} options={(["B", "C", "D"] as const).map((c) => ({ value: c, label: c }))} />
            </F>
            <F label="Capacidade de interrupção">
              <Sel value={d.breakingKa} onChange={(v) => onChange({ breakingKa: v })} options={[3, 4.5, 5, 6, 10].map((k) => ({ value: k, label: `${fmt(k)} kA` }))} />
            </F>
          </>
        )}
        {d.kind === "dr" && (
          <>
            <F label="Corrente nominal">
              <Sel value={d.current} onChange={(v) => onChange({ current: v })} options={[25, 40, 63, 80, 100].map((b) => ({ value: b, label: `${b} A` }))} />
            </F>
            <F label="Sensibilidade">
              <Chips value={d.sens} onChange={(v) => onChange({ sens: v })} options={[30, 300].map((s) => ({ value: s, label: `${s} mA` }))} />
            </F>
            <F label="Tipo" hint="AC: só senoidal · A: + pulsante CC (VE, inversor) · B: + CC liso">
              <Chips value={d.drType} onChange={(v) => onChange({ drType: v })} options={(["AC", "A", "F", "B"] as const).map((t) => ({ value: t, label: t }))} />
            </F>
          </>
        )}
        {d.kind === "dps" && (
          <>
            <F label="Uc (tensão máx. contínua)">
              <Sel value={d.uc} onChange={(v) => onChange({ uc: v })} options={[175, 275, 320, 385, 440].map((u) => ({ value: u, label: `${u} V` }))} />
            </F>
            <F label="In (corrente de descarga)">
              <Sel value={d.current} onChange={(v) => onChange({ current: v })} options={[5, 10, 20, 40].map((k) => ({ value: k, label: `${k} kA` }))} />
            </F>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onMove(-1)} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-ink-200 hover:bg-ink-50" title="Mover para a esquerda">
          <ArrowUp className="h-4 w-4 -rotate-90" />
        </button>
        <button onClick={() => onMove(1)} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-ink-200 hover:bg-ink-50" title="Mover para a direita">
          <ArrowDown className="h-4 w-4 -rotate-90" />
        </button>
        <button onClick={onDelete} className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
          <CircleSlash className="h-3.5 w-3.5" /> Retirar do quadro
        </button>
      </div>
    </div>
  );
}
