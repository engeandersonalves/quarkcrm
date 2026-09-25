import { NextResponse } from "next/server";
import { captureEmailContent, sanitizeSim } from "@/lib/capture-email-content";
import { clientWelcomeEmail, type Company } from "@/lib/client-email";
import { sendEmail } from "@/lib/email";
import { notifyNewLead } from "@/lib/notifications";
import { quickEstimate } from "@/lib/quick-estimate";
import { adminSupabase, anonSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, string | number> | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // Anti-spam: campo invisível preenchido ou formulário enviado rápido demais = robô.
  if (body.website || (typeof body.elapsed === "number" && body.elapsed < 2500)) return NextResponse.json({ ok: true });
  const sim = sanitizeSim((body as Record<string, unknown>).sim);
  delete body.website;
  delete body.elapsed;
  delete (body as Record<string, unknown>).sim;

  const anon = anonSupabase();
  const { data: lead, error } = await anon.rpc("create_public_lead", { p: body });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (lead?.duplicate) return NextResponse.json({ ok: true });

  // Destinatários da configuração exigem service role; sem ela, usa NOTIFY_EMAILS.
  const admin = adminSupabase();
  await notifyNewLead(admin ?? anon, lead, admin ? undefined : "").catch(() => {});

  // E-mail de boas-vindas ao cliente: estudo + autoridade + próximo passo.
  if (lead?.email) {
    const { data: company } = await anon.rpc("get_public_company");
    const c = (company ?? {}) as Company & { tariff?: number; sunHours?: number; fioBTariff?: number; publicLighting?: number };
    const bill = Number(body.avg_bill) || 0;
    const estimate =
      bill > 0
        ? quickEstimate({
            bill,
            connectionType: lead.connection_type ?? undefined,
            tariff: Number(c.tariff) || undefined,
            sunHours: Number(c.sunHours) || undefined,
            fioBTariff: c.fioBTariff != null ? Number(c.fioBTariff) : undefined,
            publicLighting: c.publicLighting != null ? Number(c.publicLighting) : undefined,
          })
        : null;
    const segment = lead.segment ?? "solar";
    const custom = captureEmailContent(segment, sim, Number(c.tariff) || 0.95, Number(c.sunHours) || 5.2);
    const { subject, html } = clientWelcomeEmail({ origin: new URL(req.url).origin, name: lead.name, segment, estimate, company: c, custom });
    await sendEmail({ to: [lead.email], subject, html }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
