/** Monitoramento de usinas: tipos comuns a todos os fabricantes. */

export type ProviderId = "solis" | "deye" | "solarman" | "sungrow" | "growatt" | "huawei" | "solplanet";

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

export interface ProviderAdapter {
  id: ProviderId;
  fetchPlants: (creds: Credentials, fetch: Fetch) => Promise<PlantData[]>;
}

/** Erro com mensagem já pronta para o usuário. */
export class MonitoringError extends Error {}
