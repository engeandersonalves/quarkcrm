import type { PlantStatus, ProviderId } from "./types.ts";

/** Linhas do banco (lado do navegador). */
export interface PlantRow {
  id: string;
  connection_id: string;
  provider: ProviderId;
  external_id: string;
  name: string;
  capacity_kwp: number | null;
  power_kw: number | null;
  today_kwh: number | null;
  month_kwh: number | null;
  total_kwh: number | null;
  status: PlantStatus;
  last_update_at: string | null;
  address: string | null;
  lead_id: string | null;
  synced_at: string;
  lead?: { id: string; name: string } | null;
}

export interface ConnectionRow {
  id: string;
  provider: ProviderId;
  label: string;
  status: "ok" | "error" | "syncing";
  last_error: string | null;
  last_sync_at: string | null;
  plants_count: number;
  created_at: string;
}

const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

export function summarize(plants: PlantRow[]) {
  let powerKw = 0, todayKwh = 0, monthKwh = 0, capacityKwp = 0, online = 0, offline = 0, alarm = 0;
  for (const p of plants) {
    powerKw += n(p.power_kw) ?? 0;
    todayKwh += n(p.today_kwh) ?? 0;
    monthKwh += n(p.month_kwh) ?? 0;
    capacityKwp += n(p.capacity_kwp) ?? 0;
    if (p.status === "online") online++;
    else if (p.status === "alarm") alarm++;
    else if (p.status === "offline") offline++;
  }
  return { total: plants.length, powerKw, todayKwh, monthKwh, capacityKwp, online, offline, alarm };
}

/** Produtividade do dia: kWh gerados por kWp instalado. */
export const yieldOf = (p: Pick<PlantRow, "today_kwh" | "capacity_kwp">) => {
  const t = n(p.today_kwh), c = n(p.capacity_kwp);
  return t !== null && c ? t / c : null;
};

/** Faixa de produtividade para o selo (≥ 4 ótimo, ≥ 2,5 bom, abaixo disso atenção). */
export const yieldBand = (y: number | null) => (y === null ? null : y >= 4 ? "high" : y >= 2.5 ? "mid" : "low");

/** Fração da potência instalada gerando agora (0–1). */
export const loadOf = (p: Pick<PlantRow, "power_kw" | "capacity_kwp">) => {
  const pw = n(p.power_kw), c = n(p.capacity_kwp);
  return pw !== null && c ? Math.max(0, Math.min(1, pw / c)) : null;
};

const nf = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const fmtKw = (v: number | string | null | undefined) => (n(v) === null ? "—" : n(v)! >= 1000 ? `${nf(n(v)! / 1000, 2)} MW` : `${nf(n(v)!, n(v)! < 10 ? 2 : 1)} kW`);
export const fmtKwh = (v: number | string | null | undefined) => (n(v) === null ? "—" : n(v)! >= 10000 ? `${nf(n(v)! / 1000, 1)} MWh` : `${nf(n(v)!, n(v)! < 100 ? 1 : 0)} kWh`);
export const fmtKwp = (v: number | string | null | undefined) => (n(v) === null ? "—" : n(v)! >= 1000 ? `${nf(n(v)! / 1000, 2)} MWp` : `${nf(n(v)!, 2)} kWp`);

export const STATUS_LABEL: Record<PlantStatus, string> = { online: "Gerando", offline: "Offline", alarm: "Alerta", unknown: "Sem dados" };

/** Últimos N dias (AAAA-MM-DD), do mais antigo ao mais novo. */
export function lastDays(count: number, now = new Date()) {
  const base = new Date(now.getTime() - 3 * 3600_000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}
