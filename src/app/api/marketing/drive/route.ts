import { NextResponse } from "next/server";
import { kindOf, parseEmbeddedFolder, type DriveItem } from "@/lib/drive";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_ITEMS = 1500;
const MAX_DEPTH = 3;
const cache = new Map<string, { at: number; body: unknown }>();
const UA = { "User-Agent": "Mozilla/5.0 (compatible; QuarkCRM)", "Accept-Language": "pt-BR" };

type Listing = { title: string | null; items: DriveItem[]; via: "api" | "public" };

/** Com chave: API do Drive (traz tipo, dimensões e duração dos vídeos). */
async function listWithApi(key: string, rootId: string): Promise<Listing> {
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${rootId}?fields=name,mimeType&supportsAllDrives=true&key=${key}`, { signal: AbortSignal.timeout(10000) });
  if (!meta.ok) throw new Error(meta.status === 404 ? "Pasta não encontrada ou não compartilhada." : `Drive recusou (${meta.status}).`);
  const root = (await meta.json()) as { name?: string; mimeType?: string };
  if (root.mimeType && root.mimeType !== "application/vnd.google-apps.folder") throw new Error("O link não é de uma pasta.");

  const items: DriveItem[] = [];
  const queue: { id: string; path: string; depth: number }[] = [{ id: rootId, path: "", depth: 0 }];
  while (queue.length && items.length < MAX_ITEMS) {
    const folder = queue.shift()!;
    let pageToken = "";
    do {
      const q = encodeURIComponent(`'${folder.id}' in parents and trashed = false`);
      const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,createdTime,description,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height,durationMillis))");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=name_natural&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${key}${pageToken ? `&pageToken=${pageToken}` : ""}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Drive recusou a listagem (${res.status}).`);
      const json = (await res.json()) as {
        nextPageToken?: string;
        files?: { id: string; name: string; mimeType: string; createdTime?: string; description?: string; imageMediaMetadata?: { width?: number; height?: number; rotation?: number }; videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string } }[];
      };
      for (const f of json.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          if (folder.depth < MAX_DEPTH) queue.push({ id: f.id, path: folder.path ? `${folder.path}/${f.name}` : f.name, depth: folder.depth + 1 });
          continue;
        }
        const img = f.imageMediaMetadata;
        const vid = f.videoMediaMetadata;
        const rotated = img?.rotation === 1 || img?.rotation === 3;
        const w = img?.width ?? vid?.width ?? null;
        const h = img?.height ?? vid?.height ?? null;
        items.push({
          id: f.id,
          name: f.name,
          mime: f.mimeType,
          kind: kindOf(f.name, f.mimeType),
          width: rotated ? h : w,
          height: rotated ? w : h,
          durationMs: vid?.durationMillis ? Number(vid.durationMillis) : null,
          folder: folder.path,
          folderId: folder.id,
          created: f.createdTime ?? null,
          description: f.description ?? null,
        });
      }
      pageToken = json.nextPageToken ?? "";
    } while (pageToken && items.length < MAX_ITEMS);
  }
  return { title: root.name ?? null, items, via: "api" };
}

/** Sem chave: página pública da pasta (nomes e IDs; as dimensões o app mede pelas miniaturas). */
async function listPublic(rootId: string): Promise<Listing> {
  const items: DriveItem[] = [];
  let title: string | null = null;
  const queue: { id: string; path: string; depth: number }[] = [{ id: rootId, path: "", depth: 0 }];
  let folders = 0;
  while (queue.length && items.length < MAX_ITEMS && folders < 40) {
    const folder = queue.shift()!;
    folders++;
    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folder.id}`, { headers: UA, signal: AbortSignal.timeout(12000) }).catch(() => null);
    if (!res?.ok) {
      if (folder.depth === 0) throw new Error("Não consegui abrir a pasta. Confira se ela está compartilhada como “Qualquer pessoa com o link”.");
      continue;
    }
    const page = parseEmbeddedFolder(await res.text());
    if (folder.depth === 0) {
      title = page.title;
      if (!page.entries.length && !page.title) throw new Error("A pasta está vazia ou não é pública. Compartilhe como “Qualquer pessoa com o link”.");
    }
    for (const e of page.entries) {
      if (e.isFolder) {
        if (folder.depth < MAX_DEPTH) queue.push({ id: e.id, path: folder.path ? `${folder.path}/${e.name}` : e.name, depth: folder.depth + 1 });
        continue;
      }
      items.push({ id: e.id, name: e.name, mime: null, kind: kindOf(e.name), width: null, height: null, durationMs: null, folder: folder.path, folderId: folder.id, created: null, description: null });
    }
  }
  return { title, items, via: "public" };
}

/** Lista todas as mídias de uma pasta do Google Drive (com subpastas). */
export async function GET(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const id = params.get("folder") ?? "";
  if (!/^[\w-]{10,}$/.test(id)) return NextResponse.json({ error: "Link de pasta inválido" }, { status: 400 });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 3 * 60_000 && !params.get("fresh")) return NextResponse.json(hit.body);

  const key = (process.env.GOOGLE_API_KEY || process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();
  try {
    let listing: Listing;
    if (key) {
      try {
        listing = await listWithApi(key, id);
      } catch {
        listing = await listPublic(id); // chave sem a Drive API ativada: cai para a página pública
      }
    } else listing = await listPublic(id);
    const body = { ok: true, ...listing, at: new Date().toISOString() };
    cache.set(id, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao ler a pasta" }, { status: 502 });
  }
}
