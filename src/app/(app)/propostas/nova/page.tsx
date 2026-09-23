"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProposalEditor } from "@/components/proposal/editor";

function NewProposal() {
  const params = useSearchParams();
  return <ProposalEditor initialLeadId={params.get("lead")} />;
}

export default function Page() {
  return (
    <Suspense>
      <NewProposal />
    </Suspense>
  );
}
