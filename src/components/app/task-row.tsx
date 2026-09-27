"use client";

import { AlertCircle, CalendarPlus, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { TASK_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Task } from "@/lib/types";
import { useQuick } from "./shell";
import { useReward } from "./rewards";
import { cx } from "../ui";

export function TaskRow({ task, showLead = true }: { task: Task; showLead?: boolean }) {
  const { openTask } = useQuick();
  const { reward } = useReward();
  const overdue = !task.done && task.due_at && new Date(task.due_at) < new Date();
  const toggle = async () => {
    const { error } = await supabase()
      .from("tasks")
      .update({ done: !task.done, done_at: task.done ? null : new Date().toISOString() })
      .eq("id", task.id);
    if (error) toast.error(error.message);
    else if (!task.done) {
      toast.success("Tarefa concluída ✓");
      reward("tarefa", task.id);
    }
  };
  return (
    <div className="group flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50">
      <button onClick={toggle} className="mt-0.5 shrink-0 text-ink-300 transition hover:text-emerald-600" aria-label={task.done ? "Reabrir" : "Concluir"}>
        {task.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
      </button>
      <button onClick={() => openTask({ task })} className="min-w-0 flex-1 text-left">
        <p className={cx("truncate text-sm font-medium", task.done ? "text-ink-400 line-through" : "text-ink-900")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          <span className={cx(overdue && "font-semibold text-rose-600")}>
            {overdue && <AlertCircle className="mr-0.5 inline h-3 w-3" />}
            {task.due_at ? formatDateTime(task.due_at) : "Sem data"}
          </span>
          <span>· {TASK_TYPES[task.type]}</span>
          {showLead && task.lead && <span className="truncate">· {task.lead.name}</span>}
          {task.priority === "alta" && <span className="font-semibold text-rose-600">· Alta</span>}
        </p>
      </button>
      {task.due_at && !task.done && (
        <a
          href={googleCalendarUrl(task)}
          target="_blank"
          rel="noreferrer"
          title="Adicionar ao Google Agenda"
          aria-label="Adicionar ao Google Agenda"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-400 transition hover:bg-white hover:text-ink-900 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <CalendarPlus className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

/** Link "adicionar evento" do Google Agenda (30 min a partir do horário da tarefa). */
function googleCalendarUrl(task: Task) {
  const start = new Date(task.due_at!);
  const end = new Date(start.getTime() + 30 * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const details = [TASK_TYPES[task.type], task.lead?.name && `Cliente: ${task.lead.name}`, task.description].filter(Boolean).join("\n");
  const q = new URLSearchParams({ action: "TEMPLATE", text: task.title, dates: `${f(start)}/${f(end)}`, details });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
