"use client";

import { ClipboardPaste, Copy, Download, ImagePlus, Link2, Loader2, Megaphone, Play, Search, Share2, Trash2, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Skeleton, Textarea, cx } from "@/components/ui";
import { useLive } from "@/lib/live";
import { EXPORT_SIZES, FORMAT_LABEL, HASHTAGS, fitContain, fitCover, formatOf, isClaudeLink, type AssetFormat } from "@/lib/marketing";
import { supabase } from "@/lib/supabase/client";

interface Asset {
  id: string;
  title: string;
  url: string;
  path: string | null;
  kind: "image" | "video";
  width: number | null;
  height: number | null;
  caption: string | null;
  campaign: string | null;
  created_at: string;
}

type Filter = "todos" | AssetFormat;
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "arte";

/* ---------------------------------------------------------------- arquivos */

async function dimsOf(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (file.type.startsWith("image/")) {
      const bmp = await createImageBitmap(file);
      return { width: bmp.width, height: bmp.height };
    }
    if (file.type.startsWith("video/")) {
      return await new Promise((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight });
        v.onerror = () => resolve(null);
        v.src = URL.createObjectURL(file);
      });
    }
  } catch {
    /* sem dimensões */
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem"));
    img.src = src;
  });
}

async function fetchBlob(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download");
  return res.blob();
}

/** Arte encaixada no tamanho do Instagram, com fundo desfocado da própria imagem. */
async function adapt(asset: Asset, w: number, h: number): Promise<Blob> {
  const img = await loadImage(asset.url);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#07060F";
  ctx.fillRect(0, 0, w, h);
  const cover = fitCover(img.naturalWidth, img.naturalHeight, w, h);
  ctx.filter = "blur(48px) brightness(0.55) saturate(1.2)";
  ctx.drawImage(img, cover.x - 60, cover.y - 60, cover.w + 120, cover.h + 120);
  ctx.filter = "none";
  const fit = fitContain(img.naturalWidth, img.naturalHeight, w, h);
  ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
  return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const extOf = (asset: Asset, blob: Blob) => (blob.type.split("/")[1] || (asset.kind === "video" ? "mp4" : "png")).replace("jpeg", "jpg").replace("quicktime", "mov");

/* -------------------------------------------------------------------- tela */

export default function MarketingPage() {
  const { user } = useApp();
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [open, setOpen] = useState<Asset | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading, reload } = useLive(
    async () => {
      const { data, error } = await supabase().from("marketing_assets").select("*").order("created_at", { ascending: false }).limit(500);
      return { rows: (data ?? []) as Asset[], missing: !!error };
    },
    [],
    ["marketing_assets"],
  );
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const upload = useCallback(
    async (files: File[]) => {
      const list = files.filter((f) => f.type.startsWith("image/") || f.type === "video/mp4" || f.type === "video/quicktime");
      if (!list.length) return toast.error("Envie imagens (PNG, JPG, WEBP) ou vídeos MP4.");
      setUploading({ done: 0, total: list.length });
      const sb = supabase();
      let ok = 0;
      for (const [i, file] of list.entries()) {
        const video = file.type.startsWith("video/");
        if (file.size > (video ? 45 : 15) * 1024 * 1024) {
          toast.error(`${file.name}: grande demais (imagem até 15 MB, vídeo até 45 MB)`);
          continue;
        }
        const ext = (file.name.split(".").pop() || (video ? "mp4" : "png")).toLowerCase().slice(0, 5);
        const path = `marketing/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        // Original, sem compressão: a arte sai com a mesma qualidade para o Instagram.
        const up = await sb.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        if (up.error) {
          toast.error(/bucket/i.test(up.error.message) ? "Armazenamento não configurado: rode o supabase/schema.sql." : up.error.message);
          continue;
        }
        const url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
        const dims = await dimsOf(file);
        const title = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 80) || "Arte";
        const { error } = await sb.from("marketing_assets").insert({ title, url, path, kind: video ? "video" : "image", width: dims?.width ?? null, height: dims?.height ?? null, created_by: user.id });
        if (error) toast.error(error.message);
        else ok++;
        setUploading({ done: i + 1, total: list.length });
      }
      setUploading(null);
      if (ok) toast.success(`${ok} ${ok === 1 ? "arte adicionada" : "artes adicionadas"}`);
      reload();
    },
    [user.id, reload],
  );

  // Colar (Ctrl+V) uma imagem copiada do Claude, Canva ou de qualquer lugar.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        upload(files);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && /^https:\/\//.test(text)) {
        e.preventDefault();
        setImportOpen(true);
        sessionStorage.setItem("mk-import", text);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  const visible = rows.filter((a) => (filter === "todos" || formatOf(a.width, a.height) === filter) && (!query.trim() || `${a.title} ${a.campaign ?? ""} ${a.caption ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())));
  const counts = rows.reduce<Record<string, number>>((acc, a) => {
    const f = formatOf(a.width, a.height);
    acc[f] = (acc[f] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className="animate-fade-up"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload([...e.dataTransfer.files]);
      }}
    >
      <PageHeader
        title="Marketing"
        subtitle="Suas artes num só lugar: baixe no tamanho certo e poste no Instagram ou no status em segundos"
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">Importar link</span>
            </Button>
            <Button onClick={() => fileRef.current?.click()} loading={!!uploading}>
              <ImagePlus className="h-4 w-4" /> Enviar artes
            </Button>
          </>
        }
      />
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple className="hidden" onChange={(e) => e.target.files && upload([...e.target.files])} />

      {data?.missing && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Para usar o Marketing, rode novamente o arquivo <b>supabase/schema.sql</b> no SQL Editor do Supabase (cria a tabela das artes).
        </Card>
      )}

      {/* Área de envio */}
      <button
        onClick={() => fileRef.current?.click()}
        className={cx(
          "group relative mb-5 flex w-full flex-col items-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-8 text-center transition",
          drag ? "border-sun-500 bg-sun-50" : "border-ink-200 bg-white hover:border-ink-300",
        )}
      >
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-sun-300/20 blur-3xl" />
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-sun-600" />
            <p className="text-sm font-semibold">
              Enviando {uploading.done}/{uploading.total}…
            </p>
          </>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-brand-yellow shadow-lift">
              <UploadCloud className="h-6 w-6" />
            </span>
            <p className="text-[15px] font-semibold text-ink-900">Arraste as artes aqui, toque para escolher ou cole com Ctrl+V</p>
            <p className="max-w-lg text-xs text-ink-500">
              Criou no Claude? Baixe a imagem (PNG) ou copie e cole aqui. Também aceita o link direto de uma imagem. PNG, JPG, WEBP e vídeos MP4 — na qualidade original.
            </p>
          </>
        )}
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: `Todas ${rows.length ? `(${rows.length})` : ""}` },
            { value: "story", label: `Stories ${counts.story ? `(${counts.story})` : ""}` },
            { value: "feed", label: `Feed ${counts.feed ? `(${counts.feed})` : ""}` },
            { value: "square", label: `1:1 ${counts.square ? `(${counts.square})` : ""}` },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar arte ou campanha" className="pl-9" />
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16]" />
          ))}
        </div>
      ) : !visible.length ? (
        <Card>
          <Empty
            icon={<Megaphone className="h-6 w-6" />}
            title={rows.length ? "Nada neste filtro" : "Sua biblioteca de artes está vazia"}
            text={rows.length ? "Troque o filtro ou a busca." : "Envie as artes que você cria no Claude Design, Canva ou com o designer. A equipe toda baixa e posta daqui."}
            action={!rows.length ? <Button onClick={() => fileRef.current?.click()}>Enviar a primeira arte</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((a) => (
            <AssetTile key={a.id} asset={a} onOpen={() => setOpen(a)} />
          ))}
        </div>
      )}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} />
      {open && <Viewer asset={rows.find((r) => r.id === open.id) ?? open} onClose={() => setOpen(null)} onDeleted={() => setOpen(null)} />}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-400">
        <ClipboardPaste className="h-3.5 w-3.5" /> Dica: copie a imagem no Claude (botão direito → copiar imagem) e aperte Ctrl+V nesta tela.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ cartão */

function AssetTile({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const [busy, setBusy] = useState(false);
  const f = formatOf(asset.width, asset.height);
  const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : "9 / 16";
  const quick = async (e: React.MouseEvent, action: "download" | "share") => {
    e.stopPropagation();
    setBusy(true);
    try {
      await (action === "download" ? downloadOriginal(asset) : shareAsset(asset));
    } catch {
      toast.error("Não foi possível concluir");
    }
    setBusy(false);
  };
  return (
    <div onClick={onOpen} className="group relative cursor-pointer overflow-hidden rounded-2xl bg-ink-950 shadow-soft ring-1 ring-ink-200/70 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative" style={{ aspectRatio: ratio, maxHeight: 460 }}>
        {asset.kind === "video" ? (
          <>
            <video src={asset.url} muted playsInline preload="metadata" className="h-full w-full object-contain" />
            <span className="absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
              <Play className="h-3.5 w-3.5" />
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.title} loading="lazy" className="h-full w-full object-contain" />
        )}
        <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">{FORMAT_LABEL[f]}</span>
      </div>
      <div className="flex items-center gap-1 bg-white px-2.5 py-2">
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-900">{asset.title || "Arte"}</p>
        <button onClick={(e) => quick(e, "share")} disabled={busy} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Compartilhar">
          <Share2 className="h-4 w-4" />
        </button>
        <button onClick={(e) => quick(e, "download")} disabled={busy} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Baixar">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

async function downloadOriginal(asset: Asset) {
  const blob = await fetchBlob(asset.url);
  saveBlob(blob, `${slug(asset.title)}.${extOf(asset, blob)}`);
}

/** Celular: abre o compartilhar (Instagram, WhatsApp/status). Computador: baixa e copia a legenda. */
async function shareAsset(asset: Asset, blobIn?: Blob) {
  const blob = blobIn ?? (await fetchBlob(asset.url));
  const file = new File([blob], `${slug(asset.title)}.${extOf(asset, blob)}`, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: asset.caption ?? undefined }).catch(() => {});
    return;
  }
  saveBlob(blob, file.name);
  if (asset.caption) await navigator.clipboard.writeText(asset.caption).catch(() => {});
  toast.success(asset.caption ? "Arte baixada e legenda copiada" : "Arte baixada");
}

/* ------------------------------------------------------------------ visualizar */

function Viewer({ asset, onClose, onDeleted }: { asset: Asset; onClose: () => void; onDeleted: () => void }) {
  const [title, setTitle] = useState(asset.title);
  const [campaign, setCampaign] = useState(asset.campaign ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const f = formatOf(asset.width, asset.height);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const save = async (patch: Partial<Asset>) => {
    const { error } = await supabase().from("marketing_assets").update(patch).eq("id", asset.id);
    if (error) toast.error(error.message);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      toast.error("Não foi possível gerar o arquivo");
    }
    setBusy(null);
  };

  const exportSize = (k: keyof typeof EXPORT_SIZES, share = false) =>
    run(`${k}${share ? "-s" : ""}`, async () => {
      const s = EXPORT_SIZES[k];
      const blob = await adapt(asset, s.w, s.h);
      if (share) await shareAsset({ ...asset, caption }, blob);
      else saveBlob(blob, `${slug(title)}-${k}-${s.w}x${s.h}.png`);
    });

  const remove = async () => {
    if (!confirm("Excluir esta arte da biblioteca?")) return;
    const sb = supabase();
    if (asset.path) await sb.storage.from("media").remove([asset.path]);
    const { error } = await sb.from("marketing_assets").delete().eq("id", asset.id);
    if (error) return toast.error(error.message);
    toast.success("Arte excluída");
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 backdrop-blur-sm lg:flex-row" role="dialog" aria-modal="true" aria-label={title}>
      <button onClick={onClose} className="absolute top-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 lg:p-10">
        {asset.kind === "video" ? (
          <video src={asset.url} controls playsInline className="max-h-full max-w-full rounded-xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={title} className="max-h-[55vh] max-w-full rounded-xl object-contain shadow-2xl lg:max-h-full" />
        )}
      </div>
      <aside className="max-h-[60vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 lg:max-h-none lg:w-[400px] lg:rounded-none lg:p-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">
          {FORMAT_LABEL[f]}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        </p>
        <div className="mt-3 grid gap-3">
          <Field label="Nome">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== asset.title && save({ title })} />
          </Field>
          <Field label="Campanha">
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} onBlur={() => campaign !== (asset.campaign ?? "") && save({ campaign: campaign || null })} placeholder="Ex.: Oferta de Natal" />
          </Field>
          <Field label="Legenda do post">
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== (asset.caption ?? "") && save({ caption: caption || null })} placeholder="Escreva a legenda para o Instagram…" className="min-h-[110px]" />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {HASHTAGS.map((h) => (
              <button
                key={h}
                onClick={() => {
                  const next = caption.includes(h) ? caption : `${caption}${caption && !caption.endsWith(" ") ? " " : ""}${h}`;
                  setCaption(next);
                  save({ caption: next });
                }}
                className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-200"
              >
                {h}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(caption).catch(() => {});
              toast.success("Legenda copiada");
            }}
            disabled={!caption}
          >
            <Copy className="h-4 w-4" /> Copiar legenda
          </Button>
        </div>

        <div className="mt-5 grid gap-2">
          <Button variant="sun" onClick={() => run("share", () => shareAsset({ ...asset, caption }))} loading={busy === "share"}>
            <Share2 className="h-4 w-4" /> Compartilhar (Instagram, WhatsApp)
          </Button>
          <Button onClick={() => run("orig", () => downloadOriginal({ ...asset, title }))} loading={busy === "orig"}>
            <Download className="h-4 w-4" /> Baixar original
          </Button>
          {asset.kind === "image" && (
            <div className="mt-2 rounded-2xl bg-ink-50 p-3">
              <p className="mb-2 text-xs font-semibold text-ink-600">Adaptar para o Instagram (sem cortar a arte)</p>
              <div className="grid gap-1.5">
                {(Object.keys(EXPORT_SIZES) as (keyof typeof EXPORT_SIZES)[]).map((k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <button
                      onClick={() => exportSize(k)}
                      disabled={!!busy}
                      className="flex h-9 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-left text-[13px] font-semibold text-ink-700 ring-1 ring-ink-200 hover:ring-ink-300 disabled:opacity-50"
                    >
                      {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-ink-400" />}
                      {EXPORT_SIZES[k].label}
                    </button>
                    <button onClick={() => exportSize(k, true)} disabled={!!busy} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ink-500 ring-1 ring-ink-200 hover:ring-ink-300" aria-label={`Compartilhar em ${EXPORT_SIZES[k].label}`}>
                      {busy === `${k}-s` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button variant="ghost" className="mt-2 text-rose-600" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Excluir arte
          </Button>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ importar */

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const pasted = sessionStorage.getItem("mk-import");
    if (pasted) {
      setUrl(pasted);
      sessionStorage.removeItem("mk-import");
    }
  }, [open]);

  const claude = isClaudeLink(url);
  const submit = async () => {
    setBusy(true);
    const res = await fetch("/api/marketing/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), title }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !json.ok) return toast.error(json.error ?? "Não foi possível importar");
    // Guarda as dimensões para identificar o formato (story, feed…).
    const asset = json.asset as Asset;
    if (asset.kind === "image") {
      loadImage(asset.url)
        .then((img) => supabase().from("marketing_assets").update({ width: img.naturalWidth, height: img.naturalHeight }).eq("id", asset.id))
        .catch(() => {});
    }
    toast.success("Arte importada");
    setUrl("");
    setTitle("");
    onDone();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar por link"
      subtitle="Cole o endereço direto da imagem ou do vídeo (termina em .png, .jpg, .webp ou .mp4)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy} disabled={!/^https:\/\//.test(url.trim()) || claude}>
            Importar
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Link">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/arte.png" autoFocus />
        </Field>
        <Field label="Nome (opcional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Story oferta de Natal" />
        </Field>
        {claude && (
          <div className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
            <b>Links do Claude exigem login</b> e não podem ser baixados automaticamente. No Claude, use <b>Baixar / Exportar PNG</b> e arraste o arquivo aqui — ou clique com o botão
            direito na imagem, <b>Copiar imagem</b>, e aperte <b>Ctrl+V</b> na tela de Marketing.
          </div>
        )}
      </div>
    </Modal>
  );
}
