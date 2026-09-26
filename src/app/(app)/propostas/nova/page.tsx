"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProposalEditor } from "@/components/proposal/editor";
import { SaveEditor } from "@/components/save/editor";
import type { ProposalInputs } from "@/lib/pricing";

/** Dados vindos do Projeto 3D (geração pela orientação real, módulos e inversor). */
function presetFromParams(p: URLSearchParams): Partial<ProposalInputs> | undefined {
  if (p.get("origem") !== "3d") return undefined;
  const num = (k: string) => {
    const v = Number(p.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const out: Partial<ProposalInputs> = {};
  const set = <K extends keyof ProposalInputs>(k: K, v: ProposalInputs[K] | undefined) => {
    if (v !== undefined && v !== "") out[k] = v;
  };
  set("sunHours", num("hsp"));
  set("moduleQty", num("modulos"));
  set("modulePowerW", num("wp"));
  set("inverterPowerKw", num("inversor"));
  set("performanceRatio", num("pr"));
  set("inverterBrand", p.get("marcaInversor") ?? undefined);
  set("structureType", p.get("estrutura") ?? undefined);
  return out;
}

function NewProposal() {
  const params = useSearchParams();
  if (params.get("tipo") === "save") return <SaveEditor initialLeadId={params.get("lead")} />;
  return <ProposalEditor initialLeadId={params.get("lead")} preset={presetFromParams(params)} />;
}

export default function Page() {
  return (
    <Suspense>
      <NewProposal />
    </Suspense>
  );
}
