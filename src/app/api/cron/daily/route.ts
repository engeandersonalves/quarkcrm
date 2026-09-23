import { NextResponse } from "next/server";
import { appUrl, emailTemplate, sendEmail } from "@/lib/email";
import { adminSupabase } from "@/lib/supabase/server";

/**
 * Resumo diário de tarefas (atrasadas + do dia) para cada responsável.
 * Agendado no vercel.json. Requer SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = adminSupabase();
  if (!sb) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY ausente" }, { status: 500 });

  const tz = process.env.APP_TIMEZONE || "America/Sao_Paulo";
  const endOfDay = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data: tasks, error } = await sb
    .from("tasks")
    .select("id, title, due_at, type, assigned_to, lead:leads(name), assignee:profiles!tasks_assigned_to_fkey(email, full_name)")
    .eq("done", false)
    .not("assigned_to", "is", null)
    .lte("due_at", endOfDay)
    .order("due_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { title: string; due_at: string; lead: { name: string } | null; assignee: { email: string; full_name: string | null } | null };
  const byUser = new Map<string, Row[]>();
  for (const t of (tasks ?? []) as unknown as Row[]) {
    const email = t.assignee?.email;
    if (!email) continue;
    byUser.set(email, [...(byUser.get(email) ?? []), t]);
  }

  let sent = 0;
  for (const [email, list] of byUser) {
    const late = list.filter((t) => new Date(t.due_at) < new Date()).length;
    await sendEmail({
      to: [email],
      subject: `☀️ Sua agenda: ${list.length} tarefa${list.length > 1 ? "s" : ""}${late ? ` (${late} atrasada${late > 1 ? "s" : ""})` : ""}`,
      html: emailTemplate({
        eyebrow: "Resumo do dia",
        title: `Bom dia${list[0].assignee?.full_name ? `, ${list[0].assignee.full_name.split(" ")[0]}` : ""}!`,
        intro: "Estas são as tarefas que precisam da sua atenção hoje:",
        rows: list.map((t) => [
          new Date(t.due_at).toLocaleString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + (new Date(t.due_at) < new Date() ? " ⚠️" : ""),
          `${t.title}${t.lead?.name ? ` — ${t.lead.name}` : ""}`,
        ]),
        cta: { label: "Abrir tarefas", url: appUrl("/tarefas") },
      }),
    });
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
