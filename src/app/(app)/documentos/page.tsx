"use client";

import { ChevronRight, FileSignature, FileText, Home, KeyRound, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Badge, Button, Card, Empty, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { DOC_KINDS, DOC_STATUS, ROLE_LABEL, type DocKind } from "@/lib/documents";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";

type Tab = "todos" | DocKind;

export default function DocumentsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (["procuracao", "aluguel"].includes(params.get("tipo") ?? "") ? params.get("tipo") : "todos") as Tab;

  const { data, loading } = useLive(
    async () =>
      must(await supabase().from("documents").select("*, signers:document_signers(*), lead:leads(id,name)").order("updated_at", { ascending: false }).limit(500)) as DocumentRow[],
    [],
    ["documents", "document_signers"],
  );

  const rows = useMemo(() => (data ?? []).filter((d) => tab === "todos" || d.kind === tab), [data, tab]);
  const waiting = (data ?? []).filter((d) => d.status === "enviado").length;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const signedMonth = (data ?? []).filter((d) => d.status === "assinado" && d.completed_at && new Date(d.completed_at).getTime() >= monthStart).length;

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <PageHeader
        title="Documentos"
        subtitle="Procurações e contratos com assinatura eletrônica pelo celular"
        actions={
          <Button onClick={() => router.push(`/documentos/novo?tipo=${tab === "aluguel" ? "aluguel" : "procuracao"}`)}>
            <Plus className="h-4 w-4" /> Novo documento
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Link
          href="/documentos/novo?tipo=procuracao"
          className="group relative overflow-hidden rounded-3xl bg-ink-950 p-5 text-white shadow-lift transition hover:-translate-y-0.5 sm:p-6"
        >
          <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-sun-500/30 blur-3xl transition group-hover:bg-sun-500/40" />
          <div className="relative flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <KeyRound className="h-6 w-6 text-brand-yellow" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-lime uppercase">Equatorial Alagoas</p>
              <p className="mt-1 font-display text-xl font-semibold">Nova procuração</p>
              <p className="mt-1 text-sm text-white/65">Represente o cliente na distribuidora: projeto, vistoria, troca de medidor, titularidade e rateio.</p>
            </div>
          </div>
          <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-yellow">
            Criar em 1 minuto <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          href="/documentos/novo?tipo=aluguel"
          className="group relative overflow-hidden rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-200/70 transition hover:-translate-y-0.5 hover:shadow-lift sm:p-6"
        >
          <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-brand-lime/25 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sun-50 ring-1 ring-sun-200/70">
              <Home className="h-6 w-6 text-sun-700" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-sun-700 uppercase">Lei do Inquilinato</p>
              <p className="mt-1 font-display text-xl font-semibold">Contrato de aluguel</p>
              <p className="mt-1 text-sm text-ink-500">Residencial, comercial ou área para usina solar. Preencha as partes e o imóvel e envie para assinar.</p>
            </div>
          </div>
          <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sun-700">
            Criar contrato <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={(v) => router.replace(v === "todos" ? "/documentos" : `/documentos?tipo=${v}`)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "procuracao", label: "Procurações" },
            { value: "aluguel", label: "Aluguel" },
          ]}
        />
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-600/15">{waiting} aguardando assinatura</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-600/15">{signedMonth} assinados no mês</span>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !rows.length ? (
        <Card>
          <Empty
            icon={<FileSignature className="h-6 w-6" />}
            title="Nenhum documento ainda"
            text="Crie uma procuração ou um contrato e envie o link: o cliente assina pelo celular, com registro de data, hora e IP."
            action={<Button onClick={() => router.push("/documentos/novo?tipo=procuracao")}>Criar procuração</Button>}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {rows.map((d) => {
            const signers = [...(d.signers ?? [])].sort((a, b) => a.position - b.position);
            const signed = signers.filter((s) => s.signed_at).length;
            return (
              <Link key={d.id} href={`/documentos/${d.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", d.kind === "procuracao" ? "bg-ink-900 text-brand-yellow" : "bg-sun-50 text-sun-700")}>
                  {d.kind === "procuracao" ? <KeyRound className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{d.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                    <span>{DOC_KINDS[d.kind].short}</span>
                    {d.lead && <span className="truncate">· {d.lead.name}</span>}
                    <span>· {relativeTime(d.updated_at)}</span>
                  </p>
                </div>
                {signers.length > 0 && (
                  <div className="hidden items-center gap-1 sm:flex" title={signers.map((s) => `${ROLE_LABEL[s.role] ?? s.role}: ${s.signed_at ? "assinou" : "pendente"}`).join("\n")}>
                    {signers.map((s) => (
                      <span key={s.id} className={cx("h-2 w-5 rounded-full", s.signed_at ? "bg-emerald-500" : s.viewed_at ? "bg-amber-400" : "bg-ink-200")} />
                    ))}
                    <span className="ml-1 text-xs font-semibold text-ink-500 tabular-nums">
                      {signed}/{signers.length}
                    </span>
                  </div>
                )}
                <Badge className={DOC_STATUS[d.status].cls}>
                  {d.status === "assinado" && <ShieldCheck className="h-3 w-3" />}
                  {DOC_STATUS[d.status].label}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
