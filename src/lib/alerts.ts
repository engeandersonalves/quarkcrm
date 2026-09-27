import type { DocumentRow, Lead, Proposal, Task, TaskType } from "./types.ts";

const DAY = 86400000;
const daysSince = (iso: string | null | undefined, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type AlertKind = "viewed" | "unopened" | "expiring" | "no-contact" | "no-next-step" | "overdue" | "signature" | "procuracao";

export interface SmartAlert {
  id: string;
  kind: AlertKind;
  href: string;
  title: string;
  text: string;
  weight: number;
  leadId?: string;
  /** Tarefa sugerida para resolver com um clique (com mensagem pronta). */
  suggest?: { title: string; type: TaskType; copy: string };
  /** Atalho para outra tela (ex.: gerar a procuração). */
  cta?: { label: string; href: string };
}

const OPEN = ["novo", "contato", "visita", "proposta", "negociacao"];

/**
 * Oportunidades que podem esfriar e pendências do pós-venda, em ordem de urgência.
 * Usado no painel ("Precisa de atenção") e na central de tarefas.
 */
export function computeAlerts(
  { leads, proposals, tasks, documents = [] }: { leads: Lead[]; proposals: Proposal[]; tasks: Task[]; documents?: DocumentRow[] },
  now = Date.now(),
): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  for (const p of proposals) {
    const name = p.lead?.name ?? "Cliente";
    if (p.status === "visualizada" && daysSince(p.viewed_at, now) >= 2) {
      const d = daysSince(p.viewed_at, now);
      alerts.push({
        id: `v-${p.id}`,
        kind: "viewed",
        href: `/leads/${p.lead_id}`,
        leadId: p.lead_id,
        title: `${name} viu a proposta #${p.number}`,
        text: `Há ${plural(d, "dia", "dias")}, sem resposta. Hora de um follow-up.`,
        weight: 3 + d,
        suggest: {
          title: `Follow-up da proposta #${p.number}`,
          type: "whatsapp",
          copy: "{nome}, vi que você abriu a proposta 😊 Ficou alguma dúvida? Posso te explicar em 5 minutinhos por chamada, ou simular outra forma de pagamento.",
        },
      });
    }
    if (p.status === "enviada" && daysSince(p.sent_at, now) >= 3) {
      const d = daysSince(p.sent_at, now);
      alerts.push({
        id: `e-${p.id}`,
        kind: "unopened",
        href: `/leads/${p.lead_id}`,
        leadId: p.lead_id,
        title: `Proposta #${p.number} não foi aberta`,
        text: `Enviada para ${name} há ${plural(d, "dia", "dias")}. Confirme se o link chegou.`,
        weight: 2 + d / 2,
        suggest: { title: `Confirmar recebimento da proposta #${p.number}`, type: "ligacao", copy: "Ligue e pergunte: \"{nome}, conseguiu abrir a proposta que te enviei? Posso te mostrar agora rapidinho?\"" },
      });
    }
    if ((p.status === "enviada" || p.status === "visualizada") && p.valid_until) {
      const left = Math.ceil((new Date(`${p.valid_until}T23:59:59`).getTime() - now) / DAY);
      if (left >= 0 && left <= 2)
        alerts.push({
          id: `x-${p.id}`,
          kind: "expiring",
          href: `/propostas/${p.id}`,
          leadId: p.lead_id,
          title: `Proposta #${p.number} vence ${left === 0 ? "hoje" : `em ${plural(left, "dia", "dias")}`}`,
          text: `${name} · use a validade como gatilho para fechar.`,
          weight: 6 - left,
          suggest: {
            title: `Gatilho de validade da proposta #${p.number}`,
            type: "whatsapp",
            copy: "{nome}, passando para avisar que a condição da sua proposta vale só até {prazo}. Quer que eu garanta esse valor para você?".replace("{prazo}", left === 0 ? "hoje" : "amanhã"),
          },
        });
    }
  }

  const openTaskLeads = new Set(tasks.filter((t) => !t.done && t.lead_id).map((t) => t.lead_id));
  for (const l of leads) {
    if (l.status === "novo" && daysSince(l.created_at, now) >= 1) {
      const d = daysSince(l.created_at, now);
      alerts.push({
        id: `l-${l.id}`,
        kind: "no-contact",
        href: `/leads/${l.id}`,
        leadId: l.id,
        title: `${l.name} ainda sem contato`,
        text: `Lead novo há ${plural(d, "dia", "dias")}. Quem responde primeiro vende mais.`,
        weight: 4 + d,
        suggest: { title: "Primeiro contato", type: "whatsapp", copy: "Olá, {nome}! Aqui é {vendedor}, da {empresa} ☀️ Recebi seu interesse em {interesse}. Posso te fazer 3 perguntinhas rápidas para calcular a sua economia?" },
      });
    } else if (OPEN.includes(l.status) && !openTaskLeads.has(l.id) && daysSince(l.updated_at, now) >= 3) {
      const d = daysSince(l.updated_at, now);
      alerts.push({
        id: `n-${l.id}`,
        kind: "no-next-step",
        href: `/leads/${l.id}`,
        leadId: l.id,
        title: `${l.name} está sem próximo passo`,
        text: `Parado há ${plural(d, "dia", "dias")} sem nenhuma tarefa agendada.`,
        weight: 2.5 + d / 3,
        suggest: { title: "Retomar contato", type: "whatsapp", copy: "Oi, {nome}! Tudo bem? Passando para saber se ainda posso te ajudar com {interesse}. Tenho novidades nas condições de pagamento 😉" },
      });
    }
  }

  // Pós-venda: cliente fechado nos últimos 30 dias sem procuração.
  const withProc = new Set(documents.filter((d) => d.kind === "procuracao" && d.status !== "cancelado").map((d) => d.lead_id));
  for (const l of leads) {
    if (l.status === "ganho" && daysSince(l.updated_at, now) <= 30 && !withProc.has(l.id) && ["solar", "ambos", "gestao"].includes(l.segment ?? "solar")) {
      alerts.push({
        id: `p-${l.id}`,
        kind: "procuracao",
        href: `/leads/${l.id}`,
        leadId: l.id,
        title: `Gerar procuração de ${l.name}`,
        text: "Venda fechada: a procuração libera o projeto na Equatorial.",
        weight: 5,
        cta: { label: "Gerar procuração", href: `/documentos/novo?tipo=procuracao&lead=${l.id}` },
      });
    }
  }

  for (const d of documents) {
    if (d.status !== "enviado") continue;
    const pending = (d.signers ?? []).filter((s) => !s.signed_at);
    const age = daysSince(d.updated_at, now);
    if (!pending.length || age < 2) continue;
    alerts.push({
      id: `s-${d.id}`,
      kind: "signature",
      href: `/documentos/${d.id}`,
      leadId: d.lead_id ?? undefined,
      title: `Assinatura pendente: ${pending.map((s) => s.name.split(" ")[0]).join(", ")}`,
      text: `${d.title} · enviado há ${plural(age, "dia", "dias")}.`,
      weight: 3 + age / 2,
      cta: { label: "Reenviar link", href: `/documentos/${d.id}?enviar=1` },
    });
  }

  const overdue = tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() < now);
  if (overdue.length)
    alerts.push({
      id: "tasks",
      kind: "overdue",
      href: "/tarefas",
      title: plural(overdue.length, "tarefa atrasada", "tarefas atrasadas"),
      text: "Coloque a agenda em dia.",
      weight: 5 + overdue.length,
    });

  return alerts.sort((a, b) => b.weight - a.weight);
}
