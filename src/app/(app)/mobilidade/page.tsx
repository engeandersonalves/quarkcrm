"use client";

import { BookOpen, Camera, ChevronRight, FileText, LayoutGrid, Plus, ShieldAlert, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { GlyphTile } from "@/components/app/ios-glyphs";
import { Battery3D, Coin3D, Shield3D } from "@/components/icons3d";
import { CadastroPanel } from "@/components/mobilidade/cadastro-panel";
import { CatalogPanel } from "@/components/mobilidade/catalog-panel";
import { ModelsPanel } from "@/components/mobilidade/models-panel";
import { saleCompany } from "@/components/mobilidade/sale-docs";
import { Empty, Skeleton, cx } from "@/components/ui";
import { brlPlain, dateBr } from "@/lib/br";
import { DOC_STATUS } from "@/lib/documents";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { installmentValue, newProduct, profitOf, unitCost, type MotoProduct } from "@/lib/moto-products";
import { useMotoProducts } from "@/lib/moto-products-db";
import { contractValue, motoPhoto, motoTotal, vehicleName, warrantyActive, warrantyEnd, type MotoData } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";

type Filter = "todas" | "rascunho" | "enviado" | "assinado" | "garantia";
type Aba = "vendas" | "modelos" | "clientes" | "catalogo";

const DAY = 86_400_000;
const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");

/** Lucro estimado de uma venda, usando os custos do modelo cadastrado. */
function saleProfit(s: MotoData, products: MotoProduct[]) {
  const p = products.find((x) => x.slug === s.model);
  if (!p || !(unitCost(p.costs) > 0)) return null;
  const qty = Math.max(1, Number(s.qty) || 1);
  const unitPrice = (Number(s.price) || 0) - (Number(s.discount) || 0) / qty;
  return profitOf({ price: unitPrice, costs: p.costs }).profit * qty;
}

function useSales() {
  return useLive(
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
}

export default function MobilidadePage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("aba");
  const aba: Aba = raw === "modelos" || raw === "clientes" || raw === "catalogo" ? raw : raw === "cadastro" ? "clientes" : "vendas";
  const go = (a: Aba) => router.replace(a === "vendas" ? "/mobilidade" : `/mobilidade?aba=${a}`, { scroll: false });
  const sales = useSales();
  const { products } = useMotoProducts();

  const all = sales.data ?? [];
  const sale = (d: DocumentRow) => d.data as unknown as MotoData;
  const signed = all.filter((d) => d.status === "assinado");
  const month = new Date().toISOString().slice(0, 7);
  const signedMonth = signed.filter((d) => (d.completed_at ?? d.updated_at).slice(0, 7) === month);
  const revenueMonth = signedMonth.reduce((t, d) => t + contractValue(sale(d)), 0);
  const profits = signedMonth.map((d) => saleProfit(sale(d), products)).filter((v): v is number => v !== null);
  const profitMonth = profits.reduce((t, v) => t + v, 0);
  const waiting = all.filter((d) => d.status === "enviado").length;
  const active = signed.filter((d) => warrantyActive(sale(d))).length;

  const tabs: { id: Aba; label: string; icon: ReactNode; count?: number }[] = [
    { id: "vendas", label: "Vendas", icon: <Wallet className="h-4 w-4" />, count: all.length },
    { id: "modelos", label: "Modelos", icon: <LayoutGrid className="h-4 w-4" />, count: products.length },
    { id: "clientes", label: "Cadastro de clientes", icon: <UserPlus className="h-4 w-4" /> },
    { id: "catalogo", label: "Catálogo online", icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      {/* ----------------------------------------------------------- topo */}
      <section className="relative mb-5 overflow-hidden rounded-[32px] bg-[#040605] px-5 pt-6 pb-5 text-white ring-1 ring-white/[0.06] sm:px-8 sm:pt-8">
        <div className="pointer-events-none absolute -top-48 -right-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.32),rgba(111,191,142,0))]" />
        <div className="pointer-events-none absolute -bottom-56 -left-40 h-[460px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(243,233,59,0.14),rgba(243,233,59,0))]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={products.find((p) => p.photo)?.photo ?? "/mob/mz-perfil.webp"} alt="" className="pointer-events-none absolute -right-6 bottom-0 hidden h-[190px] w-auto object-contain opacity-90 drop-shadow-[0_30px_40px_rgba(0,0,0,0.8)] lg:block" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <GlyphTile id="scooter" size="lg" />
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] text-[#A9DE86] uppercase">Quark Mobilidade</p>
              <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-[34px]">Mobilidade elétrica</h1>
            </div>
          </div>
          <div className="relative z-10 flex gap-2">
            <Link href="/mobilidade/modelo/novo" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-sm font-semibold ring-1 ring-white/15 backdrop-blur hover:bg-white/[0.14]">
              <Plus className="h-4 w-4" /> Modelo
            </Link>
            <Link
              href="/documentos/novo?tipo=moto"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-sm font-bold text-[#0A0D0B] shadow-[0_14px_40px_-12px_rgba(111,191,142,0.9)]"
            >
              <Plus className="h-4 w-4" /> Nova venda
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-2.5 lg:max-w-[780px] lg:grid-cols-4">
          {[
            { icon: <Coin3D size={34} />, k: "Vendido no mês", v: brl0(revenueMonth), s: `${signedMonth.length} ${signedMonth.length === 1 ? "contrato" : "contratos"}` },
            { icon: <Battery3D size={34} />, k: "Lucro do mês", v: profits.length ? brl0(profitMonth) : "—", s: profits.length ? "estimado pelos custos" : "cadastre os custos" },
            { icon: <FileText className="h-7 w-7 text-[#F3E93B]" />, k: "Aguardando", v: String(waiting), s: "assinatura do cliente" },
            { icon: <Shield3D size={34} />, k: "Em garantia", v: String(active), s: "dentro do prazo" },
          ].map((x) => (
            <div key={x.k} className="relative overflow-hidden rounded-[20px] p-3.5 ring-1 ring-white/15" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)" }}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/[0.07] ring-1 ring-white/10">{x.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold tracking-[0.12em] text-white/50 uppercase">{x.k}</p>
                  <p className="truncate text-[19px] leading-tight font-bold tabular-nums">{x.v}</p>
                </div>
              </div>
              <p className="mt-1.5 truncate text-[11px] text-white/45">{x.s}</p>
            </div>
          ))}
        </div>

        {/* abas */}
        <nav className="relative mt-6 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              className={cx(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                aba === t.id ? "bg-[#fff] text-[#0A0D0B]" : "text-white/65 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {t.icon} {t.label}
              {t.count ? <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", aba === t.id ? "bg-[#0A0D0B]/10" : "bg-white/10")}>{t.count}</span> : null}
            </button>
          ))}
        </nav>
      </section>

      {aba === "modelos" ? <ModelsPanel /> : aba === "clientes" ? <CadastroPanel /> : aba === "catalogo" ? <CatalogPanel /> : <Vendas sales={sales} products={products} />}
    </div>
  );
}

function Vendas({ sales, products }: { sales: ReturnType<typeof useSales>; products: MotoProduct[] }) {
  const { settings, profile } = useApp();
  const [filter, setFilter] = useState<Filter>("todas");
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading, error } = sales;
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
  const noSelfie = all.filter((d) => (d.signers ?? []).some((s) => s.role === "comprador" && s.signed_at && !s.selfie_at)).length;
  const active = products.filter((p) => p.active && p.price > 0);

  const pdf = async (d: DocumentRow, which: "orcamento" | "certificado" | "manual") => {
    setBusy(`${d.id}-${which}`);
    try {
      if (which === "manual") {
        const s = sale(d);
        const base = products.find((x) => x.slug === s.model);
        const prod = base ?? newProduct({ slug: s.model, name: s.modelName || "Scooter", photo: motoPhoto(s), specs: { ...newProduct().specs, ...s.specs } });
        const { downloadMotoManual } = await import("@/components/mobilidade/moto-manual");
        await downloadMotoManual(
          { ...prod, photo: prod.photo || motoPhoto(s) },
          { company: settings.company_name, whatsapp: settings.whatsapp || settings.phone, instagram: settings.instagram, city: settings.city },
          { name: s.client.name, doc: s.client.doc, color: s.color, chassis: s.chassis, motorNo: s.motorNo, batteryNo: s.batteryNo, delivery: s.delivery.date, warrantyDays: s.warrantyDays },
        );
        return;
      }
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
    <div className="grid gap-5">
      {/* começar pela scooter */}
      {active.length > 0 && (
        <div>
          <p className="mb-2.5 text-[12px] font-bold tracking-[0.14em] text-ink-500 uppercase">Começar uma venda</p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
            {active.map((p) => (
              <Link
                key={p.slug}
                href={`/documentos/novo?tipo=moto&modelo=${p.slug}`}
                className="group flex w-[260px] shrink-0 items-center gap-3 rounded-[22px] bg-[#050706] p-3 text-white ring-1 ring-white/[0.07] transition hover:ring-[#6FBF8E]/50"
              >
                <span className="grid h-16 w-20 shrink-0 place-items-center rounded-[16px]" style={{ background: `radial-gradient(closest-side, ${p.accent}40, transparent)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo || "/mob/cmp-scooter.webp"} alt="" className="max-h-16 w-auto object-contain transition group-hover:scale-105" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] leading-tight font-bold">{p.name}</span>
                  <span className="block text-[12px] text-white/55">{brl0(p.price)} à vista</span>
                  <span className="block text-[11px] text-white/40">
                    {p.installments}x {brlPlain(installmentValue(p.price, p.installments, p.rate))}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["todas", "Todas"],
            ["rascunho", "Orçamentos"],
            ["enviado", "Aguardando assinatura"],
            ["assinado", "Assinadas"],
            ["garantia", "Em garantia"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={cx("h-9 rounded-full px-4 text-[13px] font-semibold ring-1 transition", filter === v ? "bg-[#0A0D0B] text-[#fff] ring-[#0A0D0B] dark:bg-[#fff] dark:text-[#0A0D0B] dark:ring-[#fff]" : "text-ink-600 ring-ink-200 hover:ring-ink-300")}
          >
            {l}
          </button>
        ))}
        {noSelfie > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <Camera className="h-3.5 w-3.5" /> {noSelfie} {noSelfie === 1 ? "cliente sem selfie" : "clientes sem selfie"}
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-[22px] bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200">Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar as vendas de scooter.</div>
      ) : loading && !data ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <div className="rounded-[28px] ring-1 ring-ink-200">
          <Empty
            icon={<GlyphTile id="scooter" size="lg" />}
            title={all.length ? "Nada neste filtro" : "Nenhuma venda ainda"}
            text="Escolha a scooter acima: o orçamento sai em PDF, o contrato vai por link para assinar com selfie e o certificado de garantia fica pronto na entrega."
          />
        </div>
      ) : (
        <div className="grid gap-2.5">
          {rows.map((d) => {
            const s = sale(d);
            const buyer = (d.signers ?? []).find((x) => x.role === "comprador");
            const end = warrantyEnd(s);
            const inWarranty = d.status === "assinado" && warrantyActive(s);
            const start = new Date(`${s.delivery.date || s.date}T12:00:00`).getTime();
            const left = end ? Math.ceil((new Date(`${end}T23:59:59`).getTime() - Date.now()) / DAY) : 0;
            const used = end && s.warrantyDays ? Math.min(100, Math.max(0, ((Date.now() - start) / (s.warrantyDays * DAY)) * 100)) : 0;
            const st = DOC_STATUS[d.status];
            const profit = saleProfit(s, products);
            return (
              <article key={d.id} className="flex flex-wrap items-center gap-3 rounded-[24px] bg-white p-3 ring-1 ring-ink-200/80 transition hover:ring-ink-300 sm:flex-nowrap sm:p-4 dark:bg-[#111513] dark:ring-white/[0.07]">
                <Link href={`/documentos/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
                  <span className="grid h-16 w-20 shrink-0 place-items-center rounded-[18px] bg-[#050706] ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={motoPhoto(s)} alt="" className="max-h-14 w-auto object-contain" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{s.client.name || "Cliente sem nome"}</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", st.cls)}>{d.status === "rascunho" ? "Orçamento" : st.label}</span>
                      {buyer?.signed_at && !buyer.selfie_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                          <Camera className="h-3 w-3" /> sem selfie
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[13px] text-ink-500">
                      {vehicleName(s)}
                      {s.color ? ` · ${s.color}` : ""} · {relativeTime(d.updated_at)}
                    </span>
                    {d.status === "assinado" && end && (
                      <span className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500">
                        {inWarranty ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-ink-400" />}
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                          <span className={cx("block h-full rounded-full", inWarranty ? "bg-emerald-500" : "bg-ink-300")} style={{ width: `${inWarranty ? used : 100}%` }} />
                        </span>
                        {inWarranty ? `garantia até ${dateBr(end)} · faltam ${left} dias` : left > s.warrantyDays ? `garantia começa na entrega (${dateBr(s.delivery.date)})` : `garantia encerrada em ${dateBr(end)}`}
                      </span>
                    )}
                  </span>
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-[15px] font-bold tabular-nums">{brl0(motoTotal(s))}</span>
                    <span className="block text-[11px] text-ink-500 tabular-nums">
                      {s.payment.method === "cartao" && s.payment.installmentValue > 0 ? `${s.payment.installments}x ${brlPlain(s.payment.installmentValue)}` : s.payment.method === "pix" ? "PIX à vista" : "condição combinada"}
                    </span>
                    {profit !== null && <span className={cx("block text-[11px] font-semibold tabular-nums", profit > 0 ? "text-emerald-600" : "text-rose-600")}>lucro {brl0(profit)}</span>}
                  </span>
                </Link>
                <div className="flex w-full gap-2 sm:w-auto">
                  <button type="button" disabled={!!busy} onClick={() => pdf(d, "orcamento")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 disabled:opacity-50 sm:flex-none">
                    <FileText className="h-3.5 w-3.5" /> {busy === `${d.id}-orcamento` ? "Gerando…" : "Orçamento"}
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => pdf(d, "manual")} title="Manual do cliente com o nome e o chassi dele" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 disabled:opacity-50 sm:flex-none">
                    <BookOpen className="h-3.5 w-3.5" /> {busy === `${d.id}-manual` ? "Gerando…" : "Manual"}
                  </button>
                  {d.status === "assinado" && (
                    <button type="button" disabled={!!busy} onClick={() => pdf(d, "certificado")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 disabled:opacity-50 sm:flex-none">
                      <ShieldCheck className="h-3.5 w-3.5" /> {busy === `${d.id}-certificado` ? "Gerando…" : "Certificado"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
