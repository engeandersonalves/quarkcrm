"use client";

import { useSearchParams } from "next/navigation";
import { use, useMemo } from "react";
import { useApp } from "@/components/app/app-context";
import { DocEditor, partyFromLead, type EditorDoc } from "@/components/docs/doc-editor";
import { Card, Empty, Skeleton } from "@/components/ui";
import { defaultAluguel, defaultProcuracao, type DocData, type DocKind } from "@/lib/documents";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow, Lead } from "@/lib/types";
import { FileX } from "lucide-react";

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return id === "novo" ? <NewDocument /> : <ExistingDocument id={id} />;
}

function NewDocument() {
  const search = useSearchParams();
  const { settings, settingsLoaded } = useApp();
  const kind: DocKind = search.get("tipo") === "aluguel" ? "aluguel" : "procuracao";
  const leadId = search.get("lead");

  const { data: lead, loading } = useLive(
    async () => (leadId ? (must(await supabase().from("leads").select("*").eq("id", leadId).maybeSingle()) as Lead | null) : null),
    [leadId],
    [],
    { fresh: true },
  );

  const initial = useMemo<EditorDoc | null>(() => {
    if (loading || !settingsLoaded) return null;
    const party = lead ? partyFromLead(lead) : {};
    const place = settings.city ? (settings.city.includes("/") ? settings.city : `${settings.city}/AL`) : "Maceió/AL";
    const data: DocData =
      kind === "procuracao"
        ? defaultProcuracao(
            {
              name: settings.legal_name || settings.company_name,
              doc: settings.cnpj,
              address: settings.address,
              city: settings.city,
              techName: settings.tech_name,
              techRegistry: settings.tech_registry,
            },
            party,
            place,
          )
        : defaultAluguel(party, place);
    return { id: null, kind, data, lead_id: lead?.id ?? null, status: "rascunho", signers: [] };
  }, [loading, settingsLoaded, lead, kind, settings]);

  if (!initial) return <EditorSkeleton />;
  return <DocEditor key={`${kind}-${leadId ?? ""}`} initial={initial} />;
}

function ExistingDocument({ id }: { id: string }) {
  const { data, loading, reload } = useLive(
    async () => must(await supabase().from("documents").select("*, signers:document_signers(*)").eq("id", id).maybeSingle()) as DocumentRow | null,
    [id],
    ["documents", "document_signers"],
    { fresh: true },
  );
  if (loading && !data) return <EditorSkeleton />;
  if (!data)
    return (
      <Card>
        <Empty icon={<FileX className="h-6 w-6" />} title="Documento não encontrado" text="Ele pode ter sido excluído." />
      </Card>
    );
  const initial: EditorDoc = { id: data.id, kind: data.kind, data: data.data as unknown as DocData, lead_id: data.lead_id, status: data.status, signers: data.signers ?? [] };
  // Assinantes e status chegam por props (tempo real); o editor só recomeça quando o texto trava.
  const locked = data.status === "cancelado" || (data.signers ?? []).some((s) => s.signed_at);
  const key = `${data.id}-${locked}`;
  return <DocEditor key={key} initial={initial} onReload={reload} />;
}

function EditorSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[480px_1fr]">
      <Skeleton className="h-[70vh]" />
      <Skeleton className="hidden h-[70vh] lg:block" />
    </div>
  );
}
