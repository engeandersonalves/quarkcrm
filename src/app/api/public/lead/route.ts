import { NextResponse } from "next/server";
import { notifyNewLead } from "@/lib/notifications";
import { adminSupabase, anonSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // honeypot anti-spam: bots preenchem o campo invisível
  if (body.website) return NextResponse.json({ ok: true });

  const anon = anonSupabase();
  const { data: lead, error } = await anon.rpc("create_public_lead", { p: body });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Destinatários da configuração exigem service role; sem ela, usa NOTIFY_EMAILS.
  const admin = adminSupabase();
  await notifyNewLead(admin ?? anon, lead, admin ? undefined : "").catch(() => {});
  return NextResponse.json({ ok: true });
}
