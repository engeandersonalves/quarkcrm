import { NextResponse } from "next/server";
import { appUrl, emailTemplate, sendEmail } from "@/lib/email";
import { serverSupabase } from "@/lib/supabase/server";

/** Envia por e-mail o link de assinatura de um documento (somente para a equipe logada). */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Faça login novamente" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: false, error: "Envio de e-mail não configurado (RESEND_API_KEY na Vercel)" }, { status: 400 });

  const { signerId } = (await req.json().catch(() => ({}))) as { signerId?: string };
  const { data: signer } = await sb
    .from("document_signers")
    .select("name, email, token, signed_at, document:documents(title, kind, status)")
    .eq("id", signerId ?? "")
    .maybeSingle();
  const doc = signer?.document as unknown as { title: string; kind: string; status: string } | null;
  if (!signer?.email || !doc) return NextResponse.json({ ok: false, error: "Assinante sem e-mail" }, { status: 400 });
  if (signer.signed_at || doc.status === "cancelado") return NextResponse.json({ ok: false, error: "Este documento não está aguardando assinatura" }, { status: 400 });

  const { data: settings } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
  const company = (settings?.data?.company_name as string) || "Quark Energia";
  const first = signer.name.split(/[\s(]/)[0];
  const result = await sendEmail({
    to: [signer.email],
    subject: `${first}, ${doc.kind === "procuracao" ? "sua procuração" : "seu contrato"} está pronto para assinar ✍️`,
    html: emailTemplate({
      eyebrow: "Assinatura eletrônica",
      title: `Olá, ${first}!`,
      intro: `A ${company} enviou um documento para você assinar. É só abrir, conferir e assinar com o dedo pelo celular — leva 1 minuto.`,
      rows: [["Documento", doc.title]],
      cta: { label: "Abrir e assinar", url: appUrl(`/assinar/${signer.token}`) },
    }),
  });
  if (!("ok" in result)) return NextResponse.json({ ok: false, error: "O provedor de e-mail recusou o envio" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
