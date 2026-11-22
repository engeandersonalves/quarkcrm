/**
 * Roleta de prêmios do catálogo online. O sorteio acontece no servidor (pelo peso de cada
 * prêmio) e cada WhatsApp gira uma vez só. Para mudar prêmios ou chances, edite só aqui.
 */

export type PrizeKind = "cupom" | "brinde";

export interface Prize {
  key: string;
  /** Nome completo ("Cupom de R$ 200"). */
  label: string;
  /** Texto curto na fatia da roleta. */
  short: string[];
  kind: PrizeKind;
  /** Desconto em R$ (cupons). */
  value: number;
  /** Peso no sorteio (chance = peso / soma dos pesos). */
  weight: number;
  /** Cor da fatia. */
  fill: string;
  ink: string;
}

export const PRIZES: Prize[] = [
  { key: "capacete", label: "Capacete grátis", short: ["CAPACETE", "GRÁTIS"], kind: "brinde", value: 0, weight: 30, fill: "#0B1A12", ink: "#FFFFFF" },
  { key: "cupom100", label: "Cupom de R$ 100", short: ["R$ 100", "OFF"], kind: "cupom", value: 100, weight: 25, fill: "#E2C35C", ink: "#0B1A12" },
  { key: "suporte", label: "Suporte de celular com carregador USB", short: ["SUPORTE", "+ USB"], kind: "brinde", value: 0, weight: 20, fill: "#1F9D55", ink: "#FFFFFF" },
  { key: "cupom200", label: "Cupom de R$ 200", short: ["R$ 200", "OFF"], kind: "cupom", value: 200, weight: 13, fill: "#0B1A12", ink: "#E2C35C" },
  { key: "bau", label: "Baú grátis", short: ["BAÚ", "GRÁTIS"], kind: "brinde", value: 0, weight: 10, fill: "#F4EBC9", ink: "#0B1A12" },
  { key: "cupom300", label: "Cupom de R$ 300", short: ["R$ 300", "OFF"], kind: "cupom", value: 300, weight: 2, fill: "#C9A13B", ink: "#0B1A12" },
];

export const prizeByKey = (key: string | null | undefined) => PRIZES.find((p) => p.key === key) ?? null;

/** Chance de cada prêmio em % (para o regulamento). */
export const chances = () => {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  return PRIZES.map((p) => ({ key: p.key, label: p.label, pct: Math.round((p.weight / total) * 1000) / 10 }));
};

/** Sorteia pelo peso. `r` em [0, 1). */
export function drawPrize(r: number): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let x = Math.max(0, Math.min(0.999999, r)) * total;
  for (const p of PRIZES) {
    if (x < p.weight) return p;
    x -= p.weight;
  }
  return PRIZES[0];
}

/** Código do cupom: QK- + 5 caracteres fáceis de ditar (sem 0/O, 1/I). */
export function prizeCode(bytes: Uint8Array) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `QK-${Array.from(bytes.slice(0, 5), (b) => A[b % A.length]).join("")}`;
}

/** Ângulo final da roleta para parar com o prêmio no ponteiro (topo). */
export function spinAngle(key: string, turns = 6, jitter = 0) {
  const i = Math.max(0, PRIZES.findIndex((p) => p.key === key));
  const slice = 360 / PRIZES.length;
  // Fatia i ocupa [i*slice, (i+1)*slice) a partir do topo, no sentido horário.
  const center = i * slice + slice / 2;
  return turns * 360 + (360 - center) + jitter * slice * 0.35;
}
