/** Perfis de consumo e utilitários de agenda das cargas. */
import type { Load } from "./types.ts";
import { newId } from "./storage.ts";

/** Pesos horários (0h…23h) — normalizados para média 1 na hora de usar. */
export const SHAPES: Record<string, number[]> = {
  residencial: [0.55, 0.45, 0.42, 0.4, 0.42, 0.55, 0.85, 0.95, 0.8, 0.7, 0.7, 0.75, 0.8, 0.75, 0.7, 0.72, 0.85, 1.1, 1.55, 1.75, 1.65, 1.4, 1.05, 0.75],
  comercial: [0.3, 0.3, 0.3, 0.3, 0.3, 0.32, 0.45, 0.8, 1.35, 1.55, 1.6, 1.6, 1.45, 1.55, 1.6, 1.6, 1.5, 1.3, 0.9, 0.6, 0.45, 0.38, 0.34, 0.32],
  rural: [0.5, 0.45, 0.45, 0.45, 0.6, 1.1, 1.5, 1.3, 1.0, 0.9, 0.9, 1.0, 1.05, 0.9, 0.85, 0.9, 1.1, 1.4, 1.6, 1.5, 1.2, 0.9, 0.7, 0.55],
  industrial: [0.45, 0.45, 0.45, 0.45, 0.45, 0.6, 1.2, 1.35, 1.4, 1.4, 1.4, 1.35, 1.1, 1.35, 1.4, 1.4, 1.35, 1.3, 1.2, 1.1, 1.0, 0.8, 0.55, 0.45],
  plano: Array(24).fill(1),
};

const normalized: Record<string, number[]> = Object.fromEntries(
  Object.entries(SHAPES).map(([k, v]) => {
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    return [k, v.map((x) => x / mean)];
  }),
);

/** Peso do perfil numa hora fracionária (interpolação linear entre horas). */
export function shapeAt(shape: string, hour: number) {
  const v = normalized[shape] ?? normalized.plano;
  const h = hour - 0.5;
  const i = Math.floor(h);
  const f = h - i;
  const a = v[((i % 24) + 24) % 24];
  const b = v[(((i + 1) % 24) + 24) % 24];
  return a + (b - a) * f;
}

/** Distribuição do uso de água quente ao longo do dia (soma = 1). */
export const HOT_WATER_DRAW = (() => {
  const w = Array(24).fill(0);
  w[6] = 0.15;
  w[7] = 0.15;
  w[12] = 0.05;
  w[18] = 0.1;
  w[19] = 0.2;
  w[20] = 0.2;
  w[21] = 0.1;
  w[22] = 0.05;
  return w as number[];
})();

/** Hora dentro da janela [start, end) — aceita janelas que cruzam a meia-noite. */
export function inWindow(h: number, start: number, end: number) {
  if (start === end) return true;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

/** Horas que faltam até o fim da janela. */
export function hoursUntil(h: number, end: number) {
  const d = (end - h + 24) % 24;
  return d === 0 ? 24 : d;
}

/** O instante `mark` caiu dentro do passo [h, h + dt)? */
export function crosses(h: number, dt: number, mark: number) {
  const d = (mark - h + 24) % 24;
  return d < dt - 1e-9;
}

/** 0 = domingo … 6 = sábado. Considera 1º de janeiro numa quinta-feira (como em 2026). */
export const dayOfWeek = (doy: number) => (4 + doy - 1) % 7;

export function dayMatches(doy: number, days: "todos" | "uteis" | "fds" | "domingos") {
  const w = dayOfWeek(doy);
  if (days === "todos") return true;
  if (days === "uteis") return w >= 1 && w <= 5;
  if (days === "fds") return w === 0 || w === 6;
  return w === 0;
}

export const LOAD_LABEL: Record<Load["kind"], string> = {
  profile: "Consumo base",
  appliance: "Equipamento",
  motor: "Motor / máquina",
  pump: "Bomba d'água",
  ev: "Carro elétrico",
  waterheater: "Aquecedor (boiler)",
  deferrable: "Carga deslocável",
};

/** Modelos prontos de carga para adicionar com um clique. */
export function loadTemplate(kind: Load["kind"]): Load {
  const id = newId("ld");
  switch (kind) {
    case "profile":
      return { id, kind, name: "Casa (consumo base)", enabled: true, dailyKWh: 12, shape: "residencial", noise: 0.15, weekendFactor: 1.1 };
    case "appliance":
      return { id, kind, name: "Ar-condicionado 12 mil BTU", enabled: true, powerKW: 1.1, start: 21, end: 6, duty: 0.6, days: "todos" };
    case "motor":
      return { id, kind, name: "Motor 3 cv (serra / moinho)", enabled: true, shaftKW: 2.2, loadFactor: 0.8, efficiency: 0.85, powerFactor: 0.82, startMultiplier: 7, start: 8, end: 12, days: "uteis", solarOnly: false };
    case "pump":
      return { id, kind, name: "Bomba solar 1 cv", enabled: true, powerKW: 0.75, flowM3h: 3, headM: 30, dailyM3: 12, start: 7, end: 17 };
    case "ev":
      return { id, kind, name: "Carro elétrico", enabled: true, chargerKW: 7.4, dailyKWh: 10, plugIn: 18, plugOut: 7, smart: false, daysHome: "todos" };
    case "waterheater":
      return { id, kind, name: "Boiler 200 L", enabled: true, tankLiters: 200, heaterKW: 3, coldC: 22, minC: 42, maxC: 65, dailyLiters: 160, lossKWhDay: 1.2, diverter: true };
    case "deferrable":
      return { id, kind, name: "Máquina de lavar / dessalinizador", enabled: true, powerKW: 1.5, dailyKWh: 2, start: 8, end: 18, mustComplete: true };
  }
}
