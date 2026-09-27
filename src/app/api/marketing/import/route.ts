import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { isClaudeLink, isPrivateHost } from "@/lib/marketing";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 45 * 1024 * 1024;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov" };

/** Endereço público e seguro? (https, sem IP interno — inclusive depois de resolver o DNS). */
async function safeUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || isPrivateHost(u.hostname)) return null;
  try {
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateHost(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

/** Importa uma arte a partir de um link direto da imagem/vídeo e guarda no Storage do app. */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });

  const { url, title } = (await req.json().catch(() => ({}))) as { url?: string; title?: string };
  const raw = String(url ?? "").trim();
  if (isClaudeLink(raw))
    return NextResponse.json(
      { error: "Links do Claude exigem login e não podem ser importados direto. No Claude, clique em baixar (PNG) ou copie a imagem e cole aqui com Ctrl+V." },
      { status: 400 },
    );

  // Segue até 3 redirecionamentos, validando cada destino.
  let target = await safeUrl(raw);
  let res: Response | null = null;
  for (let hop = 0; target && hop < 4; hop++) {
    res = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0 QuarkCRM" } }).catch(() => null);
    if (!res || res.status < 300 || res.status >= 400) break;
    const next = res.headers.get("location");
    target = next ? await safeUrl(new URL(next, target).toString()) : null;
    res = null;
  }
  if (!target || !res) return NextResponse.json({ error: "Link inválido ou inacessível. Use o endereço direto da imagem (https)." }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: `O site respondeu com erro ${res.status}.` }, { status: 400 });

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return NextResponse.json({ error: "O link não aponta para uma imagem ou vídeo (PNG, JPG, WEBP, GIF ou MP4). Abra a imagem e copie o endereço dela." }, { status: 400 });
  const kind = type.startsWith("video/") ? "video" : "image";
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > (kind === "video" ? MAX_VIDEO : MAX_IMAGE)) return NextResponse.json({ error: "Arquivo grande demais (imagem até 15 MB, vídeo até 45 MB)." }, { status: 413 });

  const path = `marketing/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb.storage.from("media").upload(path, body, { contentType: type, cacheControl: "31536000", upsert: false });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  const publicUrl = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  const name = (title ?? "").trim() || decodeURIComponent(target.pathname.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "Arte importada";
  const { data, error } = await sb.from("marketing_assets").insert({ title: name, url: publicUrl, path, kind, created_by: user.id }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, asset: data });
}
