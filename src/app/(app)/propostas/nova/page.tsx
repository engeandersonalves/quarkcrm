"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProposalEditor } from "@/components/proposal/editor";
import { SaveEditor } from "@/components/save/editor";

function NewProposal() {
  const params = useSearchParams();
  if (params.get("tipo") === "save") return <SaveEditor initialLeadId={params.get("lead")} />;
  return <ProposalEditor initialLeadId={params.get("lead")} />;
}

export default function Page() {
  return (
    <Suspense>
      <NewProposal />
    </Suspense>
  );
}
