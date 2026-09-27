import { NextResponse } from "next/server";
import { appUrl, emailTemplate, recipientsFrom, sendEmail } from "@/lib/email";
import { adminSupabase, anonSupabase, serverSupabase } from "@/lib/supabase/server";
import { fireWebhook } from "@/lib/webhooks";

interface Body {
  action?: string;
  name?: string;
  cpf?: string;
  signature?: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{16,64}$/.test(token)) return NextResponse.json({ ok: false }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const anon = anonSupabase();

  if (body.action === "view") {
    // A própria equipe abrindo o link não conta como visualização do cliente.
    const {
      data: { user },
    } = await (await serverSupabase()).auth.getUser();
    if (!user) await anon.rpc("view_public_document", { p_token: token });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "sign") {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
    const ua = req.headers.get("user-agent") ?? "";
    const { data, error } = await anon.rpc("sign_public_document", {
      p_token: token,
      p_name: String(body.name ?? "").slice(0, 160),
      p_cpf: String(body.cpf ?? "").slice(0, 20),
      p_signature: String(body.signature ?? ""),
      p_ip: ip.slice(0, 64),
      p_ua: ua.slice(0, 300),
    });
    if (error || !data?.ok) return NextResponse.json({ ok: false, error: data?.error ?? "erro" }, { status: 400 });
    await notify(token, String(body.name ?? ""), !!data.completed, data.document_id as string);
    return NextResponse.json({ ok: true, completed: !!data.completed });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}

async function notify(token: string, name: string, completed: boolean, documentId: string) {
  try {
    const anon = anonSupabase();
    const { data } = await anon.rpc("get_public_document", { p_token: token });
    if (!data?.document) return;
    let notifyList = "";
    const admin = adminSupabase();
    if (admin) {
      const { data: s } = await admin.from("settings").select("data").eq("id", 1).maybeSingle();
      notifyList = s?.data?.notify_emails ?? "";
    }
    const doc = data.document as { title: string; kind: string };
    const signers = (data.signers ?? []) as { name: string; signed_at: string | null }[];
    await sendEmail({
      to: recipientsFrom(notifyList, data.seller?.email),
      subject: completed ? `✅ ${doc.title}: todas as assinaturas concluídas` : `✍️ ${name} assinou ${doc.title}`,
      html: emailTemplate({
        eyebrow: completed ? "Documento assinado" : "Nova assinatura",
        title: completed ? "Documento 100% assinado!" : `${name} acabou de assinar`,
        intro: completed ? "Todas as partes assinaram. O documento com o registro das assinaturas já está disponível no app." : "Ainda faltam assinaturas. Acompanhe pelo app.",
        rows: [
          ["Documento", doc.title],
          ["Assinaturas", `${signers.filter((s) => s.signed_at).length} de ${signers.length}`],
        ],
        cta: { label: "Abrir documento", url: appUrl(`/documentos/${documentId}`) },
      }),
    });
    await fireWebhook(anon, "document.signed", { title: doc.title, kind: doc.kind, signed_by: name, completed });
  } catch (e) {
    console.error("[document alert]", e);
  }
}
