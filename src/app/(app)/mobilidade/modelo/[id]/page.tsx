"use client";

import { ArrowLeft, BookOpen, Calculator, Download, Eye, EyeOff, ImagePlus, Palette, Save, Sparkles, Tag, Trash2, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { ART_H, ART_W, SaleArt, SpecsArt, downloadMotoArt, type ArtBrand } from "@/components/mobilidade/moto-arts";
import { Button, Card, Field, ImageField, Input, MoneyInput, NumberInput, Skeleton, Switch, Textarea, cx } from "@/components/ui";
import { brlPlain } from "@/lib/br";
import { deleteProduct, saveProduct, useMotoProducts } from "@/lib/moto-products-db";
import { MANUAL_SPEC_FIELDS, installmentTable, installmentValue, newProduct, priceForMargin, profitOf, slugify, unitCost, type MotoCosts, type MotoProduct, type MotoSpecsFull } from "@/lib/moto-products";

const SPEC_FIELDS: { k: keyof MotoSpecsFull; label: string; ph: string }[] = [
  { k: "power", label: "Motor", ph: "1.000W" },
  { k: "battery", label: "Bateria", ph: "Lítio 60V 20Ah" },
  { k: "range", label: "Autonomia", ph: "60 a 80 km" },
  { k: "speed", label: "Velocidade máx.", ph: "32 km/h" },
  { k: "recharge", label: "Recarga", ph: "6 a 7 h" },
  { k: "load", label: "Carga máxima", ph: "180 kg" },
  { k: "brakes", label: "Freios", ph: "Disco + tambor" },
  { k: "weight", label: "Peso", ph: "66 kg" },
  { k: "security", label: "Segurança", ph: "NFC + alarme" },
  { k: "highlight", label: "Destaque", ph: "Banco de couro e encosto" },
];

const COST_FIELDS: { k: keyof MotoCosts; label: string; hint?: string; pct?: boolean }[] = [
  { k: "purchase", label: "Custo de compra", hint: "valor pago ao fornecedor" },
  { k: "freight", label: "Frete até a loja" },
  { k: "assembly", label: "Montagem e preparação" },
  { k: "accessories", label: "Brindes inclusos", hint: "capacete, cadeado…" },
  { k: "other", label: "Outros custos" },
  { k: "taxPct", label: "Impostos", pct: true, hint: "% sobre a venda" },
  { k: "commissionPct", label: "Comissão", pct: true, hint: "% sobre a venda" },
];

const ACCENTS = ["#9FDB7C", "#F3E93B", "#E8D3B0", "#FF7A3D", "#7CC4FF", "#D6D6D6"];

export default function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { products, loading, fromSeed, reload } = useMotoProducts();
  const initial = useMemo(() => {
    if (id === "novo") return newProduct();
    return products.find((p) => p.id === id || p.slug === id) ?? null;
  }, [id, products]);
  if (loading && !initial) return <Skeleton className="h-[70vh]" />;
  if (!initial) return <Card className="p-8 text-center text-sm text-ink-500">Modelo não encontrado.</Card>;
  return <Editor key={initial.id || initial.slug || "novo"} initial={initial} fromSeed={fromSeed && id !== "novo"} onSaved={reload} />;
}

function Editor({ initial, fromSeed, onSaved }: { initial: MotoProduct; fromSeed: boolean; onSaved: () => void }) {
  const router = useRouter();
  const { settings } = useApp();
  const [p, setP] = useState<MotoProduct>(initial);
  const [dirty, setDirty] = useState(!initial.id);
  const [saving, setSaving] = useState(false);
  const [art, setArt] = useState<"venda" | "ficha" | "manual" | null>(null);
  const [target, setTarget] = useState(25);
  const [color, setColor] = useState("");
  const brand: ArtBrand = { whatsapp: settings.whatsapp || settings.phone, instagram: settings.instagram, city: settings.city };

  const set = (patch: Partial<MotoProduct>) => {
    setP((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setSpec = (k: keyof MotoSpecsFull, v: string) => set({ specs: { ...p.specs, [k]: v } });
  const setCost = (k: keyof MotoCosts, v: number) => set({ costs: { ...p.costs, [k]: v } });

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const r = profitOf(p);
  const each = installmentValue(p.price, p.installments, p.rate);
  const table = installmentTable(p.price, p.rate, Math.max(p.installments, 1));
  const hasCosts = unitCost(p.costs) > 0;
  const tone = !hasCosts ? "ink" : r.margin >= 20 ? "good" : r.margin >= 10 ? "warn" : "bad";

  const save = async () => {
    if (!p.name.trim()) return toast.error("Dê um nome ao modelo");
    if (!(p.price > 0)) return toast.error("Informe o preço à vista");
    setSaving(true);
    try {
      const id = await saveProduct({ ...p, slug: p.slug || slugify(p.name) });
      setDirty(false);
      toast.success(fromSeed ? "Modelo salvo no seu catálogo" : "Modelo salvo");
      onSaved();
      if (!p.id) router.replace(`/mobilidade/modelo/${id}`);
      else setP((x) => ({ ...x, id }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(/moto_products/.test(msg) ? "Rode o supabase/schema.sql atualizado no SQL Editor para ativar o cadastro de modelos." : msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!p.id || !confirm(`Excluir o modelo ${p.name}?`)) return;
    try {
      await deleteProduct(p.id);
      toast.success("Modelo excluído");
      router.push("/mobilidade?aba=modelos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const download = async (kind: "venda" | "ficha" | "manual") => {
    if (!p.name.trim() || (kind !== "manual" && !(p.price > 0))) return toast.error("Preencha nome e preço antes de gerar a arte");
    setArt(kind);
    try {
      if (kind === "manual") {
        const { downloadMotoManual } = await import("@/components/mobilidade/moto-manual");
        await downloadMotoManual(p, { ...brand, company: settings.company_name });
        toast.success("Manual do cliente baixado");
        return;
      }
      await downloadMotoArt(kind, p, brand);
      toast.success(kind === "venda" ? "Arte de venda baixada" : "Arte comparativa baixada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a arte");
    } finally {
      setArt(null);
    }
  };

  return (
    <div className="animate-fade-up">
      {/* cabeçalho */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/mobilidade?aba=modelos" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-600 shadow-soft ring-1 ring-ink-200/70 hover:text-ink-900" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">Modelo do catálogo</p>
          <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{p.name || "Novo modelo"}</h1>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="secondary" onClick={() => download("venda")} loading={art === "venda"}>
            <Download className="h-4 w-4" /> Arte de venda
          </Button>
          <Button variant="secondary" onClick={() => download("ficha")} loading={art === "ficha"}>
            <Download className="h-4 w-4" /> Arte comparativa
          </Button>
          <Button variant="secondary" onClick={() => download("manual")} loading={art === "manual"} title="Manual do cliente em PDF">
            <BookOpen className="h-4 w-4" /> Manual
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty && !fromSeed}>
            <Save className="h-4 w-4" /> {dirty || fromSeed ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>
      {fromSeed && (
        <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Este modelo ainda é o do catálogo de lançamento. Complete os custos e salve para ele entrar no seu cadastro.</div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-w-0 content-start gap-4">
          <Block icon={<Tag className="h-4 w-4" />} title="Identidade" subtitle="Como o modelo aparece no catálogo e nas artes">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do modelo">
                <Input value={p.name} onChange={(e) => set({ name: e.target.value, slug: p.id ? p.slug : slugify(e.target.value) })} placeholder="Ex.: Sprint 1200" />
              </Field>
              <Field label="Chamada">
                <Input value={p.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="Ex.: A esportiva urbana" />
              </Field>
              <Field label="Descrição curta" className="col-span-2">
                <Textarea rows={2} value={p.pitch} onChange={(e) => set({ pitch: e.target.value })} placeholder="Uma frase que gera desejo: o que ela tem de melhor" />
              </Field>
              <Field label="Ideal para quem…" className="col-span-2">
                <Input value={p.forWho} onChange={(e) => set({ forWho: e.target.value })} placeholder="trabalha, estuda e quer economizar todo dia" />
              </Field>
              <Field label="Cores disponíveis" className="col-span-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.colors.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-ink-100 py-1 pr-1.5 pl-3 text-xs font-semibold">
                      {c}
                      <button type="button" aria-label={`Remover ${c}`} onClick={() => set({ colors: p.colors.filter((x) => x !== c) })} className="grid h-5 w-5 place-items-center rounded-full hover:bg-ink-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === ",") && color.trim()) {
                        e.preventDefault();
                        set({ colors: [...p.colors, color.trim()] });
                        setColor("");
                      }
                    }}
                    placeholder="Digite e Enter"
                    className="h-8 w-40"
                  />
                </div>
              </Field>
              <Field label={<span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Cor de destaque nas artes</span>} className="col-span-2">
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button key={a} type="button" aria-label={a} onClick={() => set({ accent: a })} className={cx("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-black", p.accent === a ? "ring-ink-900 dark:ring-white" : "ring-transparent")} style={{ background: a }} />
                  ))}
                  <input type="color" value={p.accent} onChange={(e) => set({ accent: e.target.value })} className="h-8 w-10 cursor-pointer rounded-lg bg-transparent" aria-label="Outra cor" />
                </div>
              </Field>
            </div>
          </Block>

          <Block icon={<ImagePlus className="h-4 w-4" />} title="Fotos" subtitle="Use foto sem fundo (PNG ou WEBP) na principal: fica perfeita nas artes">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <p className="mb-1.5 text-[13px] font-medium text-ink-600">Foto principal</p>
                <ImageField value={p.photo} onChange={(url) => set({ photo: url })} folder="motos" label="Foto principal" aspect="aspect-[4/3]" />
              </div>
              {p.gallery
                .filter((g) => g.src !== p.photo)
                .map((g) => (
                  <div key={g.src} className="relative overflow-hidden rounded-xl bg-ink-950 ring-1 ring-ink-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.src} alt="" className="aspect-[4/3] w-full object-contain" />
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      <button type="button" title="Usar como principal" onClick={() => set({ photo: g.src })} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label="Remover foto" onClick={() => set({ gallery: p.gallery.filter((x) => x.src !== g.src) })} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 text-rose-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              <ImageField key={p.gallery.length} value="" onChange={(url) => url && set({ gallery: [...p.gallery, { src: url, caption: "", fit: "contain" }] })} folder="motos" label="Mais um ângulo" aspect="aspect-[4/3]" />
            </div>
          </Block>

          <Block icon={<Wrench className="h-4 w-4" />} title="Ficha técnica">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SPEC_FIELDS.map((f) => (
                <Field key={f.k} label={f.label}>
                  <Input value={p.specs[f.k]} onChange={(e) => setSpec(f.k, e.target.value)} placeholder={f.ph} />
                </Field>
              ))}
            </div>
            <details className="mt-4 rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-200/70" open={MANUAL_SPEC_FIELDS.some((f) => p.specs[f.k])}>
              <summary className="cursor-pointer text-sm font-semibold">Ficha completa do manual do cliente (tensão, dimensões, pneus…)</summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {MANUAL_SPEC_FIELDS.map((f) => (
                  <Field key={f.k} label={f.label}>
                    <Input value={(p.specs[f.k] as string | undefined) ?? ""} onChange={(e) => setSpec(f.k, e.target.value)} placeholder={f.ph} />
                  </Field>
                ))}
              </div>
            </details>
          </Block>

          <Block icon={<Calculator className="h-4 w-4" />} title="Custos e preço" subtitle="O lucro é calculado na hora, ao lado">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COST_FIELDS.map((f) => (
                <Field key={f.k} label={f.label} hint={f.hint}>
                  {f.pct ? <NumberInput value={p.costs[f.k]} suffix="%" onChange={(v) => setCost(f.k, v)} /> : <MoneyInput value={p.costs[f.k]} onChange={(v) => setCost(f.k, v)} />}
                </Field>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-200/70">
              <Field label="Preço à vista">
                <MoneyInput value={p.price} onChange={(v) => set({ price: v })} />
              </Field>
              <Field label="Parcelas no cartão">
                <NumberInput value={p.installments} digits={0} suffix="x" onChange={(v) => set({ installments: Math.min(24, Math.max(1, Math.round(v) || 1)) })} />
              </Field>
              <Field label="Juros ao mês">
                <NumberInput value={p.rate} suffix="%" onChange={(v) => set({ rate: v })} />
              </Field>
            </div>
            {hasCosts && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-500">Sugerir preço para</span>
                <NumberInput value={target} digits={0} suffix="%" onChange={(v) => setTarget(Math.max(0, Math.min(80, Math.round(v))))} className="w-24" />
                <span className="text-ink-500">de margem:</span>
                <Button size="sm" variant="secondary" onClick={() => set({ price: priceForMargin(p.costs, target) })}>
                  Usar {brlPlain(priceForMargin(p.costs, target))}
                </Button>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between rounded-2xl px-1">
              <Switch checked={p.active} onChange={(v) => set({ active: v })} label={p.active ? <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> Aparece no catálogo online</span> : <span className="flex items-center gap-1.5"><EyeOff className="h-4 w-4" /> Oculto do catálogo online</span>} />
              {p.id && (
                <Button variant="ghost" size="sm" className="text-rose-600" onClick={remove}>
                  <Trash2 className="h-4 w-4" /> Excluir modelo
                </Button>
              )}
            </div>
          </Block>
        </div>

        {/* resultado + prévias */}
        <div className="min-w-0">
          <div className="grid gap-4 xl:sticky xl:top-6">
            <div className="relative overflow-hidden rounded-[28px] bg-[#050706] p-5 text-white ring-1 ring-white/[0.07]">
              <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.35),transparent)]" />
              <p className="relative text-[11px] font-bold tracking-[0.2em] text-[#A9DE86] uppercase">Lucro por scooter (à vista)</p>
              <p className={cx("relative mt-1 font-display text-5xl font-semibold tracking-tight tabular-nums", tone === "bad" ? "text-[#FF6B5E]" : tone === "warn" ? "text-[#F3E93B]" : "text-[#9FDB7C]")}>
                {hasCosts ? brlPlain(r.profit) : "—"}
              </p>
              <p className="relative mt-1 text-sm text-white/60">{hasCosts ? `margem de ${r.margin.toLocaleString("pt-BR")}% · markup de ${r.markup.toLocaleString("pt-BR")}%` : "Preencha os custos para ver o lucro"}</p>
              <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                {p.price > 0 && hasCosts && (
                  <div className="flex h-full">
                    <span className="h-full bg-[rgba(255,255,255,0.35)]" style={{ width: `${Math.min(100, (r.cost / p.price) * 100)}%` }} />
                    <span className="h-full bg-[#F3E93B]/70" style={{ width: `${Math.min(100, ((r.taxes + r.commission) / p.price) * 100)}%` }} />
                    <span className="h-full bg-[#9FDB7C]" style={{ width: `${Math.max(0, (r.profit / p.price) * 100)}%` }} />
                  </div>
                )}
              </div>
              <dl className="relative mt-4 grid gap-1.5 text-sm">
                {[
                  ["Preço à vista", brlPlain(p.price), ""],
                  ["Custo da scooter", `− ${brlPlain(r.cost)}`, "bg-[rgba(255,255,255,0.35)]"],
                  [`Impostos (${p.costs.taxPct || 0}%)`, `− ${brlPlain(r.taxes)}`, "bg-[#F3E93B]/70"],
                  [`Comissão (${p.costs.commissionPct || 0}%)`, `− ${brlPlain(r.commission)}`, "bg-[#F3E93B]/70"],
                ].map(([k, v, dot]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="flex items-center gap-2 text-white/60">
                      {dot && <span className={cx("h-2 w-2 rounded-full", dot)} />}
                      {k}
                    </dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Card className="p-4">
              <p className="text-sm font-semibold">No cartão · {p.rate.toLocaleString("pt-BR")}% ao mês</p>
              <p className="text-xs text-ink-500">Tabela Price: o cliente paga os juros; você recebe o valor à vista.</p>
              <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-ink-200">
                {table.map((t) => (
                  <div key={t.n} className={cx("flex items-center justify-between px-3.5 py-2 text-sm tabular-nums", t.n === p.installments ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "odd:bg-ink-50")}>
                    <span>{t.n === 1 ? "À vista no cartão" : `${t.n}x de ${brlPlain(t.each)}`}</span>
                    <span className="text-ink-500">{brlPlain(t.total)}</span>
                  </div>
                ))}
              </div>
              {p.price > 0 && <p className="mt-2 text-xs text-ink-500">Nas artes: {p.installments}x de {brlPlain(each)}</p>}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {(["venda", "ficha"] as const).map((k) => (
                <button key={k} type="button" onClick={() => download(k)} className="group overflow-hidden rounded-2xl bg-black text-left ring-1 ring-ink-200 transition hover:ring-emerald-400">
                  <ArtPreview>{k === "venda" ? <SaleArt p={p} brand={brand} /> : <SpecsArt p={p} brand={brand} />}</ArtPreview>
                  <p className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-white">
                    {k === "venda" ? "Arte de venda" : "Arte comparativa"} <Download className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Miniatura viva da arte (1080 × 1350 reduzida). */
function ArtPreview({ children }: { children: ReactNode }) {
  const scale = 0.18;
  return (
    <div className="relative mx-auto overflow-hidden" style={{ width: ART_W * scale, height: ART_H * scale }}>
      <div className="pointer-events-none absolute top-0 left-0 origin-top-left [&_[data-art]]:!static" style={{ transform: `scale(${scale})`, width: ART_W, height: ART_H }} aria-hidden>
        {children}
      </div>
    </div>
  );
}

function Block({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-yellow">{icon}</span>
        <div>
          <h2 className="font-display text-[15px] font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
