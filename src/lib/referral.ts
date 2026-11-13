/** Comissão que quem indica escolhe na tela /indique: % do projeto ou valor em R$. */
export type CommissionKind = "percent" | "fixed";

/** Lê o valor digitado ("2,5", "1.500", "300"). Inválido ou fora do limite = null. */
export function parseCommission(
  kind: CommissionKind,
  raw: string,
): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(
    kind === "fixed"
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(",", "."),
  );
  if (!Number.isFinite(n) || n <= 0) return null;
  if (kind === "percent" && n > 100) return null;
  if (kind === "fixed" && n > 1_000_000) return null;
  return n;
}

/** "2,5% do valor do projeto" ou "R$ 300". */
export function commissionText(kind: CommissionKind, value: number) {
  if (kind === "percent")
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do valor do projeto`;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
