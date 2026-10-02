/**
 * Banco de conteúdo pelo Google Drive: lê o link da pasta, lista as mídias e separa
 * em Posts, Stories, Reels/vídeos, Carrosséis, Capas e Outros.
 */

export type MediaKind = "image" | "video" | "other";
export type Category = "post" | "story" | "reels" | "carrossel" | "capa" | "outros";

export const CATEGORIES: { id: Category; label: string; short: string; emoji: string; hint: string }[] = [
  { id: "post", label: "Posts", short: "Posts", emoji: "🖼️", hint: "Feed 4:5 e quadrado" },
  { id: "story", label: "Stories", short: "Stories", emoji: "📱", hint: "Vertical 9:16 · status" },
  { id: "reels", label: "Reels e vídeos", short: "Reels", emoji: "🎬", hint: "Vídeos curtos" },
  { id: "carrossel", label: "Carrosséis", short: "Carrosséis", emoji: "🎠", hint: "Sequência de imagens" },
  { id: "capa", label: "Capas e banners", short: "Capas", emoji: "🪧", hint: "Horizontais" },
  { id: "outros", label: "Outros arquivos", short: "Outros", emoji: "📁", hint: "PDFs e demais" },
];
export const categoryOfId = (id: Category) => CATEGORIES.find((c) => c.id === id)!;

/** Item da pasta (vem da API do Drive ou da página pública da pasta). */
export interface DriveItem {
  id: string;
  name: string;
  mime: string | null;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** Caminho da subpasta (ex.: "Stories/Natal"); vazio na raiz. */
  folder: string;
  folderId: string;
  created: string | null;
  description: string | null;
}

/** ID da pasta a partir do link do Drive (ou do próprio ID colado). */
export function driveFolderId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) ?? s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(s) ? s : null;
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp)$/i;

export function kindOf(name: string, mime?: string | null): MediaKind {
  if (mime?.startsWith("video/") || VIDEO_EXT.test(name)) return "video";
  if (mime?.startsWith("image/") || IMAGE_EXT.test(name)) return "image";
  return "other";
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Categoria pelo nome da subpasta ou do arquivo (quem organiza a pasta manda). */
export function categoryFromHints(name: string, folder: string): Category | null {
  const f = norm(folder);
  const n = norm(name);
  const test = (re: RegExp) => re.test(f) || re.test(n);
  if (test(/carross?e(l|is)|carousels?/)) return "carrossel";
  if (test(/\b(reels?|videos?|tiktok|shorts?)\b/)) return "reels";
  if (test(/\b(stor(y|ies)|status|9x16|9-16)\b/)) return "story";
  if (test(/\b(capas?|banners?|thumbs?|thumbnails?|youtube|16x9|16-9)\b/)) return "capa";
  if (test(/\b(posts?|feed|4x5|4-5|1x1|quadrad)/)) return "post";
  return null;
}

/** Categoria final: dicas de pasta/nome primeiro; depois tipo e proporção. */
export function categoryOf(item: Pick<DriveItem, "name" | "folder" | "kind" | "width" | "height">): Category {
  const hint = categoryFromHints(item.name, item.folder);
  if (item.kind === "other") return "outros";
  if (hint === "carrossel") return item.kind === "image" ? "carrossel" : "reels";
  if (item.kind === "video") return hint === "capa" ? "capa" : "reels";
  if (hint) return hint;
  if (!item.width || !item.height) return "post";
  const r = item.height / item.width;
  if (r >= 1.5) return "story";
  if (r >= 0.9) return "post";
  return "capa";
}

/** Nome bonito para exibir: sem extensão, sem _ e -, com a primeira letra maiúscula. */
export function prettyName(name: string) {
  const s = name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "Arquivo";
}

/** Endereços públicos de um arquivo do Drive (a pasta precisa estar como "qualquer pessoa com o link"). */
export const driveUrls = (id: string) => ({
  thumb: (w = 600) => `https://lh3.googleusercontent.com/d/${id}=w${w}`,
  full: `https://lh3.googleusercontent.com/d/${id}=w2048`,
  download: `https://drive.google.com/uc?export=download&id=${id}`,
  preview: `https://drive.google.com/file/d/${id}/preview`,
  view: `https://drive.google.com/file/d/${id}/view`,
});

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

/**
 * Lê a página pública de uma pasta (drive.google.com/embeddedfolderview?id=…).
 * Não precisa de chave: funciona para pastas compartilhadas como "qualquer pessoa com o link".
 */
export function parseEmbeddedFolder(html: string): { title: string | null; entries: { id: string; name: string; isFolder: boolean }[] } {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1];
  const entries: { id: string; name: string; isFolder: boolean }[] = [];
  const seen = new Set<string>();
  const blocks = html.split(/<div[^>]+class="flip-entry"/i).slice(1);
  for (const b of blocks) {
    const href = b.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? "";
    const id = href.match(/\/folders\/([\w-]+)/)?.[1] ?? href.match(/\/file\/d\/([\w-]+)/)?.[1] ?? href.match(/[?&]id=([\w-]+)/)?.[1] ?? b.match(/id="entry-([\w-]+)"/)?.[1];
    const name = b.match(/class="flip-entry-title"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, name: decode(name.replace(/<[^>]+>/g, "")), isFolder: /\/folders\//.test(href) });
  }
  return { title: title ? decode(title).replace(/\s*[-–]\s*Google Drive\s*$/i, "") || null : null, entries };
}

/** Agrupa as imagens de carrossel por subpasta (cada subpasta = um carrossel). */
export function groupCarousels<T extends { folderId: string; folder: string; name: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const it of items) groups.set(it.folderId, [...(groups.get(it.folderId) ?? []), it]);
  return [...groups.values()].map((list) => [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })));
}

export const fmtDuration = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
