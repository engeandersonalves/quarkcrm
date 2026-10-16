import type { DayValue, MonthValue } from "./types.ts";

/** Fator médio de emissão do Sistema Interligado Nacional (MCTI, 2023): kg de CO₂ por kWh. */
export const CO2_KG_PER_KWH = 0.0385;

export interface ReportInput {
  month: string; // AAAA-MM
  days: DayValue[];
  months?: MonthValue[];
  capacityKwp: number | null;
  tariff: number; // R$/kWh
  sunHours: number; // HSP médio
  performanceRatio: number; // 0–1
  today?: string; // AAAA-MM-DD (para o mês corrente)
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function reportStats(r: ReportInput) {
  const total = r.days.reduce((t, d) => t + d.kwh, 0);
  const withData = r.days.filter((d) => d.kwh > 0);
  const best = withData.reduce<DayValue | null>((b, d) => (!b || d.kwh > b.kwh ? d : b), null);
  const worst = withData.reduce<DayValue | null>((b, d) => (!b || d.kwh < b.kwh ? d : b), null);
  const dim = daysInMonth(r.month);
  // No mês corrente, a expectativa considera só os dias que já passaram
  const elapsed = r.today && r.today.startsWith(r.month) ? Number(r.today.slice(8, 10)) : dim;
  const expected = r.capacityKwp ? r.capacityKwp * r.sunHours * r.performanceRatio * elapsed : null;
  const yearTotal = (r.months ?? []).reduce((t, m) => t + m.kwh, 0);
  return {
    total,
    avg: withData.length ? total / withData.length : 0,
    best,
    worst,
    daysWithData: withData.length,
    daysInMonth: dim,
    elapsed,
    specific: r.capacityKwp ? total / r.capacityKwp : null, // kWh/kWp no mês
    expected,
    pctExpected: expected ? total / expected : null,
    savings: total * r.tariff,
    co2Kg: total * CO2_KG_PER_KWH,
    yearTotal,
  };
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;
export const monthShort = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1].slice(0, 3);
export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};

/** Dias entre duas datas (inclusive). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400000) + 1;
}

/** Totais de um período qualquer (mês fechado ou intervalo de datas). */
export function rangeStats(r: { from: string; to: string; days: DayValue[]; capacityKwp: number | null; tariff: number; sunHours: number; performanceRatio: number; today?: string }) {
  const end = r.today && r.today < r.to ? r.today : r.to;
  const span = Math.max(0, daysBetween(r.from, end));
  const inRange = r.days.filter((d) => d.day >= r.from && d.day <= end);
  const total = inRange.reduce((t, d) => t + d.kwh, 0);
  const withData = inRange.filter((d) => d.kwh > 0);
  const best = withData.reduce<DayValue | null>((b, d) => (!b || d.kwh > b.kwh ? d : b), null);
  const worst = withData.reduce<DayValue | null>((b, d) => (!b || d.kwh < b.kwh ? d : b), null);
  const expected = r.capacityKwp ? r.capacityKwp * r.sunHours * r.performanceRatio * span : null;
  return {
    total,
    avg: withData.length ? total / withData.length : 0,
    best,
    worst,
    days: span,
    daysWithData: withData.length,
    specific: r.capacityKwp ? total / r.capacityKwp : null,
    expected,
    pctExpected: expected ? total / expected : null,
    savings: total * r.tariff,
    co2Kg: total * CO2_KG_PER_KWH,
  };
}

/** Rótulo curto de período: "outubro de 2026" ou "01/09/2026 a 15/10/2026". */
export function periodLabel(from: string, to: string) {
  const br = (d: string) => d.split("-").reverse().join("/");
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01") && to === `${to.slice(0, 7)}-${String(daysInMonth(to.slice(0, 7))).padStart(2, "0")}`) return monthLabel(from.slice(0, 7));
  return `${br(from)} a ${br(to)}`;
}
