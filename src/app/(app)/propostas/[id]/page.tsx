"use client";

import { Loader2 } from "lucide-react";
import { use } from "react";
import { ProposalEditor } from "@/components/proposal/editor";
import { SaveEditor } from "@/components/save/editor";
import { productOf } from "@/lib/constants";
import { Empty } from "@/components/ui";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { Proposal } from "@/lib/types";
import { FileText } from "lucide-react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Sem realtime aqui para não sobrescrever o que está sendo editado.
  const { data, loading } = useLive(async () => must(await supabase().from("proposals").select("*").eq("id", id).maybeSingle()) as Proposal | null, [id], []);

  if (loading && !data)
    return (
      <div className="grid h-[60vh] place-items-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!data) return <Empty icon={<FileText className="h-6 w-6" />} title="Orçamento não encontrado" />;
  if (productOf(data.inputs) === "save") return <SaveEditor key={data.id} proposal={data} />;
  return <ProposalEditor key={data.id} proposal={data} />;
}
