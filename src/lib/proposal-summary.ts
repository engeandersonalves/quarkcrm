import { productOf } from "./constants";
import { fmtNum } from "./pricing";
import type { Proposal } from "./types";

/** Título curto de um orçamento, conforme o produto. */
export function proposalHeadline(p: Pick<Proposal, "inputs" | "power_kwp">) {
  const product = productOf(p.inputs);
  if (product === "manutencao") return `Manutenção ${fmtNum(Number(p.power_kwp), 2)} kWp`;
  return product === "save" ? `S.A.V.E ${fmtNum(Number(p.power_kwp), 1)} kW` : `${fmtNum(Number(p.power_kwp), 2)} kWp`;
}

/** Linha de detalhes de um orçamento, conforme o produto. */
export function proposalSummary(p: Pick<Proposal, "inputs" | "power_kwp" | "monthly_generation">) {
  if (productOf(p.inputs) === "manutencao") {
    const m = Number(p.inputs.moduleQty ?? 0);
    return `Manutenção · ${m ? `${fmtNum(m)} módulos · ` : ""}${fmtNum(Number(p.power_kwp), 2)} kWp`;
  }
  if (productOf(p.inputs) === "save") {
    const d = Number(p.inputs.distanceM ?? 0);
    return `Carregador ${fmtNum(Number(p.power_kwp), 1)} kW${d ? ` · ${fmtNum(d)} m` : ""}`;
  }
  return `${fmtNum(Number(p.power_kwp), 2)} kWp · ${fmtNum(Number(p.monthly_generation))} kWh/mês`;
}
