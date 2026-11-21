"use client";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Modal, cx } from "@/components/ui";
import { DEFAULT_SIGNATURE } from "@/lib/defaults";
import { documentTitle, emptyContractor } from "@/lib/documents";
import { PAY_LABEL, PAY_METHODS, type PayMethod } from "@/lib/moto-ledger";
import type { MotoProduct } from "@/lib/moto-products";
import { applyProduct, defaultMoto, motoPhoto, type MotoData } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";

/**
 * Registrar venda: lança uma scooter vendida direto no controle de vendas, sem passar
 * por orçamento ou contrato. O contrato pode ser gerado depois, a partir da própria venda.
 */

const INPUT = "h-11 w-full rounded-xl bg-ink-50 px-3 text-[14.5px] ring-1 ring-ink-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.04] dark:ring-white/10";
const LABEL = "mb-1 block text-[12.5px] font-semibold text-ink-500";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const money = (v: number) => (v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const parseMoney = (v: string) => Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
const digits = (v: string) => v.replace(/\D/g, "");
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());

interface Line {
  key: number;
  method: PayMethod;
  amount: string;
  installments: string;
  paid: boolean;
}

export function RegisterSale({ open, onClose, products, onSaved }: { open: boolean; onClose: () => void; products: MotoProduct[]; onSaved: (id: string) => void }) {
  const { settings } = useApp();
  const active = useMemo(() => products.filter((p) => p.active), [products]);
  const [f, setF] = useState({ name: "", phone: "", doc: "", city: "", slug: "", color: "", price: "", date: today(), delivered: true, deliveryDate: "" });
  const [lines, setLines] = useState<Line[]>([{ key: 1, method: "pix", amount: "", installments: "", paid: true }]);
  const [busy, setBusy] = useState(false);
  const product = active.find((p) => p.slug === f.slug) ?? null;
  const price = parseMoney(f.price);
  const total = lines.reduce((t, l) => t + parseMoney(l.amount), 0);

  const pick = (p: MotoProduct) => {
    setF({ ...f, slug: p.slug, color: p.colors[0] ?? "", price: money(p.price) });
    // Com uma forma só, o valor acompanha o preço do modelo.
    if (lines.length === 1) setLines([{ ...lines[0], amount: money(p.price) }]);
  };
  const setLine = (key: number, patch: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (method: PayMethod) => setLines([...lines, { key: Date.now(), method, amount: money(Math.max(0, price - total)), installments: method === "cartao" ? "10" : "", paid: method !== "boleto" }]);

  const reset = () => {
    setF({ name: "", phone: "", doc: "", city: "", slug: "", color: "", price: "", date: today(), delivered: true, deliveryDate: "" });
    setLines([{ key: 1, method: "pix", amount: "", installments: "", paid: true }]);
  };

  const save = async () => {
    if (f.name.trim().length < 3) return toast.error("Digite o nome do cliente.");
    if (digits(f.phone).length < 10) return toast.error("Digite o celular do cliente com DDD.");
    if (!product) return toast.error("Escolha a scooter vendida.");
    if (!(price > 0)) return toast.error("Digite o preço da venda.");
    const pays = lines.filter((l) => parseMoney(l.amount) > 0);
    if (!pays.length) return toast.error("Informe pelo menos uma forma de pagamento com valor.");
    setBusy(true);
    try {
      const place = settings.city ? (settings.city.includes("/") ? settings.city : `${settings.city}/AL`) : "Maceió/AL";
      const base = applyProduct(
        defaultMoto({
          client: { name: f.name.trim(), phone: digits(f.phone), doc: digits(f.doc), city: f.city.trim() },
          contractor: emptyContractor({
            ...settings.contract_defaults?.contractor,
            name: settings.contract_defaults?.contractor?.name || (settings.legal_name || settings.company_name).toUpperCase(),
            doc: settings.contract_defaults?.contractor?.doc || settings.cnpj,
            address: settings.contract_defaults?.contractor?.address || settings.address,
            city: settings.contract_defaults?.contractor?.city || (settings.city || "").split("/")[0],
          }),
          signature: settings.signature_url || DEFAULT_SIGNATURE,
          place,
        }),
        product,
      );
      const one = pays.length === 1 ? pays[0] : null;
      const data: MotoData & { registeredAt: string } = {
        ...base,
        color: f.color.trim() || base.color,
        price,
        date: f.date,
        registeredAt: f.date,
        delivery: { mode: "retirada", address: "", date: f.delivered ? f.date : f.deliveryDate },
        payment:
          one?.method === "cartao"
            ? { ...base.payment, method: "cartao", installments: Number(one.installments) || 1, installmentValue: Math.round((parseMoney(one.amount) / (Number(one.installments) || 1)) * 100) / 100 }
            : one && (one.method === "pix" || one.method === "dinheiro" || one.method === "transferencia")
              ? { ...base.payment, method: "pix" }
              : { ...base.payment, method: "personalizado", custom: pays.map((l) => `${brl(parseMoney(l.amount))} ${PAY_LABEL[l.method].toLowerCase()}${l.method === "cartao" ? ` em ${Number(l.installments) || 1}x` : ""}`).join(" + ") },
      };
      const { data: row, error } = await supabase()
        .from("documents")
        .insert({ kind: "moto", title: documentTitle("moto", data), data, status: "registrada", completed_at: `${f.date}T12:00:00-03:00` })
        .select("id")
        .single();
      if (error || !row) throw new Error(/registrada|status_check/.test(error?.message ?? "") ? "Rode o schema.sql no Supabase para registrar vendas." : (error?.message ?? "Não foi possível salvar"));
      const id = (row as { id: string }).id;
      const [p, i] = await Promise.all([
        supabase()
          .from("moto_payments")
          .insert(pays.map((l, n) => ({ document_id: id, method: l.method, amount: parseMoney(l.amount), installments: l.method === "cartao" ? Number(l.installments) || 1 : null, date: f.date, paid: l.paid, position: n }))),
        supabase()
          .from("moto_sale_info")
          .upsert({ document_id: id, delivered_at: f.delivered ? f.date : null, delivery_date: f.delivered ? f.date : f.deliveryDate || null, updated_at: new Date().toISOString() }, { onConflict: "document_id" }),
      ]);
      if (p.error || i.error) toast.message("Venda salva. Confira os pagamentos e a entrega na aba Vendas.");
      else toast.success(`Venda de ${f.name.trim().split(/\s+/)[0]} registrada`);
      reset();
      onSaved(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };

  const diff = Math.round((total - price) * 100) / 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Registrar venda"
      subtitle="Lança a scooter vendida direto no controle. O contrato pode ser gerado depois."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className={cx("text-[13px]", Math.abs(diff) > 0.5 && price > 0 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-ink-500")}>
            {price > 0 ? (Math.abs(diff) > 0.5 ? `Pagamentos ${diff > 0 ? "acima" : "abaixo"} do preço em ${brl(Math.abs(diff))}` : `Total ${brl(total)}`) : ""}
          </p>
          <button type="button" disabled={busy} onClick={save} className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-6 text-[14.5px] font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar venda
          </button>
        </div>
      }
    >
      <div className="grid gap-5">
        {/* cliente */}
        <section>
          <p className="mb-2 text-[12px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-400">1 · Cliente</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={LABEL}>Nome completo</span>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" className={INPUT} autoComplete="off" />
            </label>
            <label>
              <span className={LABEL}>Celular (WhatsApp)</span>
              <input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="(82) 9 0000-0000" className={INPUT} autoComplete="off" />
            </label>
            <label>
              <span className={LABEL}>CPF (opcional)</span>
              <input inputMode="numeric" value={f.doc} onChange={(e) => setF({ ...f, doc: e.target.value })} placeholder="000.000.000-00" className={INPUT} autoComplete="off" />
            </label>
          </div>
        </section>

        {/* scooter */}
        <section>
          <p className="mb-2 text-[12px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-400">2 · Scooter</p>
          {active.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {active.map((p) => (
                <button key={p.slug} type="button" onClick={() => pick(p)} className={cx("flex items-center gap-2.5 rounded-2xl p-2.5 text-left ring-1 transition", f.slug === p.slug ? "bg-emerald-50 ring-2 ring-emerald-500 dark:bg-emerald-500/10" : "ring-ink-200 hover:ring-ink-300 dark:ring-white/10")}>
                  <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-[#050706]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={motoPhoto({ photo: p.photo, model: p.slug })} alt="" className="max-h-8 w-auto object-contain" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="block text-[12px] text-ink-500 tabular-nums">{brl(p.price)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13.5px] text-amber-700">Cadastre os modelos em Mobilidade → Modelos para registrar vendas.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label>
              <span className={LABEL}>Cor</span>
              <input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} list="rs-colors" placeholder="Ex.: Preta" className={INPUT} />
              <datalist id="rs-colors">{product?.colors.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>
              <span className={LABEL}>Preço da venda (R$)</span>
              <input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} onBlur={() => price && setF({ ...f, price: money(price) })} placeholder="0,00" className={cx(INPUT, "tabular-nums")} />
            </label>
            <label className="col-span-2 sm:col-span-1">
              <span className={LABEL}>Data da venda</span>
              <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value || today() })} className={INPUT} />
            </label>
          </div>
        </section>

        {/* pagamento */}
        <section>
          <p className="mb-2 text-[12px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-400">3 · Pagamento</p>
          <div className="grid gap-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-ink-50/70 p-2.5 sm:grid-cols-[140px_minmax(0,1fr)_72px_104px_36px] dark:bg-white/[0.03]">
                <select value={l.method} onChange={(e) => setLine(l.key, { method: e.target.value as PayMethod, installments: e.target.value === "cartao" ? l.installments || "10" : "" })} className={INPUT} aria-label="Forma de pagamento">
                  {PAY_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input inputMode="decimal" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} onBlur={() => parseMoney(l.amount) && setLine(l.key, { amount: money(parseMoney(l.amount)) })} placeholder="Valor" className={cx(INPUT, "tabular-nums")} aria-label="Valor" />
                <input inputMode="numeric" value={l.installments} disabled={l.method !== "cartao"} onChange={(e) => setLine(l.key, { installments: digits(e.target.value).slice(0, 2) })} placeholder={l.method === "cartao" ? "x" : "—"} className={cx(INPUT, "disabled:opacity-40")} aria-label="Parcelas" />
                <button type="button" onClick={() => setLine(l.key, { paid: !l.paid })} className={cx("h-11 rounded-xl text-[13px] font-semibold ring-1", l.paid ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-ink-700 ring-ink-200 dark:bg-white/[0.04] dark:text-ink-200 dark:ring-white/10")}>
                  {l.paid ? "Pago" : "A receber"}
                </button>
                <button type="button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((x) => x.key !== l.key))} aria-label="Remover forma" className="col-span-2 grid h-9 place-items-center rounded-xl text-ink-400 hover:text-rose-600 disabled:opacity-30 sm:col-span-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["pix", "cartao", "boleto", "dinheiro"] as PayMethod[]).map((m) => (
              <button key={m} type="button" onClick={() => addLine(m)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold ring-1 ring-ink-200 hover:ring-ink-300 dark:ring-white/10">
                <Plus className="h-3.5 w-3.5" /> {PAY_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-ink-400">Pagou de mais de um jeito? Adicione uma linha para cada forma (ex.: parte no PIX, parte no cartão).</p>
        </section>

        {/* entrega */}
        <section>
          <p className="mb-2 text-[12px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-400">4 · Entrega</p>
          <div className="flex flex-wrap items-center gap-2">
            {[
              [true, "Já entregue"],
              [false, "Falta entregar"],
            ].map(([v, label]) => (
              <button key={String(v)} type="button" onClick={() => setF({ ...f, delivered: v as boolean })} className={cx("h-10 rounded-full px-4 text-[13.5px] font-semibold ring-1", f.delivered === v ? "bg-[#0B1A12] text-white ring-[#0B1A12] dark:bg-white dark:text-[#0B1A12]" : "ring-ink-200 dark:ring-white/10")}>
                {label as string}
              </button>
            ))}
            {!f.delivered && (
              <label className="flex items-center gap-2 text-[13px] text-ink-500">
                previsão
                <input type="date" value={f.deliveryDate} onChange={(e) => setF({ ...f, deliveryDate: e.target.value })} className={cx(INPUT, "h-10 w-auto")} />
              </label>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
