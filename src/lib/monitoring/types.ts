/** Monitoramento de usinas: tipos comuns a todos os fabricantes. */

export type ProviderId = "solarz" | "solis" | "deye" | "solarman" | "sungrow" | "growatt" | "huawei" | "solplanet" | "goodwe" | "livoltek" | "foxess" | "apsystems" | "manual";

export type PlantStatus = "online" | "offline" | "alarm" | "unknown";

/** Uma usina já normalizada (mesmas unidades para qualquer fabricante). */
export interface PlantData {
  externalId: string;
  name: string;
  capacityKwp: number | null;
  powerKw: number | null;
  todayKwh: number | null;
  monthKwh: number | null;
  totalKwh: number | null;
  status: PlantStatus;
  lastUpdate: string | null; // ISO
  address: string | null;
  /** Geração por dia, quando o fabricante devolve o histórico (AAAA-MM-DD → kWh). */
  daily?: { day: string; kwh: number }[];
}

export type Credentials = Record<string, string>;

/** fetch injetável (testes usam uma versão falsa). */
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Leituras elétricas de um inversor. */
export interface DeviceData {
  sn: string;
  name: string;
  model: string | null;
  status: PlantStatus;
  powerKw: number | null;
  todayKwh: number | null;
  totalKwh: number | null;
  temperatureC: number | null;
  frequencyHz: number | null;
  /** Lado CA, por fase. */
  ac: { label: string; voltage: number | null; current: number | null }[];
  /** Lado CC, por string/MPPT. */
  dc: { label: string; voltage: number | null; current: number | null; powerKw: number | null }[];
  /** Tensões entre fases/pernas (R-S, L1-L2…). */
  acLine?: { label: string; voltage: number }[];
  /** Tensão que alimenta o inversor (fase-neutro ou entre pernas no split-phase). */
  gridVoltage?: number | null;
  gridVoltageLabel?: string | null;
  /** Todas as leituras numéricas devolvidas pelo fabricante. */
  readings?: { key: string; value: number; unit: string }[];
  updatedAt: string | null;
}

export interface DayValue {
  day: string; // AAAA-MM-DD
  kwh: number;
}
export interface MonthValue {
  month: string; // AAAA-MM
  kwh: number;
}

export interface ProviderAdapter {
  id: ProviderId;
  fetchPlants: (creds: Credentials, fetch: Fetch) => Promise<PlantData[]>;
  /** Geração dia a dia de um mês (AAAA-MM). */
  fetchDays?: (creds: Credentials, plantId: string, month: string, fetch: Fetch) => Promise<DayValue[]>;
  /** Geração mês a mês de um ano (AAAA). */
  fetchMonths?: (creds: Credentials, plantId: string, year: string, fetch: Fetch) => Promise<MonthValue[]>;
  /** Inversores da usina com tensão, corrente, temperatura… */
  fetchDevices?: (creds: Credentials, plantId: string, fetch: Fetch) => Promise<DeviceData[]>;
}

/** Erro com mensagem já pronta para o usuário. */
export class MonitoringError extends Error {}
