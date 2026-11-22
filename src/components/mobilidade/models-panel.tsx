"use client";

import { ArrowRight, BookOpen, ClipboardList, Download, Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, Modal, Skeleton, Textarea, cx } from "@/components/ui";
import { brlPlain } from "@/lib/br";
import { installmentValue, parseProducts, profitOf, seedProducts, unitCost, type MotoProduct } from "@/lib/moto-products";
import { saveProducts, useMotoProducts } from "@/lib/moto-products-db";
import { supabase } from "@/lib/supabase/client";
import { ManualOwnerModal } from "./manual-owner-modal";
import { downloadMotoArt } from "./moto-arts";
import type { ManualOwner } from "./moto-manual";

const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");

const EXAMPLE = `Modelo: Sprint 1200
Categoria: A esportiva urbana
Descrição: Faróis full LED, painel digital e freio a disco nas duas rodas.
Motor: 1.000W
Bateria: Lítio 72V 30Ah
Autonomia: 90 km
Velocidade: 32 km/h
Recarga: 6 a 8 h
Carga máxima: 180 kg
Freios: disco nas duas rodas
Peso: 75 kg
Cores: preta, cinza e azul
Custo de compra: R$ 4.900
Frete: 300
Montagem: 150
Impostos: 6%
Comissão: 3%
Preço à vista: R$ 7.990
---
Modelo: Bolt Mini
Motor: 800W
Bateria: Lítio 60V 20Ah
Autonomia: 50 km
Custo: 3.200
Frete: 250
Preço: 5.490`;

function marginTone(p: MotoProduct) {
  if (!(unitCost(p.costs) > 0)) return { cls: "bg-white/10 text-white/60", label: "sem custos" };
  const m = profitOf(p).margin;
  if (m >= 20) return { cls: "bg-[#9FDB7C]/15 text-[#A9DE86]", label: `${m.toLocaleString("pt-BR")}% de margem` };
  if (m >= 10) return { cls: "bg-[#F3E93B]/15 text-[#F3E93B]", label: `${m.toLocaleString("pt-BR")}% de margem` };
  return { cls: "bg-[#FF453A]/15 text-[#FF8A80]", label: `${m.toLocaleString("pt-BR")}% de margem` };
}

/** Mantém o que já existe (fotos, textos) quando o texto colado não traz a informação. */
function merge(old: MotoProduct | undefined, next: MotoProduct): MotoProduct {
  if (!old) return next;
  const pick = <T,>(a: T, b: T) => (b === "" || b === 0 || (Array.isArray(b) && !b.length) ? a : b);
  return {
    ...old,
    name: next.name || old.name,
    kicker: pick(old.kicker, next.kicker),
    pitch: pick(old.pitch, next.pitch),
    forWho: pick(old.forWho, next.forWho),
    colors: pick(old.colors, next.colors),
    specs: Object.fromEntries(Object.entries(old.specs).map(([k, v]) => [k, pick(v, next.specs[k as keyof typeof next.specs])])) as MotoProduct["specs"],
    costs: Object.fromEntries(Object.entries(old.costs).map(([k, v]) => [k, pick(v, next.costs[k as keyof typeof next.costs])])) as MotoProduct["costs"],
    price: pick(old.price, next.price),
    installments: next.installments || old.installments,
    rate: next.rate || old.rate,
  };
}

export function ModelsPanel() {
  const { settings } = useApp();
  const { products, loading, fromSeed, tableMissing, reload } = useMotoProducts();
  const [importOpen, setImportOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [art, setArt] = useState<string | null>(null);
  const brand = { whatsapp: settings.whatsapp || settings.phone, instagram: settings.instagram, city: settings.city };

  const withCosts = products.filter((p) => unitCost(p.costs) > 0 && p.price > 0);
  const avgProfit = withCosts.length ? withCosts.reduce((t, p) => t + profitOf(p).profit, 0) / withCosts.length : 0;
  const avgMargin = withCosts.length ? withCosts.reduce((t, p) => t + profitOf(p).margin, 0) / withCosts.length : 0;

  const seed = async () => {
    setSeeding(true);
    try {
      await saveProducts(seedProducts());
      toast.success("A2, T1, City, Cappuccino e MZ salvos no seu cadastro. Agora complete os custos de cada um.");
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(/moto_products/.test(msg) ? "Rode o supabase/schema.sql atualizado no SQL Editor para ativar o cadastro de modelos." : msg);
    } finally {
      setSeeding(false);
    }
  };

  const [manualFor, setManualFor] = useState<MotoProduct | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const makeManual = async (owner: ManualOwner | null) => {
    if (!manualFor) return;
    setManualBusy(true);
    try {
      const { downloadMotoManual, manualBrand } = await import("./moto-manual");
      await downloadMotoManual(manualFor, manualBrand(settings), owner);
      toast.success(owner ? `Manual + garantia de ${owner.name} baixado` : "Manual + garantia em branco baixado");
      setManualFor(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o manual");
    } finally {
      setManualBusy(false);
    }
  };

  const download = async (p: MotoProduct, kind: "venda" | "ficha" | "manual") => {
    setArt(`${p.slug}-${kind}`);
    try {
      if (kind === "manual") return setManualFor(p);
      await downloadMotoArt(kind, p, brand);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a arte");
    } finally {
      setArt(null);
    }
  };

  if (loading) return <Skeleton className="h-[60vh]" />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Modelos", v: String(products.filter((p) => p.active).length), s: `${products.length} cadastrados` },
          { k: "Lucro médio", v: withCosts.length ? brl0(avgProfit) : "—", s: "por scooter à vista" },
          { k: "Margem média", v: withCosts.length ? `${avgMargin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—", s: "sobre o preço de venda" },
          { k: "Sem custos", v: String(products.length - withCosts.length), s: products.length - withCosts.length ? "complete para ver o lucro" : "todos com lucro calculado" },
        ].map((x) => (
          <div key={x.k} className="rounded-[22px] bg-[#0b0f0d] p-4 text-white ring-1 ring-white/[0.07]">
            <p className="text-[11px] font-bold tracking-[0.14em] text-white/45 uppercase">{x.k}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.v}</p>
            <p className="text-xs text-white/45">{x.s}</p>
          </div>
        ))}
      </div>

      {/* ações */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/mobilidade/modelo/novo">
          <Button>
            <Plus className="h-4 w-4" /> Novo modelo
          </Button>
        </Link>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <Wand2 className="h-4 w-4" /> Cadastrar por texto
        </Button>
        <p className="text-xs text-ink-500">Cole a ficha do fornecedor (um ou vários modelos) e o CRM organiza tudo.</p>
      </div>

      {fromSeed && (
        <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <Sparkles className="h-5 w-5 shrink-0" />
          <p className="min-w-0 flex-1 basis-[220px]">
            {tableMissing ? (
              <>
                <b>Rode o supabase/schema.sql atualizado</b> no SQL Editor do Supabase para salvar modelos. Abaixo, os 5 modelos do catálogo.
              </>
            ) : (
              <>
                Estes são os 5 modelos do catálogo. <b>Salve-os no cadastro</b> para informar os custos e ver o lucro de cada um.
              </>
            )}
          </p>
          {!tableMissing && (
            <Button size="sm" onClick={seed} loading={seeding} className="w-full sm:w-auto">
              Salvar os 3 no cadastro
            </Button>
          )}
        </div>
      )}

      {/* modelos */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const each = installmentValue(p.price, p.installments, p.rate);
          const t = marginTone(p);
          const r = profitOf(p);
          return (
            <article key={p.slug} className={cx("group relative overflow-hidden rounded-[28px] bg-[#050706] text-white ring-1 ring-white/[0.07] transition hover:ring-[#6FBF8E]/40", !p.active && "opacity-60")}>
              <Link href={`/mobilidade/modelo/${p.id || p.slug}`} className="block">
                <div className="relative h-[190px]">
                  <div className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 50% 60%, ${p.accent}40, transparent 70%)` }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo || "/mob/cmp-scooter.webp"} alt="" className="relative mx-auto h-full w-auto object-contain p-3 drop-shadow-[0_24px_30px_rgba(0,0,0,0.7)] transition duration-500 group-hover:scale-[1.04]" />
                  <span className={cx("absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur", t.cls)}>{t.label}</span>
                  {!p.active && <span className="absolute top-3 left-3 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">Oculto</span>}
                </div>
                <div className="px-5 pb-4">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#A9DE86] uppercase">{p.kicker || "Scooter elétrica"}</p>
                  <h3 className="mt-0.5 font-display text-[26px] leading-tight font-semibold tracking-tight">{p.name}</h3>
                  <p className="mt-1 truncate text-[12px] text-white/50">{[p.specs.power, p.specs.battery, p.specs.range].filter(Boolean).join(" · ")}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[16px] bg-white/[0.05] p-3 ring-1 ring-white/[0.07]">
                      <p className="text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">À vista</p>
                      <p className="text-[19px] font-bold tabular-nums">{p.price > 0 ? brl0(p.price) : "—"}</p>
                      <p className="text-[11px] text-white/50 tabular-nums">{p.price > 0 ? `${p.installments}x ${brlPlain(each)}` : "sem preço"}</p>
                    </div>
                    <div className="rounded-[16px] bg-white/[0.05] p-3 ring-1 ring-white/[0.07]">
                      <p className="text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">Lucro</p>
                      <p className={cx("text-[19px] font-bold tabular-nums", unitCost(p.costs) > 0 ? (r.profit > 0 ? "text-[#9FDB7C]" : "text-[#FF8A80]") : "text-white/40")}>{unitCost(p.costs) > 0 ? brl0(r.profit) : "—"}</p>
                      <p className="text-[11px] text-white/50 tabular-nums">{unitCost(p.costs) > 0 ? `custo ${brl0(r.cost)}` : "informe os custos"}</p>
                    </div>
                  </div>
                </div>
              </Link>
              {p.id && <StockStepper p={p} onSaved={reload} />}
              <div className="flex gap-2 border-t border-white/[0.07] px-4 py-3">
                <button type="button" disabled={!!art} onClick={() => download(p, "venda")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[12px] font-semibold ring-1 ring-white/10 hover:bg-white/[0.12] disabled:opacity-50">
                  <Download className="h-3.5 w-3.5" /> {art === `${p.slug}-venda` ? "Gerando…" : "Arte"}
                </button>
                <button type="button" disabled={!!art} onClick={() => download(p, "ficha")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[12px] font-semibold ring-1 ring-white/10 hover:bg-white/[0.12] disabled:opacity-50">
                  <Download className="h-3.5 w-3.5" /> {art === `${p.slug}-ficha` ? "Gerando…" : "Comparativo"}
                </button>
                <button type="button" disabled={!!art} onClick={() => download(p, "manual")} title="Manual do cliente em PDF" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[12px] font-semibold ring-1 ring-white/10 hover:bg-white/[0.12] disabled:opacity-50">
                  <BookOpen className="h-3.5 w-3.5" /> {art === `${p.slug}-manual` ? "Gerando…" : "Manual"}
                </button>
              </div>
            </article>
          );
        })}
        <Link href="/mobilidade/modelo/novo" className="grid min-h-[340px] place-items-center rounded-[28px] border-2 border-dashed border-ink-200 text-center text-ink-500 transition hover:border-emerald-400 hover:text-emerald-600">
          <span>
            <Plus className="mx-auto h-8 w-8" />
            <span className="mt-2 block text-sm font-semibold">Novo modelo</span>
          </span>
        </Link>
      </div>

      <ManualOwnerModal product={manualFor} onClose={() => setManualFor(null)} onGenerate={makeManual} busy={manualBusy} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} existing={fromSeed ? [] : products} onSaved={reload} />
    </div>
  );
}

function ImportModal({ open, onClose, existing, onSaved }: { open: boolean; onClose: () => void; existing: MotoProduct[]; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseProducts(text) : []), [text]);
  const chosen = parsed.filter((x) => !skip.has(x.product.slug));

  const save = async () => {
    setSaving(true);
    try {
      const bySlug = new Map(existing.map((p) => [p.slug, p]));
      const list = chosen.map((x, i) => {
        const m = merge(bySlug.get(x.product.slug), x.product);
        return { ...m, position: m.position || existing.length + i };
      });
      await saveProducts(list);
      toast.success(`${list.length} ${list.length === 1 ? "modelo salvo" : "modelos salvos"} no catálogo`);
      onSaved();
      setText("");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(/moto_products/.test(msg) ? "Rode o supabase/schema.sql atualizado no SQL Editor para ativar o cadastro de modelos." : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Cadastrar modelos por texto"
      subtitle="Cole a ficha do fornecedor ou suas anotações. Vários modelos de uma vez: separe com --- ou comece cada um com “Modelo:”."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setText(EXAMPLE)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
            <ClipboardList className="h-4 w-4" /> Ver exemplo
          </button>
          <Button onClick={save} loading={saving} disabled={!chosen.length}>
            Salvar {chosen.length || ""} {chosen.length === 1 ? "modelo" : "modelos"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Modelo: Sprint 1200\nMotor: 1.000W\nBateria: Lítio 72V 30Ah\nAutonomia: 90 km\nCusto: R$ 4.900\nFrete: 300\nPreço: R$ 7.990\n---\nModelo: …"} className="font-mono text-[13px]" />
      {parsed.length > 0 && (
        <div className="mt-4 grid gap-2">
          <p className="text-xs font-semibold text-ink-500">
            {parsed.length} {parsed.length === 1 ? "modelo encontrado" : "modelos encontrados"}: confira antes de salvar
          </p>
          {parsed.map(({ product: p, found }) => {
            const r = profitOf(p);
            const on = !skip.has(p.slug);
            const exists = existing.some((e) => e.slug === p.slug);
            return (
              <label key={p.slug} className={cx("flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition", on ? "bg-emerald-50/60 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30" : "ring-ink-200 opacity-60")}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setSkip((s) => {
                      const n = new Set(s);
                      if (n.has(p.slug)) n.delete(p.slug);
                      else n.add(p.slug);
                      return n;
                    })
                  }
                  className="mt-1 h-4 w-4 accent-emerald-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.name}
                    {exists && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">atualiza o existente</span>}
                    <span className="text-[11px] font-normal text-ink-500">{found.length} campos lidos</span>
                  </p>
                  <p className="truncate text-xs text-ink-500">{[p.specs.power, p.specs.battery, p.specs.range, p.specs.speed, p.colors.join("/")].filter(Boolean).join(" · ") || "sem ficha técnica"}</p>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums">
                  <p className="font-semibold">{p.price > 0 ? brl0(p.price) : "sem preço"}</p>
                  <p className={cx(unitCost(p.costs) > 0 ? (r.profit > 0 ? "text-emerald-700" : "text-rose-600") : "text-ink-400")}>{unitCost(p.costs) > 0 && p.price > 0 ? `lucro ${brl0(r.profit)} (${r.margin.toLocaleString("pt-BR")}%)` : "sem custos"}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** Estoque que aparece no catálogo online ("Últimas 3 unidades"). Vazio = "Estoque limitado". */
function StockStepper({ p, onSaved }: { p: MotoProduct; onSaved: () => void }) {
  const [v, setV] = useState<number | null>(p.stock);
  const [busy, setBusy] = useState(false);
  const set = async (next: number | null) => {
    const prev = v;
    setV(next);
    setBusy(true);
    const { error } = await supabase().from("moto_products").update({ stock: next }).eq("id", p.id);
    setBusy(false);
    if (error) {
      setV(prev);
      toast.error(/stock/.test(error.message) ? "Rode o supabase/schema.sql atualizado para ativar o estoque." : error.message);
    } else onSaved();
  };
  const btn = "grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.14] disabled:opacity-40";
  return (
    <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">Estoque no catálogo</span>
        <span className={cx("block text-[13px] font-semibold", v === 0 ? "text-[#FF8A80]" : v != null && v <= 3 ? "text-[#FFB547]" : "text-white/80")}>
          {v == null ? "Estoque limitado (sem número)" : v === 0 ? "Esgotado" : `${v} ${v === 1 ? "unidade" : "unidades"}`}
        </span>
      </span>
      <button type="button" aria-label="Diminuir estoque" disabled={busy || v === 0} onClick={() => set(Math.max(0, (v ?? 1) - 1))} className={btn}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-[15px] font-bold tabular-nums">{v ?? "–"}</span>
      <button type="button" aria-label="Aumentar estoque" disabled={busy} onClick={() => set((v ?? 0) + 1)} className={btn}>
        <Plus className="h-3.5 w-3.5" />
      </button>
      {v != null && (
        <button type="button" disabled={busy} onClick={() => set(null)} className="text-[11px] font-semibold text-white/45 hover:text-white/80">
          limpar
        </button>
      )}
    </div>
  );
}
