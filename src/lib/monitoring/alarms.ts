import type { DeviceData, PlantStatus } from "./types.ts";

/** Limites dos alarmes (editáveis em Monitoramento → Alarmes). */
export interface AlarmRules {
  /** Sobretensão: monofásico/bifásico 220 V (fase-neutro ou entre pernas). */
  overMono: number;
  /** Sobretensão: trifásico, tensão entre fases (linha). */
  overTri: number;
  underMono: number;
  underTri: number;
  /** Rede 127 V (fase-neutro). */
  over127: number;
  under127: number;
  tempWarn: number;
  tempCrit: number;
  freqMin: number;
  freqMax: number;
  /** Diferença máxima de tensão entre strings (%). */
  stringMismatchPct: number;
  /** Geração do dia abaixo disso (kWh/kWp) depois das 15 h. */
  lowYield: number;
  /** Horas sem leitura até virar alarme. */
  staleHours: number;
  /** Avisar por e-mail. */
  email: boolean;
}

export const DEFAULT_ALARM_RULES: AlarmRules = {
  overMono: 240,
  overTri: 400,
  underMono: 198,
  underTri: 342,
  over127: 140,
  under127: 110,
  tempWarn: 75,
  tempCrit: 85,
  freqMin: 59.5,
  freqMax: 60.5,
  stringMismatchPct: 20,
  lowYield: 1,
  staleHours: 24,
  email: true,
};

export const mergeRules = (r: Partial<AlarmRules> | null | undefined): AlarmRules => ({ ...DEFAULT_ALARM_RULES, ...(r ?? {}) });

export type AlarmKind = "sobretensao" | "subtensao" | "temperatura" | "frequencia" | "string_desigual" | "offline" | "alarme_fabricante" | "geracao_baixa" | "sem_leitura";
export type Severity = "info" | "warning" | "critical";

export const ALARM_LABEL: Record<AlarmKind, string> = {
  sobretensao: "Sobretensão",
  subtensao: "Subtensão",
  temperatura: "Temperatura alta",
  frequencia: "Frequência fora da faixa",
  string_desigual: "String desigual",
  offline: "Usina offline",
  alarme_fabricante: "Alarme do fabricante",
  geracao_baixa: "Geração baixa",
  sem_leitura: "Sem leitura",
};

export interface Finding {
  kind: AlarmKind;
  severity: Severity;
  message: string;
  value: number | null;
  threshold: number | null;
  deviceSn: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

/** Quantas fases o inversor tem, pelo que ele informa. */
export function phasesOf(d: Pick<DeviceData, "ac" | "acLine" | "gridVoltageLabel">) {
  const phaseCount = d.ac.filter((a) => (a.voltage ?? 0) > 0).length;
  if (phaseCount >= 3) return 3;
  if ((d.acLine?.length ?? 0) >= 2) return 3;
  if (d.gridVoltageLabel?.includes("split")) return 2;
  return phaseCount === 2 ? 2 : 1;
}

/** Regras elétricas de um inversor. */
export function evaluateDevice(d: DeviceData, rules: AlarmRules): Finding[] {
  const out: Finding[] = [];
  const sn = d.sn;
  const phases = phasesOf(d);
  const add = (f: Omit<Finding, "deviceSn">) => out.push({ ...f, deviceSn: sn });

  if (phases === 3) {
    // Trifásico: tensão entre fases (linha); sem linha, cada fase contra o limite monofásico
    const lines = (d.acLine ?? []).filter((l) => l.voltage > 0);
    const worstLine = lines.reduce<{ label: string; voltage: number } | null>((b, l) => (!b || l.voltage > b.voltage ? l : b), null);
    const lowLine = lines.reduce<{ label: string; voltage: number } | null>((b, l) => (!b || l.voltage < b.voltage ? l : b), null);
    if (worstLine && worstLine.voltage > rules.overTri)
      add({ kind: "sobretensao", severity: worstLine.voltage > rules.overTri * 1.05 ? "critical" : "warning", message: `Tensão ${worstLine.label} em ${fmt(worstLine.voltage)} V (limite ${rules.overTri} V trifásico)`, value: r1(worstLine.voltage), threshold: rules.overTri });
    else if (!lines.length) {
      const high = d.ac.filter((a) => (a.voltage ?? 0) > rules.overMono).sort((a, b) => (b.voltage ?? 0) - (a.voltage ?? 0))[0];
      if (high) add({ kind: "sobretensao", severity: high.voltage! > rules.overMono * 1.05 ? "critical" : "warning", message: `${high.label} em ${fmt(high.voltage!)} V (limite ${rules.overMono} V por fase)`, value: r1(high.voltage!), threshold: rules.overMono });
    }
    if (lowLine && lowLine.voltage < rules.underTri && lowLine.voltage > 50) add({ kind: "subtensao", severity: "warning", message: `Tensão ${lowLine.label} em ${fmt(lowLine.voltage)} V (mínimo ${rules.underTri} V)`, value: r1(lowLine.voltage), threshold: rules.underTri });
  } else {
    const v = d.gridVoltage ?? d.ac.find((a) => (a.voltage ?? 0) > 0)?.voltage ?? null;
    if (v !== null && v > 50) {
      const is127 = v < 170;
      const over = is127 ? rules.over127 : rules.overMono;
      const under = is127 ? rules.under127 : rules.underMono;
      if (v > over) add({ kind: "sobretensao", severity: v > over * 1.05 ? "critical" : "warning", message: `Tensão da rede em ${fmt(v)} V (limite ${over} V${is127 ? " em rede 127 V" : " monofásico"})`, value: r1(v), threshold: over });
      else if (v < under) add({ kind: "subtensao", severity: "warning", message: `Tensão da rede em ${fmt(v)} V (mínimo ${under} V)`, value: r1(v), threshold: under });
    }
  }

  if (d.temperatureC !== null && d.temperatureC >= rules.tempWarn)
    add({ kind: "temperatura", severity: d.temperatureC >= rules.tempCrit ? "critical" : "warning", message: `Inversor a ${fmt(d.temperatureC)} °C (alerta a partir de ${rules.tempWarn} °C)`, value: r1(d.temperatureC), threshold: rules.tempWarn });

  if (d.frequencyHz !== null && d.frequencyHz > 40 && (d.frequencyHz < rules.freqMin || d.frequencyHz > rules.freqMax))
    add({ kind: "frequencia", severity: "warning", message: `Frequência em ${fmt(d.frequencyHz, 2)} Hz (faixa ${fmt(rules.freqMin, 1)}–${fmt(rules.freqMax, 1)} Hz)`, value: d.frequencyHz, threshold: d.frequencyHz < rules.freqMin ? rules.freqMin : rules.freqMax });

  // Strings com tensão muito diferente das outras (placa com defeito, sombra, conector)
  const strings = d.dc.filter((s) => (s.voltage ?? 0) > 100);
  if (strings.length >= 2) {
    const sorted = strings.map((s) => s.voltage!).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const worst = strings.reduce((b, s) => (Math.abs(s.voltage! - median) > Math.abs(b.voltage! - median) ? s : b));
    const pct = (Math.abs(worst.voltage! - median) / median) * 100;
    if (pct > rules.stringMismatchPct) add({ kind: "string_desigual", severity: "warning", message: `${worst.label} com ${fmt(worst.voltage!)} V, ${fmt(pct, 0)}% diferente das outras strings`, value: r1(worst.voltage!), threshold: rules.stringMismatchPct });
  }
  return out;
}

/** Regras da usina como um todo (status e geração). `hour` é a hora local. */
export function evaluatePlant(p: { status: PlantStatus; today_kwh: number | null; capacity_kwp: number | null; last_update_at: string | null }, rules: AlarmRules, hour: number, now = Date.now()): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, "deviceSn">) => out.push({ ...f, deviceSn: "" });
  if (p.status === "offline") add({ kind: "offline", severity: "critical", message: "A usina parou de comunicar ou de gerar", value: null, threshold: null });
  if (p.status === "alarm") add({ kind: "alarme_fabricante", severity: "warning", message: "O fabricante informa alarme no inversor", value: null, threshold: null });
  if (p.last_update_at) {
    const h = (now - new Date(p.last_update_at).getTime()) / 3600_000;
    if (h > rules.staleHours) add({ kind: "sem_leitura", severity: "warning", message: `Sem leitura há ${fmt(h, 0)} horas`, value: Math.round(h), threshold: rules.staleHours });
  }
  const today = p.today_kwh === null ? null : Number(p.today_kwh);
  const cap = p.capacity_kwp === null ? null : Number(p.capacity_kwp);
  if (hour >= 15 && p.status !== "offline" && today !== null && cap) {
    const y = today / cap;
    if (y < rules.lowYield) add({ kind: "geracao_baixa", severity: "warning", message: `Só ${fmt(y, 2)} kWh/kWp hoje (esperado acima de ${fmt(rules.lowYield, 1)})`, value: Math.round(y * 100) / 100, threshold: rules.lowYield });
  }
  return out;
}

/** Linha de histórico a partir das leituras de um inversor. */
export function readingOf(d: DeviceData) {
  const ph = (l: string) => d.ac.find((a) => a.label.endsWith(l));
  const dcV = d.dc.filter((s) => (s.voltage ?? 0) > 0).map((s) => s.voltage!);
  const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
  return {
    device_sn: d.sn,
    grid_v: num(d.gridVoltage ?? null),
    v_r: num(ph("R")?.voltage),
    v_s: num(ph("S")?.voltage),
    v_t: num(ph("T")?.voltage),
    v_line: num((d.acLine ?? []).length ? Math.max(...d.acLine!.map((l) => l.voltage)) : null),
    i_r: num(ph("R")?.current),
    i_s: num(ph("S")?.current),
    i_t: num(ph("T")?.current),
    power_kw: num(d.powerKw),
    temp_c: num(d.temperatureC),
    freq_hz: num(d.frequencyHz),
    dc_v: num(dcV.length ? dcV.reduce((a, b) => a + b, 0) / dcV.length : null),
    dc_i: num(d.dc.reduce((t, s) => t + (s.current ?? 0), 0) || null),
    phases: phasesOf(d),
  };
}
