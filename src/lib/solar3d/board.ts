/**
 * Composição da parte elétrica: posições na parede, rotas de eletroduto, dimensionamento de
 * cada circuito, montagem automática do quadro e verificações.
 */

import {
  acSurge,
  allowedConnections,
  availablePowerKw,
  boardSize,
  BOARD_SIZES,
  CONNECTION_LABEL,
  conduitFor,
  connectionVoltage,
  dcSurge,
  designStrings,
  evResidual,
  fmt,
  reserveSpaces,
  sizeCircuit,
  wallRoute,
  type CircuitSizing,
  type Route,
  type RoutePoint,
  type StringDesign,
} from "./electrical.ts";
import { uid, type Device, type Project } from "./project.ts";

export const WALL_HEIGHT = 3;

export interface Box2 {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
}

export function inverterBox(p: Project): Box2 {
  const kw = p.electrical.inverter.powerKw;
  const w = Math.min(0.75, 0.36 + kw * 0.012);
  const h = Math.min(0.9, 0.46 + kw * 0.01);
  return { x: p.electrical.inverter.x, y: p.electrical.inverter.y, w, h, d: kw > 15 ? 0.26 : 0.18 };
}

export function boardBox(p: Project): Box2 {
  const s = boardSize(p.electrical.board.modules);
  return { x: p.electrical.board.x, y: p.electrical.board.y, w: s.perRow * 0.018 + 0.18, h: s.rows * 0.2 + 0.24, d: 0.11 };
}

export function evBox(p: Project): Box2 {
  return { x: p.electrical.ev.x, y: p.electrical.ev.y, w: 0.26, h: 0.36, d: 0.12 };
}

export function stringBoxNeeded(p: Project) {
  return !p.electrical.inverter.dcSwitch || !p.electrical.inverter.dcSpd;
}

/** Ponto de entrada no quadro, do lado do equipamento, acima/abaixo/lateral conforme a rota. */
function boardEntry(bb: Box2, towardX: number, routeY: number, slot: number): RoutePoint {
  const side = Math.sign(towardX - bb.x) || -1;
  const x = bb.x + side * bb.w * (0.18 + 0.12 * slot);
  if (routeY < bb.y - bb.h / 2) return { x, y: bb.y - bb.h / 2 };
  if (routeY > bb.y + bb.h / 2) return { x, y: bb.y + bb.h / 2 };
  return { x: bb.x + side * (bb.w / 2), y: routeY };
}

function equipmentEntry(box: Box2, routeY: number, offset: number): { point: RoutePoint; routeY: number } {
  const bottom = box.y - box.h / 2;
  const top = box.y + box.h / 2;
  if (routeY > top) return { point: { x: box.x + offset, y: top }, routeY };
  // saída por baixo; se a rota passaria pelo corpo do equipamento, desce abaixo dele
  return { point: { x: box.x + offset, y: bottom }, routeY: Math.min(routeY, bottom - 0.15) };
}

export interface CircuitReport {
  id: string;
  name: string;
  kind: string;
  connection: string;
  voltage: number;
  powerW: number;
  sizing: CircuitSizing;
  route?: Route;
  length: number;
}

export interface Check {
  ok: boolean;
  level: "ok" | "warn" | "error";
  text: string;
}

export interface ElectricalReport {
  inverterRoute: Route;
  evRoute: Route | null;
  dcRoute: Route;
  inverter: CircuitReport;
  ev: CircuitReport | null;
  extra: CircuitReport[];
  strings: StringDesign;
  surge: ReturnType<typeof acSurge>;
  dcSurge: ReturnType<typeof dcSurge>;
  evDr: ReturnType<typeof evResidual> | null;
  devices: Device[];
  modulesUsed: number;
  reserve: number;
  boardSuggestion: number;
  availableKw: number;
  dcConduit: ReturnType<typeof conduitFor>;
  checks: Check[];
  totalModules: number;
}

function baseDevice(partial: Partial<Device> & Pick<Device, "kind" | "label">): Device {
  return { id: uid("d"), poles: 1, current: 0, curve: "C", breakingKa: 6, sens: 0, drType: "A", uc: 0, circuitId: null, ...partial };
}

/** Monta o quadro com os dispositivos recomendados. */
export function autoDevices(p: Project, inv: CircuitReport, ev: CircuitReport | null, extra: CircuitReport[], evDr: ElectricalReport["evDr"]): Device[] {
  const g = p.electrical.grid;
  const surge = acSurge(g);
  const list: Device[] = [];
  let seq = 0;
  const device = (partial: Partial<Device> & Pick<Device, "kind" | "label">): Device => ({ ...baseDevice(partial), id: `auto-${seq++}-${partial.kind}` });
  const geralPoles = g.system === "mono" ? 1 : g.system === "bi" ? 2 : 3;
  list.push(device({ kind: "geral", label: "Geral", poles: geralPoles, current: g.mainBreaker, curve: "C", breakingKa: 10, circuitId: "geral" }));
  for (let i = 0; i < surge.count; i++) list.push(device({ kind: "dps", label: i === surge.count - 1 ? "DPS N" : `DPS L${i + 1}`, poles: 1, current: surge.inKa, uc: surge.uc, circuitId: "geral" }));
  list.push(device({ kind: "disjuntor", label: "Inversor FV", poles: inv.sizing.poles, current: inv.sizing.breaker, curve: inv.sizing.curve, breakingKa: 6, circuitId: "inversor" }));
  if (ev && evDr) {
    list.push(device({ kind: "dr", label: "DR VE", poles: evDr.poles, current: evDr.rating, sens: 30, drType: evDr.type as Device["drType"], circuitId: "ve" }));
    list.push(device({ kind: "disjuntor", label: "Carregador VE", poles: ev.sizing.poles, current: ev.sizing.breaker, curve: ev.sizing.curve, breakingKa: 6, circuitId: "ve" }));
  }
  for (const c of extra) list.push(device({ kind: "disjuntor", label: c.name, poles: c.sizing.poles, current: c.sizing.breaker, curve: c.sizing.curve, breakingKa: 6, circuitId: c.id }));
  const circuits = 1 + (ev ? 1 : 0) + extra.length;
  for (let i = 0; i < reserveSpaces(circuits); i++) list.push(device({ kind: "reserva", label: "Reserva", poles: 1, circuitId: null }));
  return list;
}

export function electricalReport(p: Project, nModules: number): ElectricalReport {
  const e = p.electrical;
  const g = e.grid;
  const ib = inverterBox(p);
  const bb = boardBox(p);
  const eb = evBox(p);
  const checks: Check[] = [];

  // Rotas
  const invOut = equipmentEntry(ib, e.routeY, ib.w * 0.25);
  const inverterRoute = wallRoute(invOut.point, boardEntry(bb, ib.x, invOut.routeY, 0), invOut.routeY);
  let evRoute: Route | null = null;
  if (e.ev.enabled) {
    const evIn = equipmentEntry(eb, e.routeY, 0);
    evRoute = wallRoute(boardEntry(bb, eb.x, evIn.routeY, 1), evIn.point, evIn.routeY);
  }
  const dcX = ib.x - ib.w / 2 - 0.2;
  const dcRoute = wallRoute({ x: dcX, y: WALL_HEIGHT }, { x: ib.x - ib.w * 0.25, y: ib.y - ib.h / 2 }, ib.y - ib.h / 2 - 0.18);

  // Circuitos
  const slack = 1.5; // sobras e trechos dentro do quadro
  const invLen = inverterRoute.length + slack;
  const invSizing = sizeCircuit(
    { kind: "inversor", powerW: e.inverter.powerKw * 1000, current: e.inverter.maxCurrent || undefined, connection: e.inverter.connection, length: invLen, method: e.method, ambient: e.ambient, grouped: 1 },
    g,
  );
  const inverter: CircuitReport = {
    id: "inversor",
    name: `Inversor ${e.inverter.brand} ${fmt(e.inverter.powerKw)} kW`,
    kind: "inversor",
    connection: CONNECTION_LABEL[e.inverter.connection],
    voltage: connectionVoltage(e.inverter.connection, g),
    powerW: e.inverter.powerKw * 1000,
    sizing: invSizing,
    route: inverterRoute,
    length: invLen,
  };
  let ev: CircuitReport | null = null;
  let evDr: ElectricalReport["evDr"] = null;
  if (e.ev.enabled && evRoute) {
    const V = connectionVoltage(e.ev.connection, g);
    const powerW = e.ev.connection === "3f" ? Math.sqrt(3) * V * e.ev.current : V * e.ev.current;
    const len = evRoute.length + slack;
    const sizing = sizeCircuit({ kind: "ve", powerW, current: e.ev.current, connection: e.ev.connection, length: len, method: e.method, ambient: e.ambient, grouped: 1 }, g);
    ev = { id: "ve", name: `Carregador VE ${fmt(powerW / 1000)} kW`, kind: "ve", connection: CONNECTION_LABEL[e.ev.connection], voltage: V, powerW, sizing, route: evRoute, length: len };
    evDr = evResidual(e.ev.connection, e.ev.rdcdd, sizing.breaker);
  }
  const extra: CircuitReport[] = e.extra.map((c) => {
    const sizing = sizeCircuit({ kind: c.kind, powerW: c.powerW, connection: c.connection, length: c.length, method: e.method, ambient: e.ambient, grouped: 1 }, g);
    return { id: c.id, name: c.name, kind: c.kind, connection: CONNECTION_LABEL[c.connection], voltage: connectionVoltage(c.connection, g), powerW: c.powerW, sizing, length: c.length };
  });

  const strings = designStrings(p.module, e.inverter, nModules, e.dcLength);
  const surge = acSurge(g);
  const dcs = dcSurge(strings.stringVocMax || p.module.voc * 10);
  const devices = e.autoDevices || !e.devices.length ? autoDevices(p, inverter, ev, extra, evDr) : e.devices;
  const modulesUsed = devices.reduce((a, d) => a + d.poles, 0);
  const circuits = 1 + (ev ? 1 : 0) + extra.length;
  const reserve = reserveSpaces(circuits);
  const nonReserve = devices.filter((d) => d.kind !== "reserva").reduce((a, d) => a + d.poles, 0);
  const boardSuggestion = BOARD_SIZES.find((b) => b.modules >= nonReserve + reserve)?.modules ?? 54;
  const availableKw = availablePowerKw(g);
  const dcCables = strings.strings.flatMap(() => [{ section: strings.dcSection, solar: true }, { section: strings.dcSection, solar: true }]);
  const dcConduit = conduitFor(dcCables.length ? [...dcCables, { section: 6 }] : [{ section: 4, solar: true }]);

  // Verificações
  const push = (ok: boolean, text: string, level: Check["level"] = ok ? "ok" : "error") => checks.push({ ok, level, text });
  push(allowedConnections(g.system).includes(e.inverter.connection), `Ligação do inversor (${CONNECTION_LABEL[e.inverter.connection].toLowerCase()}) compatível com entrada ${g.system === "mono" ? "monofásica" : g.system === "bi" ? "bifásica" : "trifásica"}`);
  push(e.inverter.powerKw <= availableKw + 1e-9, `Potência do inversor ${fmt(e.inverter.powerKw)} kW ≤ potência disponibilizada ${fmt(availableKw)} kW (disjuntor ${g.mainBreaker} A) — REN 1000`);
  push(invSizing.ok, `Circuito do inversor: ${invSizing.cableSpec}, disjuntor ${invSizing.poles}P ${invSizing.breaker} A, queda ${fmt(invSizing.drop, 2)}%`, invSizing.ok ? "ok" : "warn");
  if (ev) {
    push(allowedConnections(g.system).includes(e.ev.connection), `Ligação do carregador compatível com a entrada`);
    push(ev.sizing.ok, `Circuito do VE: ${ev.sizing.cableSpec}, disjuntor ${ev.sizing.poles}P ${ev.sizing.breaker} A, queda ${fmt(ev.sizing.drop, 2)}%`, ev.sizing.ok ? "ok" : "warn");
    const hasDr = devices.some((d) => d.kind === "dr" && d.circuitId === "ve" && d.sens <= 30 && (d.drType === "A" || d.drType === "F" || d.drType === "B"));
    push(hasDr, "Circuito do VE exclusivo com DR 30 mA tipo A (ou B) — NBR 17019");
    if (hasDr && !e.ev.rdcdd && !devices.some((d) => d.kind === "dr" && d.circuitId === "ve" && d.drType === "B")) push(false, "Carregador sem detecção de 6 mA CC exige DR tipo B", "error");
    push(e.ev.current <= g.mainBreaker, `Corrente do carregador (${e.ev.current} A) ≤ disjuntor geral (${g.mainBreaker} A)`, e.ev.current <= g.mainBreaker ? "ok" : "warn");
  }
  for (const c of extra) push(c.sizing.ok, `${c.name}: ${c.sizing.cableSpec}, disjuntor ${c.sizing.breaker} A`, c.sizing.ok ? "ok" : "warn");
  push(devices.some((d) => d.kind === "dps"), `DPS classe II no quadro (${surge.text})`);
  const board = boardSize(e.board.modules);
  push(modulesUsed <= board.modules, `Ocupação do quadro: ${modulesUsed} de ${board.modules} módulos DIN`);
  push(e.board.modules >= boardSuggestion, `Espaço reserva NBR 5410: ${reserve} posições para ${circuits} circuito(s) — sugerido quadro de ${boardSuggestion} módulos`, e.board.modules >= boardSuggestion ? "ok" : "warn");
  // coerência disjuntor × cabo quando o usuário editou manualmente
  for (const d of devices.filter((x) => x.kind === "disjuntor" && x.circuitId)) {
    const c = d.circuitId === "inversor" ? inverter : d.circuitId === "ve" ? ev : extra.find((x) => x.id === d.circuitId);
    if (!c) continue;
    if (d.current > c.sizing.iz + 1e-9) push(false, `Disjuntor “${d.label}” de ${d.current} A acima da capacidade do cabo (${fmt(c.sizing.iz)} A)`);
    if (d.current + 1e-9 < c.sizing.ib) push(false, `Disjuntor “${d.label}” de ${d.current} A abaixo da corrente do circuito (${fmt(c.sizing.ib)} A)`);
    if (d.poles < c.sizing.poles) push(false, `Disjuntor “${d.label}” com polos insuficientes`);
  }
  for (const w of strings.warnings) push(false, w, "warn");
  if (nModules > 0 && !strings.warnings.length)
    push(true, `Strings: ${strings.strings.map((s) => s.modules).join(" + ")} módulos (mín. ${strings.minPerString}, máx. ${strings.maxPerString}); Voc no frio ${fmt(strings.stringVocMax, 0)} V ≤ ${e.inverter.vdcMax} V`);
  if (strings.needFuses) push(false, "3 ou mais strings em paralelo no mesmo MPPT: usar fusível gPV por string (NBR 16690)", "warn");
  if (stringBoxNeeded(p)) push(true, `String box CC externa: ${!e.inverter.dcSwitch ? "chave seccionadora CC" : ""}${!e.inverter.dcSwitch && !e.inverter.dcSpd ? " + " : ""}${!e.inverter.dcSpd ? dcs.text : ""}`, "warn");
  for (const r of [inverterRoute, evRoute].filter(Boolean) as Route[]) for (const w of r.warnings) push(false, w, "warn");
  push(true, `Aterramento ${g.earthing}: equipotencializar estrutura dos módulos, inversor e quadro no BEP`);

  return {
    inverterRoute,
    evRoute,
    dcRoute,
    inverter,
    ev,
    extra,
    strings,
    surge,
    dcSurge: dcs,
    evDr,
    devices,
    modulesUsed,
    reserve,
    boardSuggestion,
    availableKw,
    dcConduit,
    checks,
    totalModules: nModules,
  };
}

/** Lista de materiais elétricos (cabos, eletrodutos, conduletes e proteções). */
export function electricalBom(p: Project, r: ElectricalReport) {
  const lines: { item: string; qty: string }[] = [];
  const cable = (c: CircuitReport) => {
    const phases = c.sizing.poles;
    lines.push({ item: `Cabo flexível 750 V ${fmt(c.sizing.section)} mm² — fases (${c.name})`, qty: `${fmt(Math.ceil(c.length * phases))} m` });
    if (c.sizing.neutral) lines.push({ item: `Cabo flexível 750 V ${fmt(c.sizing.section)} mm² azul-claro — neutro (${c.name})`, qty: `${fmt(Math.ceil(c.length))} m` });
    lines.push({ item: `Cabo flexível 750 V ${fmt(c.sizing.pe)} mm² verde-amarelo — terra (${c.name})`, qty: `${fmt(Math.ceil(c.length))} m` });
  };
  cable(r.inverter);
  if (r.ev) cable(r.ev);
  for (const c of r.extra) cable(c);
  lines.push({ item: `Cabo solar 1,8 kV CC ${fmt(r.strings.dcSection)} mm² (vermelho + preto)`, qty: `${fmt(Math.ceil(p.electrical.dcLength * 2 * Math.max(1, r.strings.strings.length)))} m` });
  lines.push({ item: "Conector MC4 (par macho/fêmea)", qty: `${Math.max(1, r.strings.strings.length) * 2} par(es)` });
  const conduitLine = (route: Route, size: string, name: string) => {
    lines.push({ item: `Eletroduto PVC rígido roscável ${size} — ${name}`, qty: `${Math.ceil(route.length / 3)} barra(s) de 3 m` });
    const counts = new Map<string, number>();
    for (const c of route.conduletes) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    for (const [t, n] of counts) lines.push({ item: `Condulete tipo ${t} ${size} com tampa — ${name}`, qty: `${n} pç` });
    lines.push({ item: `Abraçadeira tipo D ${size} com bucha — ${name}`, qty: `${Math.ceil(route.length / 1.2) + route.conduletes.length * 2} pç` });
    lines.push({ item: `Bucha e arruela ${size} (entrada no quadro/equipamento) — ${name}`, qty: "2 jogos" });
  };
  conduitLine(r.inverterRoute, r.inverter.sizing.conduit.label, "saída CA do inversor");
  if (r.evRoute && r.ev) conduitLine(r.evRoute, r.ev.sizing.conduit.label, "carregador VE");
  conduitLine(r.dcRoute, r.dcConduit.label, "cabos CC");
  for (const d of r.devices) {
    if (d.kind === "reserva") continue;
    const name =
      d.kind === "geral" || d.kind === "disjuntor"
        ? `Disjuntor termomagnético ${d.poles}P ${d.current} A curva ${d.curve} ${d.breakingKa} kA`
        : d.kind === "dr"
          ? `Interruptor DR ${d.poles}P ${d.current} A ${d.sens} mA tipo ${d.drType}`
          : d.kind === "dps"
            ? `DPS classe II ${d.uc} V ${d.current} kA`
            : d.kind === "dps-cc"
              ? "DPS CC classe II"
              : "Chave seccionadora CC";
    const cur = lines.find((l) => l.item === name);
    if (cur) cur.qty = `${parseInt(cur.qty) + 1} pç`;
    else lines.push({ item: name, qty: "1 pç" });
  }
  lines.push({ item: `Quadro de distribuição ${p.electrical.board.kind === "embutir" ? "de embutir" : "de sobrepor"} ${p.electrical.board.modules} módulos DIN com barramentos N e T`, qty: "1 pç" });
  lines.push({ item: "Barramento pente (fases) e terminais tubulares (ponteiras)", qty: "1 conj." });
  lines.push({ item: "Placa de advertência “Cuidado — risco de choque elétrico: geração própria” (NBR 16690 / distribuidora)", qty: "1 pç" });
  return lines;
}
