/**
 * Climatologia aproximada de capitais e polos solares brasileiros.
 * GHI: irradiação global horizontal média diária (kWh/m²·dia) por mês;
 * temp: temperatura média do ar (°C) por mês; amp: amplitude térmica diária típica (°C).
 * Valores típicos arredondados, compatíveis com a ordem de grandeza do Atlas Brasileiro
 * de Energia Solar (INPE) e do SunData (CRESESB). Para trabalhos científicos, substitua
 * pelos dados medidos/TMY do local em "Local personalizado".
 */
export interface City {
  id: string;
  name: string;
  uf: string;
  lat: number;
  lon: number;
  ghi: number[];
  temp: number[];
  amp: number;
}

export const CITIES: City[] = [
  { id: "natal", name: "Natal", uf: "RN", lat: -5.79, lon: -35.21, amp: 7, ghi: [6.0, 6.0, 5.8, 5.2, 4.9, 4.5, 4.7, 5.4, 6.0, 6.3, 6.4, 6.2], temp: [27.5, 27.6, 27.4, 27.0, 26.4, 25.6, 25.0, 25.2, 25.9, 26.5, 26.9, 27.2] },
  { id: "fortaleza", name: "Fortaleza", uf: "CE", lat: -3.72, lon: -38.54, amp: 7, ghi: [5.6, 5.4, 5.0, 4.8, 5.0, 5.2, 5.6, 6.2, 6.5, 6.5, 6.4, 6.0], temp: [27.4, 27.0, 26.7, 26.6, 26.6, 26.2, 26.0, 26.4, 26.8, 27.2, 27.5, 27.6] },
  { id: "petrolina", name: "Petrolina", uf: "PE", lat: -9.39, lon: -40.5, amp: 11, ghi: [6.0, 6.0, 5.8, 5.4, 5.0, 4.7, 5.0, 5.8, 6.4, 6.5, 6.3, 6.1], temp: [27.5, 27.2, 27.0, 26.5, 25.5, 24.5, 24.0, 24.8, 26.5, 28.0, 28.3, 27.8] },
  { id: "salvador", name: "Salvador", uf: "BA", lat: -12.97, lon: -38.5, amp: 6, ghi: [6.0, 6.0, 5.7, 4.7, 4.3, 4.1, 4.3, 4.8, 5.3, 5.6, 5.6, 5.9], temp: [27.0, 27.3, 27.4, 26.7, 25.8, 24.8, 24.2, 24.3, 25.0, 25.8, 26.3, 26.6] },
  { id: "belem", name: "Belém", uf: "PA", lat: -1.46, lon: -48.49, amp: 8, ghi: [4.3, 4.1, 4.1, 4.3, 4.8, 5.2, 5.4, 5.6, 5.6, 5.5, 5.3, 4.9], temp: [26.3, 26.1, 26.2, 26.5, 26.8, 26.8, 26.7, 26.9, 27.1, 27.3, 27.4, 27.0] },
  { id: "manaus", name: "Manaus", uf: "AM", lat: -3.12, lon: -60.02, amp: 8, ghi: [4.2, 4.2, 4.1, 4.2, 4.4, 4.8, 5.1, 5.4, 5.3, 5.0, 4.8, 4.4], temp: [26.5, 26.4, 26.5, 26.6, 26.8, 26.9, 27.0, 27.7, 28.2, 28.2, 27.7, 27.0] },
  { id: "cuiaba", name: "Cuiabá", uf: "MT", lat: -15.6, lon: -56.1, amp: 11, ghi: [5.3, 5.3, 5.2, 5.1, 4.6, 4.5, 4.8, 5.6, 5.3, 5.6, 5.6, 5.5], temp: [27.0, 27.0, 27.0, 26.5, 24.5, 23.5, 23.5, 25.5, 27.5, 28.0, 27.5, 27.0] },
  { id: "brasilia", name: "Brasília", uf: "DF", lat: -15.79, lon: -47.88, amp: 11, ghi: [5.2, 5.5, 5.1, 5.1, 5.0, 5.0, 5.3, 6.0, 5.8, 5.4, 4.9, 5.0], temp: [21.6, 21.8, 22.0, 21.4, 20.2, 19.0, 19.1, 21.0, 22.3, 22.2, 21.6, 21.5] },
  { id: "campogrande", name: "Campo Grande", uf: "MS", lat: -20.46, lon: -54.62, amp: 11, ghi: [5.6, 5.6, 5.3, 5.0, 4.3, 4.1, 4.3, 5.1, 5.2, 5.6, 5.9, 5.9], temp: [25.0, 25.0, 24.8, 23.5, 21.0, 20.0, 20.0, 22.0, 23.5, 25.0, 25.0, 25.0] },
  { id: "bh", name: "Belo Horizonte", uf: "MG", lat: -19.92, lon: -43.94, amp: 9, ghi: [5.6, 5.9, 5.2, 4.8, 4.3, 4.2, 4.4, 5.1, 5.3, 5.5, 5.1, 5.2], temp: [23.0, 23.4, 23.0, 22.0, 20.0, 19.0, 18.8, 20.0, 21.5, 22.5, 22.6, 22.6] },
  { id: "rio", name: "Rio de Janeiro", uf: "RJ", lat: -22.91, lon: -43.17, amp: 7, ghi: [6.0, 6.2, 5.3, 4.6, 3.9, 3.6, 3.8, 4.5, 4.7, 5.2, 5.4, 5.8], temp: [26.5, 27.0, 26.3, 25.0, 23.5, 22.4, 22.0, 22.5, 23.0, 24.0, 25.0, 26.0] },
  { id: "saopaulo", name: "São Paulo", uf: "SP", lat: -23.55, lon: -46.63, amp: 8, ghi: [5.2, 5.4, 4.7, 4.2, 3.5, 3.3, 3.4, 4.3, 4.4, 5.0, 5.3, 5.4], temp: [22.5, 22.8, 22.0, 20.5, 18.0, 17.0, 16.5, 17.8, 18.8, 20.0, 21.0, 22.0] },
  { id: "curitiba", name: "Curitiba", uf: "PR", lat: -25.43, lon: -49.27, amp: 9, ghi: [5.3, 5.1, 4.6, 3.9, 3.2, 2.9, 3.1, 4.0, 4.0, 4.6, 5.3, 5.6], temp: [20.5, 20.8, 19.8, 17.5, 15.0, 13.5, 13.0, 14.5, 15.5, 17.0, 18.5, 19.8] },
  { id: "floripa", name: "Florianópolis", uf: "SC", lat: -27.59, lon: -48.55, amp: 7, ghi: [5.7, 5.3, 4.7, 3.9, 3.2, 2.8, 2.9, 3.5, 3.8, 4.6, 5.5, 5.8], temp: [24.5, 24.8, 24.0, 22.0, 19.5, 17.5, 17.0, 17.5, 18.5, 20.0, 21.8, 23.5] },
  { id: "poa", name: "Porto Alegre", uf: "RS", lat: -30.03, lon: -51.23, amp: 9, ghi: [6.3, 5.7, 4.9, 3.9, 2.9, 2.4, 2.6, 3.3, 4.1, 5.3, 6.3, 6.6], temp: [24.6, 24.7, 23.0, 20.0, 16.8, 14.5, 14.0, 15.5, 17.0, 19.5, 21.5, 23.5] },
];

export const cityById = (id: string) => CITIES.find((c) => c.id === id) ?? CITIES[0];

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Mês (0–11) de um dia do ano (1–365). */
export function monthOf(doy: number) {
  const d = ((((doy - 1) % 365) + 365) % 365) + 1;
  for (let m = 0; m < 12; m++) if (d <= MONTH_START[m + 1]) return m;
  return 11;
}

/** Rótulo "12/mar" de um dia do ano. */
export function dateLabel(doy: number) {
  const d = ((((doy - 1) % 365) + 365) % 365) + 1;
  const m = monthOf(d);
  return `${d - MONTH_START[m]}/${MONTHS[m]}`;
}

/** Dia do ano do dia 15 de cada mês. */
export const midMonth = (m: number) => MONTH_START[m] + 15;

/** Valor mensal interpolado suavemente para um dia do ano (evita degraus na virada do mês). */
export function monthlyInterp(values: number[], doy: number) {
  const x = ((doy - 15.5) / 365) * 12;
  const i = Math.floor(x);
  const f = x - i;
  const a = values[((i % 12) + 12) % 12];
  const b = values[(((i + 1) % 12) + 12) % 12];
  return a + (b - a) * f;
}
