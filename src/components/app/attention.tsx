"use client";

import { AlarmClock, BellRing, ChevronRight, EyeOff, FileSignature, Hourglass, KeyRound, Route, UserRoundX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { computeAlerts, type AlertKind } from "@/lib/alerts";
import type { DocumentRow, Lead, Proposal, Task } from "@/lib/types";
import { Card, CardHeader } from "../ui";

export const ALERT_STYLE: Record<AlertKind, { icon: ReactNode; tone: string }> = {
  viewed: { icon: <BellRing className="h-4 w-4" />, tone: "bg-sun-100 text-sun-700" },
  unopened: { icon: <EyeOff className="h-4 w-4" />, tone: "bg-ink-100 text-ink-600" },
  expiring: { icon: <Hourglass className="h-4 w-4" />, tone: "bg-rose-50 text-rose-700" },
  "no-contact": { icon: <UserRoundX className="h-4 w-4" />, tone: "bg-violet-50 text-violet-700" },
  "no-next-step": { icon: <Route className="h-4 w-4" />, tone: "bg-amber-50 text-amber-700" },
  overdue: { icon: <AlarmClock className="h-4 w-4" />, tone: "bg-rose-50 text-rose-700" },
  signature: { icon: <FileSignature className="h-4 w-4" />, tone: "bg-sky-50 text-sky-700" },
  procuracao: { icon: <KeyRound className="h-4 w-4" />, tone: "bg-ink-900 text-brand-yellow" },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Oportunidades que podem esfriar: o que fazer agora para não perder vendas. */
export function AttentionCard({ leads, proposals, tasks, documents }: { leads: Lead[]; proposals: Proposal[]; tasks: Task[]; documents?: DocumentRow[] }) {
  const alerts = computeAlerts({ leads, proposals, tasks, documents });
  if (!alerts.length) return null;
  const top = alerts.slice(0, 6);

  return (
    <Card className="mt-5">
      <CardHeader
        title="Precisa de atenção"
        subtitle={`${plural(alerts.length, "oportunidade pode esfriar", "oportunidades podem esfriar")} — resolva em poucos cliques`}
        action={
          <Link href="/tarefas" className="text-[13px] font-semibold text-sun-700 hover:underline">
            Central de follow-up
          </Link>
        }
      />
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-3">
        {top.map((a) => (
          <Link key={a.id} href={a.href} className="group flex items-start gap-3 rounded-xl p-3 ring-1 ring-ink-200/70 transition hover:bg-ink-50 hover:ring-ink-300">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${ALERT_STYLE[a.kind].tone}`}>{ALERT_STYLE[a.kind].icon}</span>
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
