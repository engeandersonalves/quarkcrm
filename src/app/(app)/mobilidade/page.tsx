"use client";

import { BookOpen, Camera, ChevronRight, FileText, Plus, ShieldCheck, ShieldAlert, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CadastroPanel } from "@/components/mobilidade/cadastro-panel";
import { CatalogPanel } from "@/components/mobilidade/catalog-panel";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { GlyphTile } from "@/components/app/ios-glyphs";
import { MOTO_PHOTO, saleCompany } from "@/components/mobilidade/sale-docs";
import { Badge, Button, Card, Empty, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { dateBr } from "@/lib/br";
import { SCOOTERS } from "@/lib/catalog-mobilidade";
import { DOC_STATUS } from "@/lib/documents";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { contractValue, motoTotal, vehicleName, warrantyActive, warrantyEnd, type MotoData } from "@/lib/moto-sale";
import { brl } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";

type Filter = "todas" | "rascunho" | "enviado" | "assinado" | "garantia";

const DAY = 86_400_000;

type Aba = "vendas" | "cadastro" | "catalogo";

export default function MobilidadePage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("aba");
  const aba: Aba = raw === "cadastro" || raw === "catalogo" ? raw : "vendas";
  const go = (a: Aba) => router.replace(a === "vendas" ? "/mobilidade" : `/mobilidade?aba=${a}`, { scroll: false });

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      <PageHeader
        icon={<GlyphTile id="scooter" size="md" />}
        eyebrow="Quark Mobilidade"
        title="Mobilidade elétrica"
        subtitle="Vendas, cadastro de clientes e catálogo das scooters, tudo em um lugar"
        actions={
          <Button onClick={() => router.push("/documentos/novo?tipo=moto")}>
            <Plus className="h-4 w-4" /> Nova venda
          </Button>
        }
      />
      <Segmented
        className="mb-5"
        value={aba}
        onChange={go}
        options={[
          { value: "vendas", label: <><Wallet className="h-3.5 w-3.5" /> Vendas</> },
          { value: "cadastro", label: <><UserPlus className="h-3.5 w-3.5" /> Cadastro</> },
          { value: "catalogo", label: <><BookOpen className="h-3.5 w-3.5" /> Catálogo</> },
        ]}
      />
      {aba === "cadastro" ? <CadastroPanel /> : aba === "catalogo" ? <CatalogPanel /> : <Vendas />}
    </div>
  );
}

function Vendas() {
  const { settings, profile } = useApp();
  const [filter, setFilter] = useState<Filter>("todas");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error } = useLive(
    async () =>
      must(
        await supabase()
          .from("documents")
          .select("*, signers:document_signers(id,role,name,signed_at,selfie_at,position), lead:leads(id,name)")
          .eq("kind", "moto")
          .neq("status", "cancelado")
          .order("updated_at", { ascending: false })
          .limit(500),
      ) as DocumentRow[],
    [],
    ["documents", "document_signers"],
  );

  const all = data ?? [];
  const sale = (d: DocumentRow) => d.data as unknown as MotoData;
  const rows = useMemo(
    () =>
      all.filter((d) => {
        if (filter === "todas") return true;
        if (filter === "garantia") return d.status === "assinado" && warrantyActive(sale(d));
        return d.status === filter;
      }),
    [all, filter],
  );
  const signed = all.filter((d) => d.status === "assinado");
  const revenue = signed.reduce((t, d) => t + contractValue(sale(d)), 0);
  const waiting = all.filter((d) => d.status === "enviado").length;
  const active = signed.filter((d) => warrantyActive(sale(d))).length;
  const noSelfie = signed.filter((d) => (d.signers ?? []).some((s) => s.role === "comprador" && s.signed_at && !s.selfie_at)).length;

  const pdf = async (d: DocumentRow, which: "orcamento" | "certificado") => {
    setBusy(`${d.id}-${which}`);
    try {
      const m = await import("@/components/mobilidade/sale-pdf");
      const c = saleCompany(settings, profile);
      if (which === "orcamento") await m.downloadMotoQuote(sale(d), c, d.id);
      else await m.downloadMotoCertificate(sale(d), c, d.id, (d.signers ?? []).find((s) => s.role === "comprador")?.signed_at ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>

      {/* vitrine: começar uma venda por modelo */}
      <div className="relative mb-5 overflow-hidden rounded-[28px] bg-[#050706] p-5 text-white ring-1 ring-white/[0.06] sm:p-7">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.28),rgba(111,191,142,0))]" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#A9DE86] uppercase">Nova venda em 3 passos</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">Escolha o modelo e gere orçamento, contrato e garantia.</p>
          </div>
          <p className="text-sm text-white/55">Garantia padrão de 90 dias · selfie na assinatura</p>
        </div>
        <div className="relative mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {SCOOTERS.map((s) => (
            <Link
              key={s.id}
              href={`/documentos/novo?tipo=moto&modelo=${s.id}`}
              className="group flex items-center gap-3 rounded-[20px] bg-white/[0.04] p-3 ring-1 ring-white/[0.08] transition hover:bg-white/[0.08] hover:ring-[#6FBF8E]/40"
            >
              <span className="grid h-16 w-20 shrink-0 place-items-center rounded-[14px] bg-[radial-gradient(closest-side,rgba(159,219,124,0.25),transparent)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MOTO_PHOTO[s.id]} alt="" className="max-h-16 w-auto object-contain transition group-hover:scale-105" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] leading-tight font-bold">{s.name}</span>
                <span className="block text-[12px] text-white/50">
                  {brl(s.cash)} à vista · {s.installments}x {brl(s.installment)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Wallet, label: "Vendido", value: brl(revenue), sub: `${signed.length} ${signed.length === 1 ? "contrato assinado" : "contratos assinados"}` },
          { icon: FileText, label: "Aguardando assinatura", value: String(waiting), sub: "contratos enviados" },
          { icon: ShieldCheck, label: "Garantias ativas", value: String(active), sub: "dentro dos 90 dias" },
          { icon: Camera, label: "Sem selfie", value: String(noSelfie), sub: noSelfie ? "peça a selfie ao cliente" : "todas confirmadas" },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </p>
            <p className="tnum mt-1 font-display text-2xl font-semibold">{k.value}</p>
            <p className="text-xs text-ink-400">{k.sub}</p>
          </Card>
        ))}
      </div>

      <Segmented
        className="mb-4"
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "todas", label: "Todas" },
          { value: "rascunho", label: "Orçamentos" },
          { value: "enviado", label: "Aguardando" },
          { value: "assinado", label: "Assinadas" },
          { value: "garantia", label: "Em garantia" },
        ]}
      />

      {error ? (
        <Card className="p-6 text-sm text-ink-600">Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar as vendas de scooter.</Card>
      ) : loading && !data ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <Card>
          <Empty
            icon={<GlyphTile id="scooter" size="lg" />}
            title={all.length ? "Nada neste filtro" : "Nenhuma venda ainda"}
            text="Comece pelo modelo: o orçamento sai em PDF, o contrato vai por link para assinar com selfie e o certificado de garantia fica pronto na entrega."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {rows.map((d) => {
              const s = sale(d);
              const buyer = (d.signers ?? []).find((x) => x.role === "comprador");
              const end = warrantyEnd(s);
              const inWarranty = d.status === "assinado" && warrantyActive(s);
              const start = new Date(`${s.delivery.date || s.date}T12:00:00`).getTime();
              const left = end ? Math.ceil((new Date(`${end}T23:59:59`).getTime() - Date.now()) / DAY) : 0;
              const pctUsed = end && s.warrantyDays ? Math.min(100, Math.max(0, ((Date.now() - start) / (s.warrantyDays * DAY)) * 100)) : 0;
              const st = DOC_STATUS[d.status];
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                  <Link href={`/documentos/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-14 w-16 shrink-0 place-items-center rounded-2xl bg-ink-950 ring-1 ring-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={MOTO_PHOTO[s.model] ?? MOTO_PHOTO.outro} alt="" className="max-h-12 w-auto object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{s.client.name || "Cliente sem nome"}</span>
                        <Badge className={st.cls}>{d.status === "rascunho" ? "Orçamento" : st.label}</Badge>
                        {buyer?.signed_at && !buyer.selfie_at && (
                          <Badge className="bg-amber-50 text-amber-800 ring-amber-600/20">
                            <Camera className="h-3 w-3" /> sem selfie
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-ink-500">
                        {vehicleName(s)}
                        {s.color ? ` · ${s.color}` : ""} · {brl(motoTotal(s))}
                        {s.payment.method === "cartao" && s.payment.installmentValue > 0 ? ` · ${s.payment.installments}x ${brl(s.payment.installmentValue)}` : ""} · {relativeTime(d.updated_at)}
                      </span>
                      {d.status === "assinado" && end && (
                        <span className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500">
                          {inWarranty ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-ink-400" />}
                          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                            <span className={cx("block h-full rounded-full", inWarranty ? "bg-emerald-500" : "bg-ink-300")} style={{ width: `${inWarranty ? pctUsed : 100}%` }} />
                          </span>
                          {inWarranty ? `garantia até ${dateBr(end)} · faltam ${left} dias` : left > s.warrantyDays ? `garantia começa na entrega (${dateBr(s.delivery.date)})` : `garantia encerrada em ${dateBr(end)}`}
                        </span>
                      )}
                    </span>
                  </Link>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" loading={busy === `${d.id}-orcamento`} onClick={() => pdf(d, "orcamento")}>
                      <FileText className="h-4 w-4" /> Orçamento
                    </Button>
                    {d.status === "assinado" && (
                      <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" loading={busy === `${d.id}-certificado`} onClick={() => pdf(d, "certificado")}>
                        <ShieldCheck className="h-4 w-4" /> Certificado
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
