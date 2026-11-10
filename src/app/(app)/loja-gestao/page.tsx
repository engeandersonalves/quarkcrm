"use client";

import { ArrowDown, ArrowUp, Copy, ExternalLink, Megaphone, Package, Pencil, Percent, Plus, Search, Ticket, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Badge, Button, Card, Empty, Field, ImageField, Input, Modal, NumberInput, PageHeader, Segmented, Select, Skeleton, Switch, Textarea, cx } from "@/components/ui";
import { ProductImage } from "@/components/store/kit";
import { CATEGORIES, PLACES, THEMES, campaignLive, defaultProducts, normalizeCode, toProduct, type Campaign, type CampaignTheme, type Category, type Coupon, type StoreProduct } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";

type Tab = "produtos" | "cupons" | "campanhas";
const SCHEMA_MSG = "Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar a loja.";

export default function LojaGestaoPage() {
  const { user, profile } = useApp();
  const admin = profile?.role === "admin";
  const [tab, setTab] = useState<Tab>("produtos");
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/loja?v=${user.id}`;

  return (
    <>
      <PageHeader
        eyebrow="Ferramentas"
        title="Loja online"
        subtitle="Produtos, fotos, descontos, cupons e campanhas da sua vitrine"
        icon={<Package />}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(link).then(() => toast.success("Link da loja copiado (com o seu nome de vendedor)"));
              }}
            >
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <a href={link} target="_blank" rel="noreferrer">
              <Button>
                <ExternalLink className="h-4 w-4" /> Abrir loja
              </Button>
            </a>
          </>
        }
      />
      {!admin && <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Só administradores podem alterar a loja. Você pode copiar o link e enviar aos clientes.</p>}
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "produtos", label: "Produtos" },
          { value: "cupons", label: "Cupons" },
          { value: "campanhas", label: "Campanhas" },
        ]}
      />
      {tab === "produtos" && <Products admin={admin} />}
      {tab === "cupons" && <Coupons admin={admin} />}
      {tab === "campanhas" && <Campaigns admin={admin} />}
    </>
  );
}

/* ================================================================ produtos */

const EMPTY: Omit<StoreProduct, "id"> = { category: "kit", place: "casa", name: "", subtitle: null, description: null, images: [], specs: [], highlights: [], badge: null, discount_pct: 0, rating: 5, sold: 0, featured: false, flash: false, active: true, position: 0 };
const toRow = (p: Omit<StoreProduct, "id">) => ({ ...p, place: p.category === "kit" ? p.place : null, updated_at: new Date().toISOString() });

function Products({ admin }: { admin: boolean }) {
  const [list, setList] = useState<StoreProduct[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "">("");
  const [edit, setEdit] = useState<(Omit<StoreProduct, "id"> & { id?: string }) | null>(null);
  const [bulk, setBulk] = useState<{ cat: Category | ""; pct: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("store_products").select("*").order("position").order("created_at");
    if (error) {
      setErr(/store_products|relation|schema/i.test(error.message) ? SCHEMA_MSG : error.message);
      setList([]);
      return;
    }
    setErr("");
    setList(((data ?? []) as Record<string, unknown>[]).map(toProduct).filter((x): x is StoreProduct => !!x));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => (list ?? []).filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [list, cat, q]);

  const importDefaults = async () => {
    setBusy(true);
    const rows = defaultProducts().map((p) => {
      const { id, ...rest } = p;
      void id;
      return toRow(rest);
    });
    const { error } = await supabase().from("store_products").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} produtos importados. Agora é só colocar fotos e descontos!`);
    load();
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error("Dê um nome ao produto");
    setBusy(true);
    const { id, ...rest } = edit;
    const row = toRow({ ...rest, name: rest.name.trim() });
    const { error } = id ? await supabase().from("store_products").update(row).eq("id", id) : await supabase().from("store_products").insert({ ...row, position: (list?.length ?? 0) + 1 });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Produto salvo");
    setEdit(null);
    load();
  };

  const patch = async (p: StoreProduct, change: Partial<StoreProduct>) => {
    setList((l) => l?.map((x) => (x.id === p.id ? { ...x, ...change } : x)) ?? null);
    const { error } = await supabase().from("store_products").update(change).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto da loja?")) return;
    const { error } = await supabase().from("store_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEdit(null);
    load();
  };

  const move = async (p: StoreProduct, dir: -1 | 1) => {
    const arr = [...(list ?? [])];
    const i = arr.findIndex((x) => x.id === p.id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setList(arr);
    await Promise.all(arr.map((x, k) => (x.position !== k ? supabase().from("store_products").update({ position: k }).eq("id", x.id) : null)));
    load();
  };

  const applyBulk = async () => {
    if (!bulk) return;
    setBusy(true);
    let qy = supabase().from("store_products").update({ discount_pct: Math.max(0, Math.min(90, Math.round(bulk.pct))) });
    qy = bulk.cat ? qy.eq("category", bulk.cat) : qy.not("id", "is", null);
    const { error } = await qy;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Desconto aplicado");
    setBulk(null);
    load();
  };

  if (list === null) return <Skeleton className="h-64" />;
  if (err) return <Card className="p-6 text-sm text-ink-600">{err}</Card>;

  return (
    <>
      {list.length === 0 ? (
        <Card>
          <Empty
            icon={<Package className="h-6 w-6" />}
            title="Sua loja ainda está com o catálogo padrão"
            text="Importe os 34 produtos prontos (kits, eletropostos, motos, material e serviços) e depois troque fotos, nomes e descontos. Ou cadastre do zero."
            action={
              admin && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={importDefaults} loading={busy}>
                    <Wand2 className="h-4 w-4" /> Importar catálogo padrão
                  </Button>
                  <Button variant="secondary" onClick={() => setEdit({ ...EMPTY })}>
                    <Plus className="h-4 w-4" /> Produto novo
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="pl-10" />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value as Category | "")} className="w-auto min-w-[170px]">
              <option value="">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            {admin && (
              <>
                <Button variant="secondary" onClick={() => setBulk({ cat: "", pct: 10 })}>
                  <Percent className="h-4 w-4" /> Desconto em massa
                </Button>
                <Button onClick={() => setEdit({ ...EMPTY })}>
                  <Plus className="h-4 w-4" /> Produto
                </Button>
              </>
            )}
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-ink-100">
              {shown.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-black">
                    <ProductImage p={p} />
                  </div>
                  <button className="min-w-0 flex-1 text-left" onClick={() => admin && setEdit(p)}>
                    <p className={cx("truncate text-[15px] font-semibold", p.active ? "text-ink-900" : "text-ink-400 line-through")}>{p.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                      <span>{CATEGORIES.find((c) => c.id === p.category)?.short}</span>
                      {p.images.length > 0 ? <span>· {p.images.length} foto(s)</span> : <span className="text-amber-700">· sem foto</span>}
                      {p.discount_pct > 0 && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">-{p.discount_pct}%</Badge>}
                      {p.featured && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Destaque</Badge>}
                      {p.flash && <Badge className="bg-violet-50 text-violet-800 ring-violet-200">Relâmpago</Badge>}
                    </div>
                  </button>
                  {admin && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => move(p, -1)} className="hidden h-8 w-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 sm:grid" aria-label="Subir">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button onClick={() => move(p, 1)} className="hidden h-8 w-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 sm:grid" aria-label="Descer">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <Switch checked={p.active} onChange={(v) => patch(p, { active: v })} />
                      <button onClick={() => setEdit(p)} className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <ProductEditor value={edit} onChange={setEdit} onSave={save} onDelete={remove} busy={busy} />

      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        title="Desconto em massa"
        subtitle="Ótimo para Black Friday: aplica o mesmo % OFF em vários produtos de uma vez."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(null)}>
              Cancelar
            </Button>
            <Button onClick={applyBulk} loading={busy}>
              Aplicar
            </Button>
          </>
        }
      >
        {bulk && (
          <div className="grid gap-4">
            <Field label="Em quais produtos">
              <Select value={bulk.cat} onChange={(e) => setBulk({ ...bulk, cat: e.target.value as Category | "" })}>
                <option value="">Todos os produtos</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Desconto" hint="Use 0 para tirar o desconto.">
              <NumberInput value={bulk.pct} onChange={(v) => setBulk({ ...bulk, pct: v })} suffix="% OFF" digits={0} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

const BADGES = ["Mais vendido", "Lançamento", "Instalação inclusa", "Melhor custo-benefício", "Últimas unidades", "Exclusivo"];

function ProductEditor({ value: v, onChange, onSave, onDelete, busy }: { value: (Omit<StoreProduct, "id"> & { id?: string }) | null; onChange: (v: (Omit<StoreProduct, "id"> & { id?: string }) | null) => void; onSave: () => void; onDelete: (id: string) => void; busy: boolean }) {
  const [specText, setSpecText] = useState("");
  const [hlText, setHlText] = useState("");
  const [newImg, setNewImg] = useState("");
  useEffect(() => {
    if (!v) return;
    setSpecText(v.specs.map((s) => `${s.label}: ${s.value}`).join("\n"));
    setHlText(v.highlights.join("\n"));
    // só ao abrir outro produto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.id, v === null]);
  if (!v) return null;
  const set = (patch: Partial<StoreProduct>) => onChange({ ...v, ...patch });
  const parseSpecs = (t: string) =>
    t
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes(":"))
      .map((l) => ({ label: l.slice(0, l.indexOf(":")).trim(), value: l.slice(l.indexOf(":") + 1).trim() }))
      .filter((s) => s.label && s.value);
  const moveImg = (i: number, d: -1 | 1) => {
    const a = [...v.images];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ images: a });
  };

  return (
    <Modal
      open
      onClose={() => onChange(null)}
      size="lg"
      title={v.id ? "Editar produto" : "Novo produto"}
      footer={
        <>
          {v.id && (
            <Button variant="ghost" className="mr-auto text-rose-600" onClick={() => onDelete(v.id!)}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => onChange(null)}>
            Cancelar
          </Button>
          <Button onClick={onSave} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={v.category} onChange={(e) => set({ category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {v.category === "kit" && (
            <Field label="Para">
              <Select value={v.place ?? "casa"} onChange={(e) => set({ place: e.target.value as StoreProduct["place"] })}>
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.short}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Nome do produto">
          <Input value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Kit Casa Conforto 5,49 kWp" />
        </Field>
        <Field label="Frase curta" hint="Aparece embaixo do nome nos cartões.">
          <Input value={v.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value || null })} placeholder="Ex.: Ideal para família com ar-condicionado" />
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-600">Fotos (a primeira é a capa)</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {v.images.map((src, i) => (
              <div key={src + i} className="group relative aspect-square overflow-hidden rounded-xl bg-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 rounded-md bg-black/70 px-1.5 text-[10px] font-bold text-white">CAPA</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button onClick={() => moveImg(i, -1)} className="grid h-6 w-6 place-items-center rounded text-white" aria-label="Para a esquerda">
                    ‹
                  </button>
                  <button onClick={() => set({ images: v.images.filter((_, k) => k !== i) })} className="grid h-6 w-6 place-items-center rounded text-rose-300" aria-label="Remover foto">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => moveImg(i, 1)} className="grid h-6 w-6 place-items-center rounded text-white" aria-label="Para a direita">
                    ›
                  </button>
                </div>
              </div>
            ))}
            {v.images.length < 10 && <ImageField key={v.images.length} value="" onChange={(url) => url && set({ images: [...v.images, url] })} folder="loja" label="Foto" aspect="aspect-square" />}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={newImg} onChange={(e) => setNewImg(e.target.value)} placeholder="Ou cole o link de uma imagem (https://…)" className="h-9 text-xs sm:h-9" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (/^https?:\/\//.test(newImg.trim())) {
                  set({ images: [...v.images, newImg.trim()] });
                  setNewImg("");
                }
              }}
            >
              Adicionar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Desconto (% OFF)">
            <NumberInput value={v.discount_pct} onChange={(n) => set({ discount_pct: Math.max(0, Math.min(90, Math.round(n))) })} suffix="%" digits={0} />
          </Field>
          <Field label="Pedidos (prova social)" hint="Deixe 0 para não mostrar.">
            <NumberInput value={v.sold} onChange={(n) => set({ sold: Math.max(0, Math.round(n)) })} digits={0} />
          </Field>
          <Field label="Avaliação (0 a 5)">
            <NumberInput value={v.rating} onChange={(n) => set({ rating: Math.max(0, Math.min(5, n)) })} digits={1} />
          </Field>
        </div>

        <Field label="Selo">
          <Input value={v.badge ?? ""} onChange={(e) => set({ badge: e.target.value || null })} placeholder="Ex.: Mais vendido" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {BADGES.map((b) => (
              <button key={b} type="button" onClick={() => set({ badge: v.badge === b ? null : b })} className={cx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", v.badge === b ? "bg-ink-900 text-white ring-ink-900" : "text-ink-600 ring-ink-200")}>
                {b}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Switch checked={v.featured} onChange={(x) => set({ featured: x })} label="Destaque (Mais escolhidos e banner)" />
          <Switch checked={v.flash} onChange={(x) => set({ flash: x })} label="Oferta relâmpago" />
          <Switch checked={v.active} onChange={(x) => set({ active: x })} label="Visível na loja" />
        </div>

        <Field label="Ficha técnica" hint="Uma linha por item, no formato Nome: valor">
          <Textarea
            value={specText}
            onChange={(e) => {
              setSpecText(e.target.value);
              set({ specs: parseSpecs(e.target.value) });
            }}
            placeholder={"Potência: 5,49 kWp\nPlacas: 9 × 610 W\nInversor: 5 kW"}
            className="min-h-[110px] font-mono text-xs"
          />
        </Field>
        <Field label={v.category === "kit" ? "O que está incluso" : "Destaques"} hint="Uma linha por item. Use “Título: explicação” se quiser.">
          <Textarea
            value={hlText}
            onChange={(e) => {
              setHlText(e.target.value);
              set({ highlights: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) });
            }}
            className="min-h-[110px]"
          />
        </Field>
        <Field label="Descrição completa">
          <Textarea value={v.description ?? ""} onChange={(e) => set({ description: e.target.value || null })} className="min-h-[120px]" placeholder="Conte os benefícios, para quem é, diferenciais…" />
        </Field>
      </div>
    </Modal>
  );
}

/* ================================================================== cupons */

function Coupons({ admin }: { admin: boolean }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ code: "", pct: 10, description: "", public: true, expires: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase().from("store_coupons").select("*").order("created_at", { ascending: false });
    if (error) {
      setErr(SCHEMA_MSG);
      setList([]);
      return;
    }
    setList((data ?? []) as Coupon[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const code = normalizeCode(form.code);
    if (code.length < 3) return toast.error("Código com pelo menos 3 letras ou números");
    setBusy(true);
    const { error } = await supabase()
      .from("store_coupons")
      .insert({ code, discount_pct: Math.max(1, Math.min(90, Math.round(form.pct))), description: form.description.trim() || null, public: form.public, expires_at: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null });
    setBusy(false);
    if (error) return toast.error(/duplicate|unique/i.test(error.message) ? "Já existe um cupom com esse código" : error.message);
    toast.success(`Cupom ${code} criado`);
    setForm({ code: "", pct: 10, description: "", public: true, expires: "" });
    load();
  };
  const patch = async (c: Coupon, change: Partial<Coupon>) => {
    await supabase().from("store_coupons").update(change).eq("code", c.code);
    load();
  };
  const remove = async (c: Coupon) => {
    if (!confirm(`Excluir o cupom ${c.code}?`)) return;
    await supabase().from("store_coupons").delete().eq("code", c.code);
    load();
  };

  if (list === null) return <Skeleton className="h-64" />;
  if (err) return <Card className="p-6 text-sm text-ink-600">{err}</Card>;
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      {admin && (
        <Card className="self-start p-5">
          <p className="mb-4 flex items-center gap-2 font-display font-semibold">
            <Ticket className="h-4 w-4" /> Novo cupom
          </p>
          <div className="grid gap-3.5">
            <Field label="Código">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: normalizeCode(e.target.value) })} placeholder="BLACK10" className="font-mono uppercase" />
            </Field>
            <Field label="Desconto">
              <NumberInput value={form.pct} onChange={(n) => setForm({ ...form, pct: n })} suffix="% OFF" digits={0} />
            </Field>
            <Field label="Descrição (opcional)">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Em kits solares" />
            </Field>
            <Field label="Validade (opcional)">
              <Input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
            </Field>
            <Switch checked={form.public} onChange={(x) => setForm({ ...form, public: x })} label={form.public ? "Aparece na loja para todos" : "Secreto: só quem tem o código"} />
            <Button onClick={create} loading={busy}>
              <Plus className="h-4 w-4" /> Criar cupom
            </Button>
          </div>
        </Card>
      )}
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty icon={<Ticket className="h-6 w-6" />} title="Nenhum cupom ainda" text="Crie cupons como BLACK10 ou VIP15. Os públicos aparecem na loja; os secretos você manda só para quem quiser." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
              return (
                <li key={c.code} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-[#FF453A] to-[#FF9F0A] text-[15px] font-black text-white">{c.discount_pct}%</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[15px] font-bold text-ink-900">{c.code}</p>
                    <p className="truncate text-xs text-ink-500">
                      {c.public ? "Público" : "Secreto"} · {c.uses ?? 0} uso(s)
                      {c.expires_at ? ` · ${expired ? "expirou" : "até"} ${new Date(c.expires_at).toLocaleDateString("pt-BR")}` : ""}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  {admin && (
                    <>
                      <Switch checked={!!c.active} onChange={(x) => patch(c, { active: x })} />
                      <button onClick={() => remove(c)} className="grid h-9 w-9 place-items-center rounded-full text-rose-500 hover:bg-rose-50" aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* =============================================================== campanhas */

const toLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const PRESETS: { theme: CampaignTheme; name: string; title: string; subtitle: string; extra: number; days: number }[] = [
  { theme: "blackfriday", name: "Black Friday", title: "BLACK FRIDAY SOLAR", subtitle: "Os maiores descontos do ano em energia solar", extra: 10, days: 7 },
  { theme: "natal", name: "Natal", title: "Natal com conta de luz menor", subtitle: "Presenteie sua família com economia", extra: 5, days: 10 },
  { theme: "maes", name: "Dia das Mães", title: "Para quem cuida de tudo", subtitle: "Energia solar e mais conforto em casa", extra: 5, days: 7 },
  { theme: "pais", name: "Dia dos Pais", title: "Moto elétrica para o pai", subtitle: "Ofertas em motos e carregadores", extra: 5, days: 7 },
  { theme: "aniversario", name: "Aniversário", title: "Aniversário Quark", subtitle: "Quem ganha presente é você", extra: 8, days: 5 },
  { theme: "verao", name: "Verão", title: "Verão sem medo do ar-condicionado", subtitle: "Gere sua própria energia", extra: 5, days: 14 },
];

function Campaigns({ admin }: { admin: boolean }) {
  const [list, setList] = useState<Campaign[] | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<(Omit<Campaign, "id"> & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase().from("store_campaigns").select("*").order("starts_at", { ascending: false });
    if (error) {
      setErr(SCHEMA_MSG);
      setList([]);
      return;
    }
    setList((data ?? []) as Campaign[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const fromPreset = (p: (typeof PRESETS)[number]) => setEdit({ name: p.name, theme: p.theme, title: p.title, subtitle: p.subtitle, extra_pct: p.extra, banner: null, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + p.days * 86400000).toISOString(), active: true });
  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast.error("Dê um título à campanha");
    if (new Date(edit.ends_at) <= new Date(edit.starts_at)) return toast.error("O fim precisa ser depois do início");
    setBusy(true);
    const { id, ...row } = edit;
    const { error } = id ? await supabase().from("store_campaigns").update(row).eq("id", id) : await supabase().from("store_campaigns").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Campanha salva");
    setEdit(null);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir esta campanha?")) return;
    await supabase().from("store_campaigns").delete().eq("id", id);
    setEdit(null);
    load();
  };

  if (list === null) return <Skeleton className="h-64" />;
  if (err) return <Card className="p-6 text-sm text-ink-600">{err}</Card>;
  return (
    <>
      {admin && (
        <Card className="mb-5 p-5">
          <p className="mb-3 flex items-center gap-2 font-display font-semibold">
            <Megaphone className="h-4 w-4" /> Começar uma campanha
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {PRESETS.map((p) => {
              const t = THEMES[p.theme];
              return (
                <button key={p.theme} onClick={() => fromPreset(p)} className="overflow-hidden rounded-2xl text-left ring-1 ring-ink-900/10 transition hover:scale-[1.02]" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
                  <div className="p-3">
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wider text-black" style={{ background: t.ink }}>
                      {t.tag}
                    </span>
                    <p className="mt-2 text-sm font-bold text-white">{p.name}</p>
                    <p className="text-[11px] text-white/70">+{p.extra}% · {p.days} dias</p>
                  </div>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => fromPreset({ theme: "custom", name: "Oferta especial", title: "Oferta especial", subtitle: "", extra: 5, days: 7 })}>
            <Plus className="h-4 w-4" /> Campanha personalizada
          </Button>
        </Card>
      )}
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty icon={<Megaphone className="h-6 w-6" />} title="Nenhuma campanha" text="A campanha coloca uma faixa com contagem regressiva no topo da loja, um banner e soma um desconto extra em todos os produtos." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((c) => {
              const t = THEMES[c.theme] ?? THEMES.custom;
              const live = campaignLive(c);
              const ended = new Date(c.ends_at).getTime() < Date.now();
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[10px] font-black" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, color: t.ink }}>
                    {c.extra_pct ? `+${c.extra_pct}%` : "★"}
                  </span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => admin && setEdit(c)}>
                    <p className="truncate font-semibold text-ink-900">{c.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {new Date(c.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} → {new Date(c.ends_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </button>
                  {live ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">No ar</Badge> : ended ? <Badge className="bg-ink-100 text-ink-500 ring-ink-200">Encerrada</Badge> : <Badge className="bg-sky-50 text-sky-700 ring-sky-200">{c.active ? "Agendada" : "Pausada"}</Badge>}
                  {admin && (
                    <button onClick={() => setEdit(c)} className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {edit && (
        <Modal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? "Editar campanha" : "Nova campanha"}
          subtitle="Só uma campanha aparece por vez: a que termina primeiro."
          footer={
            <>
              {edit.id && (
                <Button variant="ghost" className="mr-auto text-rose-600" onClick={() => remove(edit.id!)}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              )}
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button onClick={save} loading={busy}>
                Salvar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome interno">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="Visual">
                <Select value={edit.theme} onChange={(e) => setEdit({ ...edit, theme: e.target.value as CampaignTheme })}>
                  {(Object.keys(THEMES) as CampaignTheme[]).map((k) => (
                    <option key={k} value={k}>
                      {THEMES[k].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Título do banner">
              <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="Frase de apoio">
              <Input value={edit.subtitle ?? ""} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value || null })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Desconto extra em tudo" hint="Soma ao desconto de cada produto.">
                <NumberInput value={edit.extra_pct} onChange={(n) => setEdit({ ...edit, extra_pct: Math.max(0, Math.min(50, Math.round(n))) })} suffix="%" digits={0} />
              </Field>
              <Field label="Começa">
                <Input type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => e.target.value && setEdit({ ...edit, starts_at: new Date(e.target.value).toISOString() })} />
              </Field>
              <Field label="Termina">
                <Input type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => e.target.value && setEdit({ ...edit, ends_at: new Date(e.target.value).toISOString() })} />
              </Field>
            </div>
            <Field label="Imagem do banner (opcional)" hint="Foto larga, de preferência 1600 × 600.">
              <ImageField value={edit.banner ?? ""} onChange={(url) => setEdit({ ...edit, banner: url || null })} folder="loja" aspect="aspect-[8/3]" />
            </Field>
            <Switch checked={edit.active} onChange={(x) => setEdit({ ...edit, active: x })} label="Campanha ativa" />
          </div>
        </Modal>
      )}
    </>
  );
}
