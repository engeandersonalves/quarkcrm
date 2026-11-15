"use client";

import { BadgeCheck, BookOpen, Ban, FileText, Loader2, MessageCircle, MoreHorizontal, PencilLine, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { cx } from "@/components/ui";
import { brlPlain, dateBr, digits } from "@/lib/br";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { buyerOf, closedAt, saleStage, warrantyOf, type SaleStage } from "@/lib/moto-board";
import { contractValue, motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";
import { saleCompany } from "./sale-docs";

export const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");

/** Vendas de scooter (todas as abas usam a mesma lista). */
export function useSales() {
  return useLive(
    async () =>
      must(
        await supabase()
          .from("documents")
          .select("*, signers:document_signers(id,role,name,signed_at,selfie_at,position,token), lead:leads(id,name)")
          .eq("kind", "moto")
          .neq("status", "cancelado")
          .order("updated_at", { ascending: false })
          .limit(500),
      ) as DocumentRow[],
    [],
    ["documents", "document_signers"],
  );
}
export type Sales = ReturnType<typeof useSales>;

export const STAGE: Record<SaleStage, { label: string; cls: string }> = {
  orcamento: { label: "Orçamento", cls: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30" },
  aguardando: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30" },
  vendida: { label: "Vendida", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" },
};

export const wa = (phone: string | null | undefined, text = "") => {
  const n = digits(phone);
  if (!n) return null;
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

const BTN = "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap ring-1 ring-ink-200 transition hover:ring-ink-300 disabled:opacity-50 dark:ring-white/[0.12] dark:hover:ring-white/25";

/** Ações de documento: PDFs, apagar orçamento e cancelar contrato não assinado. */
export function useSaleActions(sales: Sales) {
  const { settings, profile } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const pdf = async (doc: DocumentRow, which: "orcamento" | "manual" | "comprovante") => {
    setBusy(`${doc.id}-${which}`);
    try {
      const d = doc.data as unknown as MotoData;
      if (which === "orcamento") await (await import("./sale-pdf")).downloadMotoQuote(d, saleCompany(settings, profile), doc.id);
      else if (which === "manual") await (await import("./moto-manual")).downloadSaleManual(d, doc.id, settings, buyerOf(doc)?.signed_at ?? null);
      else await (await import("./purchase-receipt")).downloadPurchaseReceipt(d, saleCompany(settings, profile), doc.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF");
    } finally {
      setBusy(null);
    }
  };

  const drop = (id: string) => sales.setData((list) => (list ?? []).filter((x) => x.id !== id));

  const remove = async (doc: DocumentRow) => {
    const d = doc.data as unknown as MotoData;
    if (!confirm(`Apagar o orçamento de ${d.client.name || "cliente sem nome"} (${vehicleName(d)})? Isso não pode ser desfeito.`)) return;
    setBusy(`${doc.id}-apagar`);
    try {
      const { error } = await supabase().from("documents").delete().eq("id", doc.id);
      if (error) throw new Error(error.message);
      drop(doc.id);
      toast.success("Orçamento apagado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar");
    } finally {
      setBusy(null);
    }
  };

  /** Apaga vários orçamentos de uma vez (ex.: orçamentos repetidos do mesmo cliente). */
  const removeMany = async (docs: DocumentRow[]) => {
    const list = docs.filter((x) => saleStage(x) === "orcamento");
    if (!list.length || !confirm(`Apagar ${list.length} ${list.length === 1 ? "orçamento" : "orçamentos"}? Isso não pode ser desfeito.`)) return;
    setBusy("lote");
    try {
      const { error } = await supabase().from("documents").delete().in("id", list.map((x) => x.id));
      if (error) throw new Error(error.message);
      const ids = new Set(list.map((x) => x.id));
      sales.setData((all) => (all ?? []).filter((x) => !ids.has(x.id)));
      toast.success(`${list.length} ${list.length === 1 ? "orçamento apagado" : "orçamentos apagados"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (doc: DocumentRow) => {
    const d = doc.data as unknown as MotoData;
    if (!confirm(`Cancelar o contrato de ${d.client.name || "cliente"}? O link de assinatura deixa de funcionar.`)) return;
    setBusy(`${doc.id}-cancelar`);
    try {
      const { error } = await supabase().from("documents").update({ status: "cancelado" }).eq("id", doc.id);
      if (error) throw new Error(error.message);
      drop(doc.id);
      toast.success("Contrato cancelado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar");
    } finally {
      setBusy(null);
    }
  };

  return { busy, pdf, remove, removeMany, cancel };
}
export type SaleActions = ReturnType<typeof useSaleActions>;

function Menu({ items }: { items: { label: string; icon: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Mais ações" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cx(BTN, "w-10 px-0")}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-30 mb-2 w-56 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-ink-200 dark:bg-[#1C1F1D] dark:ring-white/10">
          {items.map((it) => {
            const cls = cx("flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] font-medium hover:bg-ink-50 dark:hover:bg-white/[0.06]", it.danger && "text-rose-600 dark:text-rose-400");
            return it.href ? (
              <Link key={it.label} href={it.href} className={cls} onClick={() => setOpen(false)}>
                {it.icon} {it.label}
              </Link>
            ) : (
              <button
                key={it.label}
                type="button"
                className={cls}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {it.icon} {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Uma venda (orçamento, contrato aguardando ou vendida) com as ações que fazem sentido para ela. */
export function SaleRow({ doc, actions, hideClient, profit }: { doc: DocumentRow; actions: SaleActions; hideClient?: boolean; profit?: number | null }) {
  const d = doc.data as unknown as MotoData;
  const stage = saleStage(doc);
  const st = STAGE[stage];
  const buyer = buyerOf(doc) as (ReturnType<typeof buyerOf> & { token?: string }) | null;
  const w = stage === "vendida" ? warrantyOf(d) : null;
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const { busy, pdf, remove, cancel } = actions;
  const signLink = buyer?.token && typeof window !== "undefined" ? `${window.location.origin}/assinar/${buyer.token}` : "";
  const nudge = stage === "aguardando" ? wa(d.client.phone, `Olá, ${d.client.name.trim().split(/\s+/)[0]}! Seu contrato da scooter ${model} está pronto para assinar pelo celular, leva 1 minuto${signLink ? `: ${signLink}` : "."}`) : null;
  const spin = (k: string) => busy === `${doc.id}-${k}`;

  let detail = "";
  if (stage === "orcamento") detail = `orçamento ${relativeTime(doc.updated_at)}`;
  else if (stage === "aguardando") detail = `contrato enviado ${relativeTime(doc.updated_at)}`;
  else if (w) detail = w.state === "ativa" ? `garantia até ${dateBr(w.end)} · ${w.left} dias` : w.state === "entrega" ? (d.delivery?.date ? `garantia começa na entrega (${dateBr(d.delivery.date)})` : "garantia começa na entrega") : `garantia encerrada em ${dateBr(w.end)}`;

  const menu = [
    { label: stage === "vendida" ? "Abrir venda" : "Abrir e editar", icon: <PencilLine className="h-4 w-4" />, href: `/documentos/${doc.id}` },
    ...(stage !== "orcamento" ? [{ label: "Baixar orçamento", icon: <FileText className="h-4 w-4" />, onClick: () => pdf(doc, "orcamento") }] : []),
    ...(stage === "orcamento" ? [{ label: "Apagar orçamento", icon: <Trash2 className="h-4 w-4" />, onClick: () => remove(doc), danger: true }] : []),
    ...(stage === "aguardando" ? [{ label: "Cancelar contrato", icon: <Ban className="h-4 w-4" />, onClick: () => cancel(doc), danger: true }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-ink-200/80 sm:flex-nowrap dark:bg-[#111513] dark:ring-white/[0.07]">
      <Link href={`/documentos/${doc.id}`} className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
        <span className="grid h-14 w-16 shrink-0 place-items-center rounded-[14px] bg-[#050706]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={motoPhoto(d)} alt="" className="max-h-12 w-auto object-contain" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15px] font-semibold">{hideClient ? `${model}${d.color ? ` · ${d.color}` : ""}` : d.client.name || "Cliente sem nome"}</span>
            <span className={cx("rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1", st.cls)}>{st.label}</span>
          </span>
          {!hideClient && (
            <span className="block truncate text-[13px] text-ink-500">
              {model}
              {d.color ? ` · ${d.color}` : ""}
              {d.chassis ? ` · chassi ${d.chassis}` : ""}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
            {w && (w.state === "encerrada" ? <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-ink-400" /> : <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />)}
            <span className="truncate">{detail}</span>
          </span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-[15px] font-bold tabular-nums">{brl0(contractValue(d))}</span>
          {profit != null && <span className={cx("block text-[11.5px] font-semibold tabular-nums", profit > 0 ? "text-emerald-600" : "text-rose-600")}>lucro {brl0(profit)}</span>}
          {stage === "vendida" && <span className="block text-[11.5px] text-ink-500">{dateBr(closedAt(doc).slice(0, 10))}</span>}
        </span>
      </Link>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {stage === "orcamento" && (
          <button type="button" disabled={!!busy} onClick={() => pdf(doc, "orcamento")} className={cx(BTN, "flex-1 sm:flex-none")}>
            {spin("orcamento") ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Orçamento
          </button>
        )}
        {stage === "aguardando" &&
          (nudge ? (
            <a href={nudge} target="_blank" rel="noopener noreferrer" className={cx(BTN, "flex-1 sm:flex-none")}>
              <MessageCircle className="h-4 w-4 text-emerald-600" /> Cobrar assinatura
            </a>
          ) : (
            <Link href={`/documentos/${doc.id}`} className={cx(BTN, "flex-1 sm:flex-none")}>
              <PencilLine className="h-4 w-4" /> Abrir contrato
            </Link>
          ))}
        {stage === "vendida" && (
          <>
            <button type="button" disabled={!!busy} onClick={() => pdf(doc, "manual")} className={cx(BTN, "flex-1 sm:flex-none")} title="Manual do proprietário com o certificado de garantia">
              {spin("manual") ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />} Manual
            </button>
            <button type="button" disabled={!!busy} onClick={() => pdf(doc, "comprovante")} className={cx(BTN, "flex-1 sm:flex-none")} title="Comprovante de compra e propriedade">
              {spin("comprovante") ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Comprovante
            </button>
          </>
        )}
        <Menu items={menu} />
      </div>
    </div>
  );
}
