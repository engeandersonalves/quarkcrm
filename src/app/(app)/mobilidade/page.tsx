"use client";

import { ArrowLeftRight, BookOpen, Handshake, Home, Receipt, LayoutGrid, Link2, Plus, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { GlyphTile } from "@/components/app/ios-glyphs";
import { WarrantyPanel } from "@/components/mobilidade/board-panels";
import { CatalogPanel } from "@/components/mobilidade/catalog-panel";
import { CustomersPanel, NegotiationPanel } from "@/components/mobilidade/clients-panel";
import { DashboardPanel } from "@/components/mobilidade/dashboard-panel";
import { ModelsPanel } from "@/components/mobilidade/models-panel";
import { useSaleActions, useSales } from "@/components/mobilidade/sale-row";
import { SalesLedger } from "@/components/mobilidade/sales-ledger";
import { SellersPanel, useSellers } from "@/components/mobilidade/sellers-panel";
import { TransfersPanel, useTransfers } from "@/components/mobilidade/transfers-panel";
import { cx } from "@/components/ui";
import { saleStage, todos, warrantyOf } from "@/lib/moto-board";
import { groupClients } from "@/lib/moto-clients";
import { useMotoProducts } from "@/lib/moto-products-db";
import { contractValue, type MotoData } from "@/lib/moto-sale";
import type { DocumentRow } from "@/lib/types";

type Aba = "painel" | "vendas" | "negociacao" | "clientes" | "garantias" | "transferencias" | "vendedores" | "modelos" | "catalogo";
const ABAS: Aba[] = ["painel", "vendas", "negociacao", "clientes", "garantias", "transferencias", "vendedores", "modelos", "catalogo"];
/** Endereços antigos continuam funcionando. */
const ALIAS: Record<string, Aba> = { inicio: "painel", cadastro: "negociacao" };
const sale = (d: DocumentRow) => d.data as unknown as MotoData;

export default function MobilidadePage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("aba");
  const aba: Aba = (raw && ALIAS[raw]) || (ABAS.includes(raw as Aba) ? (raw as Aba) : "painel");
  const go = (a: Aba) => router.replace(a === "painel" ? "/mobilidade" : `/mobilidade?aba=${a}`, { scroll: false });
  const sales = useSales();
  const actions = useSaleActions(sales);
  const { products } = useMotoProducts();
  const all = useMemo(() => sales.data ?? [], [sales.data]);
  const transfers = useTransfers();
  const sellers = useSellers();
  const freshRefs = (sellers.data?.referrals ?? []).filter((r) => r.status === "nova").length;
  const review = (transfers.data ?? []).filter((t) => t.status === "analise").length;
  const openTransfers = (transfers.data ?? []).filter((t) => t.status === "analise" || t.status === "aprovada").length;

  const stats = useMemo(() => {
    const sold = all.filter((d) => saleStage(d) === "vendida");
    return {
      waiting: all.filter((d) => saleStage(d) === "aguardando").length,
      quotes: all.filter((d) => saleStage(d) === "orcamento").length,
      warranty: sold.filter((d) => warrantyOf(sale(d)).state !== "encerrada").length,
      clients: groupClients(all, (d) => contractValue(d)).filter((c) => c.bought > 0).length,
      todo: todos(all).length,
      toDeliver: sold.filter((d) => !(d as { info?: { delivered_at?: string | null } }).info?.delivered_at).length,
    };
  }, [all]);

  const tabs: { id: Aba; label: string; icon: ReactNode; count?: number; alert?: boolean }[] = [
    { id: "painel", label: "Painel", icon: <Home className="h-4 w-4" />, count: stats.todo, alert: stats.todo > 0 },
    { id: "vendas", label: "Vendas", icon: <Receipt className="h-4 w-4" />, count: stats.toDeliver || undefined },
    { id: "negociacao", label: "Negociação", icon: <Wallet className="h-4 w-4" />, count: stats.waiting + stats.quotes },
    { id: "clientes", label: "Clientes", icon: <Users className="h-4 w-4" />, count: stats.clients },
    { id: "garantias", label: "Garantias", icon: <ShieldCheck className="h-4 w-4" />, count: stats.warranty },
    { id: "transferencias", label: "Transferências", icon: <ArrowLeftRight className="h-4 w-4" />, count: openTransfers, alert: review > 0 },
    { id: "vendedores", label: "Vendedores", icon: <Handshake className="h-4 w-4" />, count: freshRefs || (sellers.data?.sellers.filter((x) => x.active).length ?? 0), alert: freshRefs > 0 },
    { id: "modelos", label: "Modelos", icon: <LayoutGrid className="h-4 w-4" />, count: products.length },
    { id: "catalogo", label: "Catálogo online", icon: <BookOpen className="h-4 w-4" /> },
  ];



  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      {/* ----------------------------------------------------------- topo */}
      <section className="relative mb-5 overflow-hidden rounded-[30px] bg-[#040605] px-4 pt-5 pb-4 text-white ring-1 ring-white/[0.06] sm:px-7 sm:pt-7">
        <div className="pointer-events-none absolute -top-48 -right-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.30),rgba(111,191,142,0))]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <GlyphTile id="scooter" size="lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.22em] text-[#A9DE86] uppercase">Quark Mobilidade</p>
              <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">Mobilidade elétrica</h1>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/cliente`;
                navigator.clipboard?.writeText(url).then(
                  () => toast.success("Link da área do cliente copiado. O cliente entra com o CPF e os 4 últimos dígitos do celular da venda."),
                  () => toast.message(url),
                );
              }}
              title="Copiar o link da área do cliente"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-4 text-sm font-semibold whitespace-nowrap ring-1 ring-white/15 hover:bg-white/[0.14]"
            >
              <Link2 className="h-4 w-4" /> Área do cliente
            </button>
            <Link
              href="/documentos/novo?tipo=moto"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-[15px] font-bold text-[#0A0D0B] shadow-[0_14px_40px_-12px_rgba(111,191,142,0.9)] sm:flex-none sm:text-sm"
            >
              <Plus className="h-4 w-4" /> Nova venda
            </Link>
          </div>
        </div>

        {/* abas */}
        <nav className="relative mt-4 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" aria-label="Seções da Mobilidade">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={aba === t.id ? "page" : undefined}
              className={cx(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                aba === t.id ? "bg-[#fff] text-[#0A0D0B]" : "text-white/65 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {t.icon} {t.label}
              {t.count ? (
                <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", t.alert ? "bg-[#FF453A] text-white" : aba === t.id ? "bg-[#0A0D0B]/10" : "bg-white/10")}>{t.count}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </section>

      {aba === "painel" && <DashboardPanel sales={sales} products={products} />}
      {aba === "vendas" && <SalesLedger sales={sales} products={products} />}
      {aba === "negociacao" && <NegotiationPanel sales={sales} actions={actions} startWithCadastro={raw === "cadastro"} />}
      {aba === "clientes" && <CustomersPanel sales={sales} />}
      {aba === "garantias" && <WarrantyPanel sales={sales} actions={actions} />}
      {aba === "transferencias" && <TransfersPanel sales={sales} transfers={transfers} />}
      {aba === "vendedores" && <SellersPanel data={sellers} />}
      {aba === "modelos" && <ModelsPanel />}
      {aba === "catalogo" && <CatalogPanel />}
    </div>
  );
}
