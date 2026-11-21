"use client";

import { Bike, Check, Loader2, PencilLine, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cx } from "@/components/ui";
import { dateBr } from "@/lib/br";
import { saveSaleInfo } from "@/lib/moto-customers-db";
import { buildModelFix, modelLabel } from "@/lib/moto-overrides";
import type { MotoProduct } from "@/lib/moto-products";
import { motoPhoto, type MotoData } from "@/lib/moto-sale";
import type { SaleDoc } from "./sale-row";

const INPUT = "h-10 w-full rounded-xl bg-ink-50 px-3 text-[14px] ring-1 ring-ink-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.04] dark:ring-white/10";
const local = (iso: string) => dateBr(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date(iso)));

/**
 * Corrige o modelo de uma venda (erro de digitação) sem reassinar: o contrato assinado
 * fica igual e a correção vale por cima no CRM, no cartão, na área do cliente e no QR.
 * Preço e pagamento continuam os do contrato.
 */
export function ModelFix({ doc, products, onSaved, className }: { doc: SaleDoc; products: MotoProduct[]; onSaved: () => void; className?: string }) {
  const original = (doc.original ?? doc.data) as unknown as MotoData;
  const current = doc.data as unknown as MotoData;
  const fixed = doc.info?.model_fix?.model ? doc.info.model_fix : null;
  const list = products.filter((p) => p.active || p.slug === current.model);
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState(current.model);
  const [color, setColor] = useState(current.color);
  const [busy, setBusy] = useState(false);
  const product = list.find((p) => p.slug === slug) ?? null;

  const save = async (undo = false) => {
    if (!undo && !product) return void toast.error("Escolha o modelo certo");
    const backToContract = undo || (slug === original.model && color.trim() === original.color.trim());
    if (backToContract && !fixed) return void setEditing(false);
    setBusy(true);
    try {
      await saveSaleInfo(doc.id, { model_fix: backToContract ? null : buildModelFix(original, product!, color) });
      toast.success(backToContract ? "Voltou para o modelo do contrato" : `Modelo corrigido para ${product!.name}. O cliente não precisa assinar de novo.`);
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cx("@container rounded-2xl bg-white p-4 ring-1 ring-ink-200/80 dark:bg-[#121614] dark:ring-white/[0.07]", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] uppercase">
          <span className="text-emerald-600">
            <Bike className="h-4 w-4" />
          </span>
          Modelo
        </p>
        {fixed && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800 ring-1 ring-amber-200">Corrigido</span>}
      </div>

      <div className="flex items-center gap-3">
        <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-ink-50 dark:bg-white/[0.05]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={motoPhoto(current)} alt="" className="max-h-10 w-auto object-contain" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{modelLabel(current).replace(/^Scooter elétrica\s*/, "")}</p>
          {fixed ? (
            <p className="text-[12.5px] text-ink-500">
              No contrato: {fixed.from.replace(/^Scooter elétrica\s*/, "")} · corrigido em {local(fixed.at)}
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-500">Como está no contrato</p>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1 text-[12px] font-semibold text-ink-500">
            Modelo certo
            <select
              value={slug}
              onChange={(e) => {
                const p = list.find((x) => x.slug === e.target.value);
                setSlug(e.target.value);
                setColor(p?.colors.includes(color) ? color : (p?.colors[0] ?? ""));
              }}
              className={INPUT}
            >
              {!list.some((p) => p.slug === slug) && <option value={slug}>{current.modelName || "Modelo do contrato"}</option>}
              {list.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[12px] font-semibold text-ink-500">
            Cor
            <input value={color} onChange={(e) => setColor(e.target.value)} list={`cores-${doc.id}`} placeholder="Ex.: Branca" className={INPUT} />
            <datalist id={`cores-${doc.id}`}>
              {(product?.colors ?? []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <p className="text-[12px] text-ink-400">Preço e pagamento continuam os do contrato. O contrato ganha uma nota de correção e o cliente não precisa assinar de novo.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-xl text-[13px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
              Voltar
            </button>
            <button type="button" disabled={busy} onClick={() => save()} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-[13.5px] font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSlug(current.model);
              setColor(current.color);
              setEditing(true);
            }}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 dark:ring-white/10"
          >
            <PencilLine className="h-4 w-4" /> Corrigir modelo
          </button>
          {fixed && (
            <button type="button" disabled={busy} onClick={() => save(true)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-ink-500 ring-1 ring-ink-200 dark:ring-white/10">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Desfazer
            </button>
          )}
        </div>
      )}
    </section>
  );
}
