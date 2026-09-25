"use client";

import { AlarmClock, BellRing, ChevronRight, EyeOff, Hourglass, UserRoundX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lead, Proposal, Task } from "@/lib/types";
import { Card, CardHeader } from "../ui";

const DAY = 86400000;
const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Alert {
  id: string;
  href: string;
  icon: ReactNode;
  tone: string;
  title: string;
  text: string;
  weight: number;
}

/** Oportunidades que podem esfriar: o que fazer agora para não perder vendas. */
export function AttentionCard({ leads, proposals, tasks }: { leads: Lead[]; proposals: Proposal[]; tasks: Task[] }) {
  const alerts: Alert[] = [];

  for (const p of proposals) {
    const name = p.lead?.name ?? "Cliente";
    if (p.status === "visualizada" && daysSince(p.viewed_at) >= 2) {
      const d = daysSince(p.viewed_at);
      alerts.push({ id: `v-${p.id}`, href: `/leads/${p.lead_id}`, icon: <BellRing className="h-4 w-4" />, tone: "bg-sun-100 text-sun-700", title: `${name} viu a proposta #${p.number}`, text: `Há ${plural(d, "dia", "dias")}, sem resposta. Hora de um follow-up.`, weight: 3 + d });
    }
    if (p.status === "enviada" && daysSince(p.sent_at) >= 3) {
      const d = daysSince(p.sent_at);
      alerts.push({ id: `e-${p.id}`, href: `/leads/${p.lead_id}`, icon: <EyeOff className="h-4 w-4" />, tone: "bg-ink-100 text-ink-600", title: `Proposta #${p.number} não foi aberta`, text: `Enviada para ${name} há ${plural(d, "dia", "dias")}. Confirme se o link chegou.`, weight: 2 + d / 2 });
    }
    if ((p.status === "enviada" || p.status === "visualizada") && p.valid_until) {
      const left = Math.ceil((new Date(`${p.valid_until}T23:59:59`).getTime() - Date.now()) / DAY);
      if (left >= 0 && left <= 2)
        alerts.push({ id: `x-${p.id}`, href: `/propostas/${p.id}`, icon: <Hourglass className="h-4 w-4" />, tone: "bg-rose-50 text-rose-700", title: `Proposta #${p.number} vence ${left === 0 ? "hoje" : `em ${plural(left, "dia", "dias")}`}`, text: `${name} · use a validade como gatilho para fechar.`, weight: 6 - left });
    }
  }
  for (const l of leads) {
    if (l.status === "novo" && daysSince(l.created_at) >= 1) {
      const d = daysSince(l.created_at);
      alerts.push({ id: `l-${l.id}`, href: `/leads/${l.id}`, icon: <UserRoundX className="h-4 w-4" />, tone: "bg-violet-50 text-violet-700", title: `${l.name} ainda sem contato`, text: `Lead novo há ${plural(d, "dia", "dias")}. Quem responde primeiro vende mais.`, weight: 4 + d });
    }
  }
  const overdue = tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() < Date.now());
  if (overdue.length)
    alerts.push({ id: "tasks", href: "/tarefas", icon: <AlarmClock className="h-4 w-4" />, tone: "bg-rose-50 text-rose-700", title: `${plural(overdue.length, "tarefa atrasada", "tarefas atrasadas")}`, text: "Coloque a agenda em dia.", weight: 5 + overdue.length });

  if (!alerts.length) return null;
  const top = alerts.sort((a, b) => b.weight - a.weight).slice(0, 6);

  return (
    <Card className="mt-5">
      <CardHeader title="Precisa de atenção" subtitle={`${plural(alerts.length, "oportunidade pode esfriar", "oportunidades podem esfriar")} — resolva em poucos cliques`} />
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-3">
        {top.map((a) => (
          <Link key={a.id} href={a.href} className="group flex items-start gap-3 rounded-xl p-3 ring-1 ring-ink-200/70 transition hover:bg-ink-50 hover:ring-ink-300">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${a.tone}`}>{a.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-900">{a.title}</span>
              <span className="line-clamp-2 text-xs text-ink-500">{a.text}</span>
            </span>
            <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-ink-300 group-hover:text-ink-500" />
          </Link>
        ))}
      </div>
    </Card>
  );
}
