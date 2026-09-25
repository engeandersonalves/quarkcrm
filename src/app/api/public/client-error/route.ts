import { NextResponse } from "next/server";

/** Registra nos logs da Vercel erros que acontecem no navegador dos clientes (página de captura). */
export async function POST(req: Request) {
  const body = await req.text().catch(() => "");
  console.error("[client-error]", body.slice(0, 3000));
  return NextResponse.json({ ok: true });
}
