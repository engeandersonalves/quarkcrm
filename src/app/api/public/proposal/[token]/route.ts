import { NextResponse } from "next/server";
import { appUrl, emailTemplate, recipientsFrom, sendEmail } from "@/lib/email";
import { brl } from "@/lib/pricing";
import { adminSupabase, anonSupabase, serverSupabase } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { action, name } = (await req.json().catch(() => ({}))) as { action?: string; name?: string };
  const anon = anonSupabase();

  if (action === "view") {
    // Visualizações de quem está logado (a própria equipe) não contam.
    const {
      data: { user },
    } = await (await serverSupabase()).auth.getUser();
    if (user) return NextResponse.json({ ok: true, skipped: true });
    const { data } = await anon.rpc("track_proposal_view", { p_token: token });
    if (data?.first_view) await alert(token, "view");
    return NextResponse.json({ ok: true });
  }

  if (action === "accept") {
    const { data, error } = await anon.rpc("accept_public_proposal", { p_token: token, p_name: String(name ?? "").slice(0, 120) });
    if (error || !data?.ok) return NextResponse.json({ ok: false }, { status: 400 });
    await alert(token, "accept", name);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}

async function alert(token: string, kind: "view" | "accept", name?: string) {
  try {
    const admin = adminSupabase();
    const { data } = await anonSupabase().rpc("get_public_proposal", { p_token: token });
    if (!data) return;
    let notify = "";
    if (admin) {
      const { data: s } = await admin.from("settings").select("data").eq("id", 1).maybeSingle();
      notify = s?.data?.notify_emails ?? "";
    }
    const to = recipientsFrom(notify, data.seller?.email);
    const p = data.proposal;
    await sendEmail({
      to,
      subject: kind === "accept" ? `🎉 Proposta #${p.number} ACEITA por ${data.lead.name}` : `👀 ${data.lead.name} abriu a proposta #${p.number}`,
      html: emailTemplate({
        eyebrow: kind === "accept" ? "Proposta aceita" : "Proposta visualizada",
        title: kind === "accept" ? `${data.lead.name} aceitou a proposta!` : `${data.lead.name} está vendo sua proposta agora`,
        intro:
          kind === "accept"
            ? "Hora de formalizar o contrato e agendar a vistoria técnica."
            : "Ótimo momento para um contato: o cliente acabou de abrir a proposta pela primeira vez.",
        rows: [
          ["Proposta", `#${p.number}`],
          ["Valor", brl(Number(p.final_price))],
          ["Potência", `${Number(p.power_kwp).toLocaleString("pt-BR")} kWp`],
          ["Aceito por", kind === "accept" ? name : null],
        ],
        cta: p.id ? { label: "Abrir orçamento", url: appUrl(`/propostas/${p.id}`) } : undefined,
      }),
    });
  } catch (e) {
    console.error("[proposal alert]", e);
  }
}
