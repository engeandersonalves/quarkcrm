"use client";

import { ChevronRight, FileSignature, Plus, ScrollText, ShieldCheck, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Empty, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { DOC_STATUS, ROLE_LABEL, contractKwp, type ContratoData } from "@/lib/documents";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";

type Filter = "todos" | "rascunho" | "enviado" | "assinado";

export default function ContractsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");

  const { data, loading } = useLive(
    async () =>
      must(
        await supabase()
          .from("documents")
          .select("*, signers:document_signers(*), lead:leads(id,name)")
          .eq("kind", "contrato")
          .order("updated_at", { ascending: false })
          .limit(500),
      ) as DocumentRow[],
    [],
    ["documents", "document_signers"],
  );

  const all = data ?? [];
  const rows = useMemo(() => all.filter((d) => filter === "todos" || d.status === filter), [all, filter]);
  const contract = (d: DocumentRow) => d.data as unknown as ContratoData;
  const price = (d: DocumentRow) => Number(contract(d).price) || 0;
  const signed = all.filter((d) => d.status === "assinado");
  const waiting = all.filter((d) => d.status === "enviado").length;
  const signedValue = signed.reduce((t, d) => t + price(d), 0);
  const signedKwp = signed.reduce((t, d) => t + contractKwp(contract(d)), 0);

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <PageHeader
        icon={<ScrollText />}
        eyebrow="Ferramentas"
        title="Contratos"
        subtitle="Contrato de projeto, fornecimento e instalação solar: preencha, gere o PDF e envie para assinar pelo celular"
        actions={
          <Button onClick={() => router.push("/documentos/novo?tipo=contrato")}>
            <Plus className="h-4 w-4" /> Novo contrato
          </Button>
        }
      />

      <Link
        href="/documentos/novo?tipo=contrato"
        className="group relative block overflow-hidden rounded-3xl bg-ink-950 p-5 text-white shadow-lift transition hover:-translate-y-0.5 sm:p-6"
      >
        <div className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-sun-500/30 blur-3xl transition group-hover:bg-sun-500/40" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-brand-lime/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Sun className="h-6 w-6 text-brand-yellow" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-lime uppercase">Seu modelo de contrato</p>
            <p className="mt-1 font-display text-xl font-semibold">Novo contrato de energia solar</p>
            <p className="mt-1 max-w-xl text-sm text-white/65">
              Cliente e endereço, equipamentos, fornecedora, valor e forma de pagamento. Escolha o lead e o contrato já vem com a proposta dele preenchida.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-yellow">
            Criar agora <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Contratos", v: fmtNum(all.length) },
          { k: "Aguardando assinatura", v: fmtNum(waiting) },
          { k: "Valor assinado", v: brl(signedValue, 0) },
          { k: "Potência assinada", v: `${fmtNum(signedKwp, 2)} kWp` },
        ].map((s) => (
          <Card key={s.k} className="p-4">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{s.k}</p>
            <p className="tnum mt-1 font-display text-xl font-semibold text-ink-900">{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 mb-4 max-w-full overflow-x-auto">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos" },
            { value: "rascunho", label: "Rascunho" },
            { value: "enviado", label: "Aguardando" },
            { value: "assinado", label: "Assinados" },
          ]}
        />
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
            title={all.length ? "Nenhum contrato neste filtro" : "Nenhum contrato ainda"}
            text="Crie o contrato a partir do seu modelo e envie o link: o cliente assina pelo celular e a sua assinatura já vai como contratada."
            action={<Button onClick={() => router.push("/documentos/novo?tipo=contrato")}>Criar contrato</Button>}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {rows.map((d) => {
            const c = contract(d);
            const kwp = contractKwp(c);
            const signers = [...(d.signers ?? [])].sort((a, b) => a.position - b.position);
            const done = signers.filter((s) => s.signed_at).length;
            return (
              <Link key={d.id} href={`/documentos/${d.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sun-50 text-sun-700 ring-1 ring-sun-200/70">
                  <Sun className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{c.client?.name?.trim() || d.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                    {kwp > 0 && <span>{fmtNum(kwp, 2)} kWp</span>}
                    {price(d) > 0 && <span>· {brl(price(d), 0)}</span>}
                    {c.supplier?.name && <span className="truncate">· {c.supplier.name}</span>}
                    <span>· {relativeTime(d.updated_at)}</span>
                  </p>
                </div>
                {signers.length > 0 && (
                  <div className="hidden items-center gap-1 sm:flex" title={signers.map((s) => `${ROLE_LABEL[s.role] ?? s.role}: ${s.signed_at ? "assinou" : "pendente"}`).join("\n")}>
                    {signers.map((s) => (
                      <span key={s.id} className={cx("h-2 w-5 rounded-full", s.signed_at ? "bg-emerald-500" : s.viewed_at ? "bg-amber-400" : "bg-ink-200")} />
                    ))}
                    <span className="ml-1 text-xs font-semibold text-ink-500 tabular-nums">
                      {done}/{signers.length}
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
