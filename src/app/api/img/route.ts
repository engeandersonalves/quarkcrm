import { NextResponse } from "next/server";
import { isProxyHost } from "@/lib/product-images";

/**
 * Proxy de imagens de equipamentos (só domínios da lista): a foto passa a vir do
 * mesmo endereço do app, então o PNG/PDF do orçamento sempre inclui a imagem.
 */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("u") ?? "";
  if (!isProxyHost(url)) return NextResponse.json({ error: "domínio não permitido" }, { status: 400 });
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 QuarkCRM" }, next: { revalidate: 86400 } }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return NextResponse.json({ error: "imagem indisponível" }, { status: 502 });
  const body = await res.arrayBuffer();
  if (body.byteLength > 8 * 1024 * 1024) return NextResponse.json({ error: "imagem muito grande" }, { status: 413 });
  return new NextResponse(body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
  });
}
