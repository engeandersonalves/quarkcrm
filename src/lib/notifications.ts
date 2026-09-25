import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEGMENTS, TASK_TYPES, stageOf } from "./constants";
import { appUrl, emailTemplate, recipientsFrom, sendEmail } from "./email";
import { formatPhone } from "./format";
import { brl, fmtNum } from "./pricing";
import type { Lead, Task } from "./types";

async function notifyList(sb: SupabaseClient) {
  const { data } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
  return (data?.data?.notify_emails as string | undefined) ?? "";
}

export async function notifyNewLead(sb: SupabaseClient, lead: Lead, notifyEmails?: string) {
  const to = recipientsFrom(notifyEmails ?? (await notifyList(sb)));
  return sendEmail({
    to,
    subject: `🔔 Novo lead: ${lead.name}${lead.city ? ` (${lead.city})` : ""}`,
    html: emailTemplate({
      eyebrow: "Novo lead",
      title: lead.name,
      intro: "Um novo lead acabou de chegar. Quanto mais rápido o primeiro contato, maior a chance de fechar!",
      rows: [
        ["Interesse", SEGMENTS[lead.segment ?? "solar"]?.label ?? null],
        ["Telefone", formatPhone(lead.phone)],
        ["E-mail", lead.email],
        ["Cidade", [lead.city, lead.state].filter(Boolean).join(" – ")],
        ["Origem", lead.source],
        ["Consumo médio", lead.consumption_kwh ? `${fmtNum(lead.consumption_kwh)} kWh/mês` : null],
        ["Conta média", lead.avg_bill ? brl(lead.avg_bill) : null],
        ["Telhado", lead.roof_type],
        ["Urgência", lead.temperature === "quente" ? "🔥 Quer instalar o quanto antes" : lead.temperature === "frio" ? "Pesquisando" : lead.temperature === "morno" ? "Próximos meses" : null],
        ["Etapa", stageOf(lead.status).label],
        ["Observações", lead.notes],
      ],
      cta: { label: "Abrir lead", url: appUrl(`/leads/${lead.id}`) },
    }),
  });
}

export async function notifyNewTask(sb: SupabaseClient, task: Task & { lead?: { name: string } | null }) {
  let assigneeEmail: string | null = null;
  let assigneeName: string | null = null;
  if (task.assigned_to) {
    const { data } = await sb.from("profiles").select("email, full_name").eq("id", task.assigned_to).maybeSingle();
    assigneeEmail = data?.email ?? null;
    assigneeName = data?.full_name ?? null;
  }
  const to = recipientsFrom(await notifyList(sb), assigneeEmail);
  const due = task.due_at
    ? new Date(task.due_at).toLocaleString("pt-BR", { timeZone: process.env.APP_TIMEZONE || "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" })
    : null;
  return sendEmail({
    to,
    subject: `✅ Nova tarefa: ${task.title}`,
    html: emailTemplate({
      eyebrow: `Nova tarefa · ${TASK_TYPES[task.type] ?? "Tarefa"}`,
      title: task.title,
      intro: task.description ?? undefined,
      rows: [
        ["Quando", due],
        ["Lead", task.lead?.name],
        ["Responsável", assigneeName],
        ["Prioridade", task.priority === "alta" ? "Alta" : task.priority === "baixa" ? "Baixa" : "Média"],
      ],
      cta: { label: "Ver tarefas", url: appUrl(task.lead_id ? `/leads/${task.lead_id}` : "/tarefas") },
    }),
  });
}
