/** Recompensa por indicação, mostrada no topo da tela /indique. */
export interface ReferralReward {
  kind: "none" | "percent" | "fixed";
  value: number;
  /** Condição, ex.: "por indicação que fechar contrato". */
  note?: string;
}

export const DEFAULT_REFERRAL: ReferralReward = {
  kind: "none",
  value: 0,
  note: "por indicação que fechar contrato",
};

/** Normaliza o que vem do banco (ou de um formulário). Valor inválido = sem recompensa. */
export function sanitizeReferral(raw: unknown): ReferralReward {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const kind = r.kind === "percent" || r.kind === "fixed" ? r.kind : "none";
  const n =
    typeof r.value === "number"
      ? r.value
      : Number(String(r.value ?? "").replace(",", "."));
  const max = kind === "percent" ? 100 : 1_000_000;
  const value = Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
  const note =
    typeof r.note === "string"
      ? r.note.trim().slice(0, 80)
      : DEFAULT_REFERRAL.note;
  if (kind === "none" || !value) return { kind: "none", value: 0, note };
  return { kind, value, note };
}

/** "R$ 300" ou "2%" (ou null quando não há recompensa). */
export function rewardLabel(r: ReferralReward): string | null {
  if (r.kind === "none" || !(r.value > 0)) return null;
  if (r.kind === "percent")
    return `${r.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return r.value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: r.value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Texto curto que acompanha o valor: "do valor do projeto" para %, vazio para R$. */
export function rewardSuffix(r: ReferralReward) {
  return r.kind === "percent" ? "do valor do projeto" : "";
}
