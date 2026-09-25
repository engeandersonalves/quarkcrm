"use client";

import { CheckSquare, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { useQuick } from "@/components/app/shell";
import { TaskRow } from "@/components/app/task-row";
import { Button, Card, Empty, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { must, useLive } from "@/lib/live";
import { Mantra } from "@/components/app/mantra";
import { supabase } from "@/lib/supabase/client";
import type { Task } from "@/lib/types";

export default function TasksPage() {
  const { user } = useApp();
  const { openTask } = useQuick();
  const [scope, setScope] = useState<"minhas" | "todas">("minhas");
  const [showDone, setShowDone] = useState(false);

  const { data, loading } = useLive(
    async () => must(await supabase().from("tasks").select("*, lead:leads(id,name)").order("due_at", { ascending: true, nullsFirst: false }).limit(1000)) as Task[],
    [],
    ["tasks"],
  );

  const groups = useMemo(() => {
    const rows = (data ?? []).filter((t) => scope === "todas" || t.assigned_to === user.id || (!t.assigned_to && t.created_by === user.id));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const week = new Date(start);
    week.setDate(week.getDate() + 7);
    const open = rows.filter((t) => !t.done);
    const at = (t: Task) => (t.due_at ? new Date(t.due_at) : null);
    return [
      { key: "late", title: "Atrasadas", tone: "text-rose-600", items: open.filter((t) => at(t) && at(t)! < new Date() ) },
      { key: "today", title: "Hoje", tone: "text-ink-900", items: open.filter((t) => at(t) && at(t)! >= new Date() && at(t)! < end) },
      { key: "week", title: "Próximos 7 dias", tone: "text-ink-900", items: open.filter((t) => at(t) && at(t)! >= end && at(t)! < week) },
      { key: "later", title: "Mais tarde", tone: "text-ink-900", items: open.filter((t) => at(t) && at(t)! >= week) },
      { key: "nodate", title: "Sem data", tone: "text-ink-900", items: open.filter((t) => !at(t)) },
      ...(showDone ? [{ key: "done", title: "Concluídas", tone: "text-emerald-700", items: rows.filter((t) => t.done).reverse().slice(0, 50) }] : []),
    ].filter((g) => g.items.length);
  }, [data, scope, showDone, user.id]);

  const pending = (data ?? []).filter((t) => !t.done && (scope === "todas" || t.assigned_to === user.id)).length;

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <PageHeader
        title="Tarefas"
        subtitle={`${pending} pendente${pending === 1 ? "" : "s"} · o responsável recebe um alerta por e-mail`}
        actions={
          <Button onClick={() => openTask()}>
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        }
      />
      <Mantra seed={21} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "minhas", label: "Minhas" },
            { value: "todas", label: "Toda a equipe" },
          ]}
        />
        <button onClick={() => setShowDone((v) => !v)} className="text-[13px] font-semibold text-ink-500 hover:text-ink-900">
          {showDone ? "Ocultar concluídas" : "Mostrar concluídas"}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : !groups.length ? (
        <Card>
          <Empty icon={<CheckSquare className="h-6 w-6" />} title="Tudo em dia! 🎉" text="Nenhuma tarefa pendente. Que tal agendar o próximo follow-up?" action={<Button onClick={() => openTask()}>Criar tarefa</Button>} />
        </Card>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className={cx("mb-2 flex items-center gap-2 px-1 text-[13px] font-bold tracking-wide uppercase", g.tone)}>
                {g.title}
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">{g.items.length}</span>
              </h2>
              <Card className="p-1.5">
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
