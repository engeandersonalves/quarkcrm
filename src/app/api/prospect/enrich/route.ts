import { NextResponse } from "next/server";
import { extractContacts } from "@/lib/prospect";
import { safeFetch } from "@/lib/safe-fetch";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Lê o site do comércio e devolve e-mails, Instagram, Facebook e WhatsApp encontrados. */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  let raw = String(url ?? "").trim();
  if (raw && !/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  if (/instagram\.com|facebook\.com/i.test(raw)) return NextResponse.json({ error: "Este link já é a rede social do comércio." }, { status: 400 });

  const got = await safeFetch(raw, { allowHttp: true, headers: { "User-Agent": "Mozilla/5.0 (compatible; QuarkCRM)", Accept: "text/html" } });
  if (!got?.res.ok) return NextResponse.json({ error: "Não consegui abrir o site." }, { status: 400 });
  const type = got.res.headers.get("content-type") ?? "";
  if (!type.includes("html")) return NextResponse.json({ error: "O link não é uma página de site." }, { status: 400 });

  // Lê no máximo 1,5 MB da página.
  const reader = got.res.body?.getReader();
  let html = "";
  const decoder = new TextDecoder();
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    size += value.length;
    html += decoder.decode(value, { stream: true });
    if (size > 1_500_000) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return NextResponse.json({ ok: true, contacts: extractContacts(html) });
}
