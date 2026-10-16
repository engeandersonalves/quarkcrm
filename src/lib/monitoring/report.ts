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
