"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  ImagePlus,
  Images,
  Layers,
  Link2,
  Loader2,
  Megaphone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, Field, Input, Modal, Segmented, Skeleton, Textarea, cx } from "@/components/ui";
import { toStoredSettings, type DriveFolder } from "@/lib/defaults";
import { CATEGORIES, categoryOf, categoryOfId, driveFolderId, driveUrls, fmtDuration, groupCarousels, prettyName, type Category, type DriveItem, type MediaKind } from "@/lib/drive";
import { relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { EXPORT_SIZES, HASHTAGS, fitContain, fitCover, formatOf, isClaudeLink } from "@/lib/marketing";
import { productImg } from "@/lib/product-images";
import { supabase } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ tipos */

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

/** Mídia unificada: vinda do Google Drive ou enviada pelo app. */
interface Media {
  key: string;
  source: "drive" | "upload";
  id: string;
  title: string;
  kind: MediaKind;
  category: Category;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  folder: string;
  created: string | null;
  caption: string | null;
  thumb: string;
  full: string;
  download: string;
  preview?: string;
  open?: string;
  children?: Media[];
  asset?: Asset;
}

type Listing = { status: "loading" | "ok" | "error"; title?: string | null; items?: DriveItem[]; via?: string; error?: string; at?: string };
type Tab = "todos" | Category;
type Source = "todos" | "drive" | "upload";

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

function loadImage(src: string, cors = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
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

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const extOf = (blob: Blob, kind: MediaKind) => (blob.type.split("/")[1] || (kind === "video" ? "mp4" : "png")).replace("jpeg", "jpg").replace("quicktime", "mov");

/** Endereço da imagem que o app consegue ler (para compartilhar e adaptar no canvas). */
const readable = (m: Media) => (m.source === "drive" ? productImg(m.full) : m.full);

async function imageBlob(m: Media) {
  return fetchBlob(readable(m));
}

/** Arte encaixada no tamanho do Instagram, com fundo desfocado da própria imagem. */
async function adapt(m: Media, w: number, h: number): Promise<Blob> {
  const img = await loadImage(readable(m));
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

/** Celular: abre o compartilhar (Instagram, WhatsApp/status) com um ou vários arquivos. Computador: baixa. */
async function shareFiles(blobs: { blob: Blob; name: string }[], text?: string | null) {
  const files = blobs.map((b) => new File([b.blob], b.name, { type: b.blob.type }));
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, text: text ?? undefined }).catch(() => {});
    return;
  }
  blobs.forEach((b) => saveBlob(b.blob, b.name));
  if (text) await navigator.clipboard.writeText(text).catch(() => {});
  toast.success(`${blobs.length > 1 ? `${blobs.length} artes baixadas` : "Arte baixada"}${text ? " e legenda copiada" : ""}`);
}

async function downloadMedia(m: Media) {
  if (m.source === "drive") {
    window.open(m.download, "_blank", "noopener");
    return;
  }
  const blob = await fetchBlob(m.full);
  saveBlob(blob, `${slug(m.title)}.${extOf(blob, m.kind)}`);
}

/** Carrossel: baixa todas as imagens em ordem (1, 2, 3…). */
async function downloadAll(m: Media) {
  const list = m.children ?? [m];
  for (const [i, c] of list.entries()) {
    const blob = await imageBlob(c);
    saveBlob(blob, `${slug(m.title)}-${String(i + 1).padStart(2, "0")}.${extOf(blob, "image")}`);
  }
  toast.success(`${list.length} imagens baixadas`);
}

async function shareMedia(m: Media, caption?: string | null) {
  if (m.children?.length) {
    const blobs = await Promise.all(m.children.map(async (c, i) => ({ blob: await imageBlob(c), name: `${slug(m.title)}-${i + 1}.jpg` })));
    return shareFiles(blobs, caption);
  }
  if (m.kind === "video" && m.source === "drive") {
    const url = m.open ?? m.download;
    if (navigator.share) await navigator.share({ title: m.title, text: caption ?? undefined, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link do vídeo copiado");
    }
    return;
  }
  const blob = m.kind === "image" ? await imageBlob(m) : await fetchBlob(m.full);
  return shareFiles([{ blob, name: `${slug(m.title)}.${extOf(blob, m.kind)}` }], caption);
}

/* ----------------------------------------------------------------- mídias */

function fromDrive(it: DriveItem, dims?: { w: number; h: number }): Media {
  const u = driveUrls(it.id);
  const width = it.width ?? dims?.w ?? null;
  const height = it.height ?? dims?.h ?? null;
  return {
    key: `d-${it.id}`,
    source: "drive",
    id: it.id,
    title: prettyName(it.name),
    kind: it.kind,
    category: categoryOf({ ...it, width, height }),
    width,
    height,
    durationMs: it.durationMs,
    folder: it.folder,
    created: it.created,
    caption: it.description,
    thumb: u.thumb(700),
    full: u.full,
    download: u.download,
    preview: u.preview,
    open: u.view,
  };
}

function fromAsset(a: Asset): Media {
  const f = formatOf(a.width, a.height);
  const category: Category = a.kind === "video" ? "reels" : f === "story" ? "story" : f === "landscape" ? "capa" : "post";
  return {
    key: `u-${a.id}`,
    source: "upload",
    id: a.id,
    title: a.title || "Arte",
    kind: a.kind,
    category,
    width: a.width,
    height: a.height,
    durationMs: null,
    folder: a.campaign ?? "",
    created: a.created_at,
    caption: a.caption,
    thumb: a.url,
    full: a.url,
    download: a.url,
    asset: a,
  };
}

/* -------------------------------------------------------------------- tela */

export default function MarketingPage() {
  const { user, settings } = useApp();
  const folders = settings.marketing_drive;
  const [listings, setListings] = useState<Record<string, Listing>>({});
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});
  const [measuring, setMeasuring] = useState<{ done: number; total: number } | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [source, setSource] = useState<Source>("todos");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const measured = useRef(new Set<string>());

  /* ---------- Drive ---------- */
  const loadFolder = useCallback(async (f: DriveFolder, fresh = false) => {
    setListings((m) => ({ ...m, [f.id]: { ...m[f.id], status: "loading" } }));
    const res = await fetch(`/api/marketing/drive?folder=${f.id}${fresh ? "&fresh=1" : ""}`).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !json.ok) setListings((m) => ({ ...m, [f.id]: { status: "error", error: json.error ?? "Não foi possível ler a pasta" } }));
    else setListings((m) => ({ ...m, [f.id]: { status: "ok", title: json.title, items: json.items, via: json.via, at: json.at } }));
  }, []);

  const folderKey = folders.map((f) => f.id).join(",");
  useEffect(() => {
    folders.forEach((f) => loadFolder(f));
  }, [folderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sem a API do Drive não vêm as dimensões: mede pela miniatura para saber se é story, post ou capa.
  useEffect(() => {
    const todo = Object.values(listings)
      .flatMap((l) => l.items ?? [])
      .filter((it) => it.kind !== "other" && (!it.width || !it.height) && !measured.current.has(it.id));
    if (!todo.length) return;
    todo.forEach((it) => measured.current.add(it.id));
    let done = 0;
    setMeasuring({ done, total: todo.length });
    const queue = [...todo];
    const found: Record<string, { w: number; h: number }> = {};
    const flush = () => setDims((d) => ({ ...d, ...found }));
    Promise.all(
      Array.from({ length: 8 }, async () => {
        while (queue.length) {
          const it = queue.shift()!;
          try {
            const img = await loadImage(driveUrls(it.id).thumb(220), false);
            found[it.id] = { w: img.naturalWidth, h: img.naturalHeight };
          } catch {}
          done++;
          if (done % 12 === 0) {
            flush();
            setMeasuring({ done, total: todo.length });
          }
        }
      }),
    ).then(() => {
      flush();
      setMeasuring(null);
    });
  }, [listings]);

  const saveFolders = async (next: DriveFolder[]) => {
    const { error } = await supabase().from("settings").upsert({ id: 1, data: toStoredSettings({ ...settings, marketing_drive: next }) });
    if (error) toast.error(error.message);
    return !error;
  };
  const removeFolder = async (f: DriveFolder) => {
    if (!confirm(`Desconectar a pasta “${f.name}”? Os arquivos continuam no seu Drive.`)) return;
    if (await saveFolders(folders.filter((x) => x.id !== f.id))) toast.success("Pasta desconectada");
  };

  /* ---------- enviados pelo app ---------- */
  const { data: uploads, reload } = useLive(
    async () => {
      const { data, error } = await supabase().from("marketing_assets").select("*").order("created_at", { ascending: false }).limit(500);
      return { rows: (data ?? []) as Asset[], missing: !!error };
    },
    [],
    ["marketing_assets"],
  );

  const upload = useCallback(
    async (files: File[]) => {
      const list = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (!list.length) return toast.error("Envie imagens (PNG, JPG, WEBP) ou vídeos (MP4, MOV).");
      setUploading({ done: 0, total: list.length });
      const sb = supabase();
      let ok = 0;
      for (const [i, file] of list.entries()) {
        const video = file.type.startsWith("video/");
        if (file.size > (video ? 45 : 15) * 1024 * 1024) {
          toast.error(`${file.name}: grande demais (imagem até 15 MB, vídeo até 45 MB). Vídeos grandes: coloque na pasta do Drive.`);
          continue;
        }
        const ext = (file.name.split(".").pop() || (video ? "mp4" : "png")).toLowerCase().slice(0, 5);
        const path = `marketing/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await sb.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        if (up.error) {
          toast.error(/bucket/i.test(up.error.message) ? "Armazenamento não configurado: rode o supabase/schema.sql." : up.error.message);
          continue;
        }
        const url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
        const d = await dimsOf(file);
        const { error } = await sb.from("marketing_assets").insert({ title: prettyName(file.name).slice(0, 80), url, path, kind: video ? "video" : "image", width: d?.width ?? null, height: d?.height ?? null, created_by: user.id });
        if (error) toast.error(error.message);
        else ok++;
        setUploading({ done: i + 1, total: list.length });
      }
      setUploading(null);
      if (ok) toast.success(`${ok} ${ok === 1 ? "arquivo adicionado" : "arquivos adicionados"}`);
      reload();
    },
    [user.id, reload],
  );

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
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      if (driveFolderId(text) && /drive\.google\.com/.test(text)) {
        e.preventDefault();
        sessionStorage.setItem("mk-drive", text);
        setConnectOpen(true);
      } else if (/^https:\/\//.test(text)) {
        e.preventDefault();
        sessionStorage.setItem("mk-import", text);
        setImportOpen(true);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  /* ---------- biblioteca ---------- */
  const all = useMemo(() => {
    const driveItems = Object.values(listings).flatMap((l) => l.items ?? []);
    const seen = new Set<string>();
    const medias = driveItems.filter((it) => !seen.has(it.id) && seen.add(it.id)).map((it) => fromDrive(it, dims[it.id]));
    // Carrosséis: cada subpasta de carrossel vira um único cartão com as imagens em ordem.
    const carousel = medias.filter((m) => m.category === "carrossel");
    const rest = medias.filter((m) => m.category !== "carrossel");
    const byId = new Map(driveItems.map((it) => [it.id, it]));
    const groups = groupCarousels(carousel.map((m) => ({ ...m, folderId: byId.get(m.id)?.folderId ?? "", name: byId.get(m.id)?.name ?? m.title })));
    const carousels: Media[] = groups.map((g) => ({
      ...g[0],
      key: `c-${g[0].folderId}`,
      title: g[0].folder.split("/").pop() || g[0].title,
      children: g,
    }));
    const ups = (uploads?.rows ?? []).map(fromAsset);
    return [...carousels, ...rest, ...ups];
  }, [listings, dims, uploads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((m) => (source === "todos" || m.source === source) && (!q || `${m.title} ${m.folder} ${m.caption ?? ""}`.toLowerCase().includes(q)));
  }, [all, source, query]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORIES.map((x) => [x.id, 0])) as Record<Category, number>;
    filtered.forEach((m) => c[m.category]++);
    return c;
  }, [filtered]);
  const visible = tab === "todos" ? filtered : filtered.filter((m) => m.category === tab);
  const openIndex = open ? visible.findIndex((m) => m.key === open) : -1;
  const current = openIndex >= 0 ? visible[openIndex] : open ? all.find((m) => m.key === open) ?? null : null;
  const loadingDrive = Object.values(listings).some((l) => l.status === "loading");
  const totalDrive = Object.values(listings).reduce((s, l) => s + (l.items?.length ?? 0), 0);

  return (
    <div
      className="animate-fade-up space-y-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload([...e.dataTransfer.files]);
      }}
    >
      {/* ------------------------------------------------ topo */}
      <section className="glass-dark relative overflow-hidden rounded-[28px] p-5 text-white sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full bg-[#9BD373]/25 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#5B34D6]/40 blur-[100px]" />
        <div className="pointer-events-none absolute top-10 left-10 h-40 w-40 rounded-full bg-[#F3EA3B]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-[#F3EA3B] uppercase ring-1 ring-white/15">
              <Megaphone className="h-3.5 w-3.5" /> Marketing
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Banco de <span className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text text-transparent">conteúdo</span>
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/60">Suas artes e vídeos direto do Google Drive, organizados em posts, stories, reels e carrosséis. Baixe ou compartilhe no Instagram e no status em um toque.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {folders.length > 0 && (
              <button
                onClick={() => folders.forEach((f) => loadFolder(f, true))}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <RefreshCw className={cx("h-4 w-4", loadingDrive && "animate-spin")} /> Atualizar
              </button>
            )}
            <button onClick={() => setConnectOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-4 text-sm font-bold text-[#1C1234] shadow-[0_10px_30px_-10px_rgba(243,234,59,0.7)] transition hover:brightness-105">
              <Plus className="h-4 w-4" /> {folders.length ? "Outra pasta" : "Conectar Google Drive"}
            </button>
          </div>
        </div>

        {folders.length > 0 ? (
          <div className="relative mt-5 flex flex-wrap gap-2">
            {folders.map((f) => {
              const l = listings[f.id];
              return (
                <div key={f.id} className="group inline-flex max-w-full items-center gap-2.5 rounded-2xl bg-white/[0.07] py-2 pr-2 pl-3 ring-1 ring-white/10 backdrop-blur">
                  <DriveLogo className="h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{l?.title || f.name}</p>
                    <p className="text-[11px] text-white/50">
                      {l?.status === "loading" ? "Lendo a pasta…" : l?.status === "error" ? <span className="text-rose-300">{l.error}</span> : `${l?.items?.length ?? 0} arquivos · atualizado ${relativeTime(l?.at)}`}
                    </p>
                  </div>
                  <a href={f.url} target="_blank" rel="noreferrer" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white" aria-label="Abrir no Drive">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button onClick={() => removeFolder(f)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-rose-300" aria-label="Desconectar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { n: "1", t: "Organize no Drive", d: "Uma pasta com subpastas Posts, Stories, Reels e Carrosséis (opcional: o app também separa pela proporção)." },
              { n: "2", t: "Compartilhe o link", d: "No Drive: Compartilhar → Acesso geral → Qualquer pessoa com o link (Leitor)." },
              { n: "3", t: "Cole aqui", d: "Toque em Conectar e cole o link. Tudo que você adicionar na pasta aparece sozinho." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-xs font-bold text-[#1C1234]">{s.n}</span>
                <p className="mt-2 text-sm font-semibold">{s.t}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/55">{s.d}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ categorias */}
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2.5 sm:grid sm:grid-cols-4 lg:grid-cols-7">
          <CategoryTile active={tab === "todos"} onClick={() => setTab("todos")} emoji="✨" label="Tudo" hint="Biblioteca completa" count={filtered.length} />
          {CATEGORIES.map((c) => (
            <CategoryTile key={c.id} active={tab === c.id} onClick={() => setTab(c.id)} emoji={c.emoji} label={c.short} hint={c.hint} count={counts[c.id]} muted={!counts[c.id]} />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ busca */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, pasta ou legenda" className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Segmented<Source>
            value={source}
            onChange={setSource}
            options={[
              { value: "todos", label: "Todas as origens" },
              { value: "drive", label: "Drive" },
              { value: "upload", label: "Enviados" },
            ]}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={!!uploading} title="Enviar do computador ou celular">
            <ImagePlus className="h-4 w-4" /> <span className="hidden sm:inline">Enviar</span>
          </Button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => e.target.files && upload([...e.target.files])} />

      {(measuring || uploading || drag) && (
        <div className={cx("flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1", drag ? "bg-sun-50 text-sun-700 ring-sun-300" : "glass text-ink-600")}>
          {drag ? <ImagePlus className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
          {drag ? "Solte para adicionar à biblioteca" : uploading ? `Enviando ${uploading.done}/${uploading.total}…` : `Organizando as mídias por formato… ${measuring!.done}/${measuring!.total}`}
        </div>
      )}
      {uploads?.missing && <p className="rounded-2xl bg-amber-50/90 p-4 text-sm text-amber-900 ring-1 ring-amber-200">Para enviar arquivos pelo app, rode novamente o supabase/schema.sql. A pasta do Drive funciona mesmo assim.</p>}

      {/* ------------------------------------------------ biblioteca */}
      {loadingDrive && !totalDrive && !(uploads?.rows.length ?? 0) ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-3xl" />
          ))}
        </div>
      ) : !visible.length ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[#1C1234] to-[#3a2a6b] text-[#F3EA3B] shadow-lift">
            {folders.length ? <Images className="h-7 w-7" /> : <DriveLogo className="h-8 w-8" />}
          </span>
          <p className="mt-4 font-display text-lg font-semibold">{folders.length ? "Nada por aqui" : "Conecte sua pasta do Google Drive"}</p>
          <p className="mt-1 max-w-md text-sm text-ink-500">
            {folders.length ? "Troque a categoria ou a busca, ou adicione arquivos na pasta e toque em Atualizar." : "Coloque suas artes e vídeos numa pasta do Drive, compartilhe com o link e cole aqui. O app separa tudo sozinho."}
          </p>
          {!folders.length && (
            <Button className="mt-5" variant="sun" onClick={() => setConnectOpen(true)}>
              <Link2 className="h-4 w-4" /> Colar link da pasta
            </Button>
          )}
        </div>
      ) : tab === "todos" ? (
        <div className="space-y-8">
          {CATEGORIES.filter((c) => counts[c.id]).map((c) => {
            const list = visible.filter((m) => m.category === c.id);
            const limit = c.id === "capa" ? 6 : c.id === "outros" ? 8 : 12;
            return (
              <section key={c.id}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">
                      {c.emoji} {c.label} <span className="text-sm font-medium text-ink-400">· {list.length}</span>
                    </h2>
                    <p className="text-xs text-ink-500">{c.hint}</p>
                  </div>
                  {list.length > limit && (
                    <button onClick={() => setTab(c.id)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-sun-700 hover:underline">
                      Ver todos <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <MediaGrid category={c.id} items={list.slice(0, limit)} onOpen={setOpen} />
              </section>
            );
          })}
        </div>
      ) : (
        <MediaGrid category={tab} items={visible} onOpen={setOpen} />
      )}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-ink-400">
        <ClipboardPaste className="h-3.5 w-3.5" /> Dica: cole (Ctrl+V) um link de pasta do Drive ou uma imagem copiada em qualquer lugar desta tela.
      </p>

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} folders={folders} onSave={saveFolders} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} />
      {current && (
        <Viewer
          media={current}
          index={openIndex}
          total={visible.length}
          onPrev={openIndex > 0 ? () => setOpen(visible[openIndex - 1].key) : undefined}
          onNext={openIndex >= 0 && openIndex < visible.length - 1 ? () => setOpen(visible[openIndex + 1].key) : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ peças */

function DriveLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function CategoryTile({ active, onClick, emoji, label, hint, count, muted }: { active: boolean; onClick: () => void; emoji: string; label: string; hint: string; count: number; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "relative min-w-[132px] shrink-0 overflow-hidden rounded-2xl p-3.5 text-left transition duration-300 sm:min-w-0",
        active ? "bg-gradient-to-br from-[#1C1234] to-[#3a2a6b] text-white shadow-[0_14px_32px_-14px_rgba(28,18,52,0.7)] ring-1 ring-white/10" : "glass hover:-translate-y-0.5",
        muted && !active && "opacity-60",
      )}
    >
      {active && <span className="pointer-events-none absolute -top-8 -right-6 h-20 w-20 rounded-full bg-[#9BD373]/30 blur-2xl" />}
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xl leading-none">{emoji}</span>
        <span className={cx("font-display text-xl font-semibold tabular-nums", active ? "text-[#F3EA3B]" : "text-ink-900")}>{count}</span>
      </div>
      <p className={cx("relative mt-2 text-sm font-semibold", active ? "text-white" : "text-ink-900")}>{label}</p>
      <p className={cx("relative truncate text-[11px]", active ? "text-white/55" : "text-ink-500")}>{hint}</p>
    </button>
  );
}

function MediaGrid({ category, items, onOpen }: { category: Category; items: Media[]; onOpen: (key: string) => void }) {
  if (category === "outros")
    return (
      <div className="glass divide-y divide-ink-900/[0.05] overflow-hidden rounded-3xl">
        {items.map((m) => (
          <button key={m.key} onClick={() => onOpen(m.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/70">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-900/[0.05] text-ink-500">
              <FileText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.title}</span>
              <span className="block truncate text-xs text-ink-500">{m.folder || "Pasta principal"}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-300" />
          </button>
        ))}
      </div>
    );
  const cols = category === "capa" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : category === "post" || category === "carrossel" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6";
  return (
    <div className={cx("grid gap-3 sm:gap-4", cols)}>
      {items.map((m) => (
        <Tile key={m.key} m={m} onOpen={() => onOpen(m.key)} />
      ))}
    </div>
  );
}

function Tile({ m, onOpen }: { m: Media; onOpen: () => void }) {
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const ratio = m.category === "story" || m.category === "reels" ? "9 / 16" : m.category === "capa" ? "16 / 9" : "4 / 5";
  const quick = async (e: React.MouseEvent, fn: () => Promise<void>) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await fn();
    } catch {
      toast.error("Não foi possível concluir");
    }
    setBusy(false);
  };
  const duration = fmtDuration(m.durationMs);
  return (
    <div onClick={onOpen} className="group relative cursor-pointer">
      {m.children && (
        <>
          <div className="absolute inset-x-3 -top-2 h-full rounded-[22px] bg-ink-900/15 ring-1 ring-white/50" />
          <div className="absolute inset-x-1.5 -top-1 h-full rounded-[22px] bg-ink-900/25 ring-1 ring-white/50" />
        </>
      )}
      <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1C1234] to-[#07060F] shadow-[0_14px_30px_-18px_rgba(28,18,52,0.6)] ring-1 ring-white/60 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_22px_40px_-18px_rgba(28,18,52,0.6)]" style={{ aspectRatio: ratio }}>
        {broken ? (
          <div className="grid h-full place-items-center text-white/40">{m.kind === "video" ? <Play className="h-8 w-8" /> : <Images className="h-8 w-8" />}</div>
        ) : m.kind === "video" && m.source === "upload" ? (
          <video src={m.full} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumb} alt={m.title} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/20" />

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {m.source === "drive" ? (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/90 shadow">
              <DriveLogo className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-700 shadow">Enviado</span>
          )}
          {m.children && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              <Layers className="h-3 w-3" /> {m.children.length}
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={(e) => quick(e, () => shareMedia(m, m.caption))} disabled={busy} className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-ink-800 shadow backdrop-blur hover:bg-white" aria-label="Compartilhar">
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => quick(e, () => downloadMedia(m.children?.[0] ?? m))} disabled={busy} className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-ink-800 shadow backdrop-blur hover:bg-white" aria-label="Baixar">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
        </div>

        {m.kind === "video" && (
          <span className="absolute top-1/2 left-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-md transition group-hover:scale-110">
            <Play className="ml-0.5 h-6 w-6 fill-white" />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-white drop-shadow">{m.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-white/65">
            {duration && <span className="rounded bg-black/40 px-1 font-semibold text-white">{duration}</span>}
            <span className="truncate">{m.folder || (m.source === "drive" ? "Pasta principal" : relativeTime(m.created))}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ visualizar */

function Viewer({ media, index, total, onPrev, onNext, onClose }: { media: Media; index: number; total: number; onPrev?: () => void; onNext?: () => void; onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const [caption, setCaption] = useState(media.caption ?? "");
  const [title, setTitle] = useState(media.title);
  const [busy, setBusy] = useState<string | null>(null);
  const shown = media.children?.[slide] ?? media;
  const cat = categoryOfId(media.category);

  useEffect(() => {
    setSlide(0);
    setCaption(media.caption ?? "");
    setTitle(media.title);
  }, [media.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        if (media.children && slide < media.children.length - 1) setSlide((s) => s + 1);
        else onNext?.();
      }
      if (e.key === "ArrowLeft") {
        if (media.children && slide > 0) setSlide((s) => s - 1);
        else onPrev?.();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onNext, onPrev, media.children, slide]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      toast.error("Não foi possível concluir. Confira se a pasta está compartilhada com o link.");
    }
    setBusy(null);
  };
  const saveAsset = async (patch: Partial<Asset>) => {
    if (!media.asset) return;
    const { error } = await supabase().from("marketing_assets").update(patch).eq("id", media.asset.id);
    if (error) toast.error(error.message);
  };
  const remove = async () => {
    if (!media.asset || !confirm("Excluir este arquivo da biblioteca?")) return;
    const sb = supabase();
    if (media.asset.path) await sb.storage.from("media").remove([media.asset.path]);
    const { error } = await sb.from("marketing_assets").delete().eq("id", media.asset.id);
    if (error) return toast.error(error.message);
    toast.success("Arquivo excluído");
    onClose();
  };
  const exportSize = (k: keyof typeof EXPORT_SIZES, share = false) =>
    run(`${k}${share ? "-s" : ""}`, async () => {
      const s = EXPORT_SIZES[k];
      const blob = await adapt(shown, s.w, s.h);
      const name = `${slug(title)}-${k}-${s.w}x${s.h}.png`;
      if (share) await shareFiles([{ blob, name }], caption);
      else saveBlob(blob, name);
    });

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#07060F]/95 backdrop-blur-xl lg:flex-row" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#5B34D6]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-[#9BD373]/15 blur-[120px]" />
      <button onClick={onClose} className="absolute top-3 right-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20 lg:bg-ink-900/[0.06] lg:text-ink-700 lg:ring-ink-900/10 lg:hover:bg-ink-900/10" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>

      {/* Mídia */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 pt-14 lg:p-10">
        {onPrev && !media.children && (
          <button onClick={onPrev} className="absolute top-1/2 left-3 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20 lg:grid" aria-label="Anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {onNext && !media.children && (
          <button onClick={onNext} className="absolute top-1/2 right-3 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20 lg:grid" aria-label="Próximo">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <div className="relative flex max-h-full min-h-0 w-full flex-1 items-center justify-center">
          {shown.kind === "video" ? (
            shown.source === "drive" ? (
              <iframe
                key={shown.id}
                src={shown.preview}
                title={shown.title}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="h-full max-h-[70vh] rounded-2xl bg-black shadow-2xl ring-1 ring-white/10 lg:max-h-full"
                style={{ aspectRatio: shown.width && shown.height ? `${shown.width} / ${shown.height}` : "9 / 16", maxWidth: "100%" }}
              />
            ) : (
              <video src={shown.full} controls playsInline autoPlay className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl lg:max-h-full" />
            )
          ) : shown.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={shown.key} src={shown.full} alt={title} className="max-h-[55vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10 lg:max-h-full" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/70">
              <FileText className="h-16 w-16" />
              <p className="text-sm">Este arquivo não tem pré-visualização.</p>
            </div>
          )}
          {media.children && (
            <>
              <button onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} className="absolute top-1/2 left-1 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur disabled:opacity-30" aria-label="Imagem anterior">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => setSlide((s) => Math.min(media.children!.length - 1, s + 1))} disabled={slide === media.children.length - 1} className="absolute top-1/2 right-1 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur disabled:opacity-30" aria-label="Próxima imagem">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        {media.children && (
          <div className="scrollbar-none flex max-w-full gap-2 overflow-x-auto pb-1">
            {media.children.map((c, i) => (
              <button key={c.key} onClick={() => setSlide(i)} className={cx("h-16 w-14 shrink-0 overflow-hidden rounded-xl ring-2 transition", i === slide ? "ring-[#F3EA3B]" : "opacity-60 ring-transparent hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumb} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {total > 1 && index >= 0 && (
          <p className="text-xs text-white/40">
            {index + 1} de {total} · use ← → para navegar
          </p>
        )}
      </div>

      {/* Painel */}
      <aside className="relative max-h-[52vh] w-full overflow-y-auto rounded-t-[28px] bg-white/95 p-5 backdrop-blur-2xl lg:max-h-none lg:w-[420px] lg:rounded-none lg:p-7 lg:pt-16">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F3EA3B]/40 to-[#9BD373]/40 px-2.5 py-1 text-[11px] font-bold text-ink-800">
            {cat.emoji} {cat.label}
          </span>
          {media.source === "drive" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-600">
              <DriveLogo className="h-3 w-3" /> Google Drive
            </span>
          ) : (
            <span className="rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-600">Enviado pelo app</span>
          )}
          {shown.width && shown.height && (
            <span className="text-[11px] text-ink-400">
              {shown.width}×{shown.height}
            </span>
          )}
        </div>

        {media.asset ? (
          <div className="mt-4">
            <Field label="Nome">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== media.asset!.title && saveAsset({ title })} />
            </Field>
          </div>
        ) : (
          <div className="mt-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">{media.title}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
              <FolderOpen className="h-3.5 w-3.5" /> {media.folder || "Pasta principal"}
              {media.children && ` · ${media.children.length} imagens`}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-2">
          <Button variant="sun" size="lg" onClick={() => run("share", () => shareMedia(media, caption))} loading={busy === "share"}>
            <Share2 className="h-4 w-4" /> {media.children ? "Compartilhar carrossel" : "Compartilhar no Instagram / status"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => run("dl", () => (media.children ? downloadAll(media) : downloadMedia(shown)))} loading={busy === "dl"}>
              <Download className="h-4 w-4" /> {media.children ? "Baixar todas" : "Baixar original"}
            </Button>
            {media.open ? (
              <a href={shown.open ?? media.open} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full">
                  <ExternalLink className="h-4 w-4" /> Abrir no Drive
                </Button>
              </a>
            ) : (
              <Button variant="secondary" onClick={remove}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        </div>

        {shown.kind === "image" && (
          <div className="mt-4 rounded-2xl bg-ink-900/[0.03] p-3 ring-1 ring-ink-900/5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
              <Sparkles className="h-3.5 w-3.5 text-sun-600" /> Adaptar sem cortar a arte
            </p>
            <div className="grid gap-1.5">
              {(Object.keys(EXPORT_SIZES) as (keyof typeof EXPORT_SIZES)[]).map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <button
                    onClick={() => exportSize(k)}
                    disabled={!!busy}
                    className="flex h-9 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-left text-[13px] font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:ring-ink-900/20 disabled:opacity-50"
                  >
                    {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-ink-400" />}
                    {EXPORT_SIZES[k].label}
                  </button>
                  <button onClick={() => exportSize(k, true)} disabled={!!busy} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ink-500 ring-1 ring-ink-900/10 hover:ring-ink-900/20" aria-label={`Compartilhar em ${EXPORT_SIZES[k].label}`}>
                    {busy === `${k}-s` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <Field label="Legenda do post">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={() => media.asset && caption !== (media.asset.caption ?? "") && saveAsset({ caption: caption || null })}
              placeholder="Escreva a legenda para o Instagram…"
              className="min-h-[96px]"
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HASHTAGS.map((h) => (
              <button
                key={h}
                onClick={() => setCaption((c) => (c.includes(h) ? c : `${c}${c && !c.endsWith(" ") ? " " : ""}${h}`))}
                className="rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-900/10"
              >
                {h}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            disabled={!caption}
            onClick={async () => {
              await navigator.clipboard.writeText(caption).catch(() => {});
              toast.success("Legenda copiada");
            }}
          >
            <Copy className="h-4 w-4" /> Copiar legenda
          </Button>
        </div>
        {media.asset && media.open == null && (
          <p className="mt-4 text-center text-[11px] text-ink-400">Arquivos enviados pelo app ficam no armazenamento do Quark.</p>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ conectar */

function ConnectModal({ open, onClose, folders, onSave }: { open: boolean; onClose: () => void; folders: DriveFolder[]; onSave: (f: DriveFolder[]) => Promise<boolean> }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const pasted = sessionStorage.getItem("mk-drive");
    if (pasted) {
      setUrl(pasted);
      sessionStorage.removeItem("mk-drive");
    }
  }, [open]);
  const id = driveFolderId(url);
  const submit = async () => {
    if (!id) return;
    if (folders.some((f) => f.id === id)) return toast("Essa pasta já está conectada");
    setBusy(true);
    const res = await fetch(`/api/marketing/drive?folder=${id}&fresh=1`).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !json.ok) {
      setBusy(false);
      return toast.error(json.error ?? "Não consegui abrir a pasta. Confira o compartilhamento.");
    }
    const ok = await onSave([...folders, { id, url: url.trim(), name: json.title || "Pasta do Drive" }]);
    setBusy(false);
    if (!ok) return;
    toast.success(`Pasta conectada: ${json.items.length} arquivos encontrados`);
    setUrl("");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conectar pasta do Google Drive"
      subtitle="O app lê a pasta e as subpastas e separa tudo por formato."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy} disabled={!id}>
            <Link2 className="h-4 w-4" /> Conectar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Link da pasta" hint={url && !id ? "Esse link não parece ser de uma pasta do Drive." : "Ex.: https://drive.google.com/drive/folders/…"}>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link da pasta" autoFocus />
        </Field>
        <div className="rounded-2xl bg-gradient-to-br from-sun-50 to-white p-4 text-[13px] leading-relaxed text-ink-700 ring-1 ring-sun-200/70">
          <p className="font-semibold text-ink-900">Como deixar a pasta pronta</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>
              No Drive, clique com o botão direito na pasta → <b>Compartilhar</b>.
            </li>
            <li>
              Em <b>Acesso geral</b>, escolha <b>Qualquer pessoa com o link</b> (Leitor) e copie o link.
            </li>
            <li>
              Para organizar do seu jeito, crie subpastas <b>Posts</b>, <b>Stories</b>, <b>Reels</b> e <b>Carrosséis</b> (uma subpasta por carrossel). Sem subpastas, o app separa pela proporção da arte.
            </li>
          </ol>
        </div>
      </div>
    </Modal>
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
            <b>Links do Claude exigem login</b> e não podem ser baixados automaticamente. Baixe o PNG e arraste o arquivo aqui, ou copie a imagem e aperte <b>Ctrl+V</b>.
          </div>
        )}
      </div>
    </Modal>
  );
}
