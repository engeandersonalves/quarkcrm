"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import { must, notify, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Priority, Task, TaskType } from "@/lib/types";
import { useApp } from "./app-context";
import { Button, Field, Input, Modal, Segmented, Select, Textarea } from "../ui";

function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function TaskFormModal({ open, onClose, task, leadId }: { open: boolean; onClose: () => void; task?: Task | null; leadId?: string | null }) {
  const { user, profiles } = useApp();
  const [form, setForm] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);

  const { data: leads } = useLive(
    async () => (open ? (must(await supabase().from("leads").select("id,name").order("name").limit(500)) as Pick<Lead, "id" | "name">[]) : []),
    [open],
    [],
  );

  useEffect(() => {
    if (!open) return;
    setForm(
      task
        ? { ...task }
        : { title: "", type: "ligacao", priority: "media", due_at: defaultDue(), lead_id: leadId ?? null, assigned_to: user.id, description: "" },
    );
  }, [open, task, leadId, user.id]);

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return toast.error("Descreva a tarefa");
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      priority: form.priority,
      due_at: form.due_at,
      lead_id: form.lead_id || null,
      assigned_to: form.assigned_to || null,
    };
    const sb = supabase();
    if (task?.id) {
      const { error } = await sb.from("tasks").update(payload).eq("id", task.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Tarefa atualizada");
    } else {
      const { data, error } = await sb.from("tasks").insert({ ...payload, created_by: user.id }).select("id").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Tarefa criada", { description: "O responsável foi avisado por e-mail." });
      notify("task", data.id);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Editar tarefa" : "Nova tarefa"}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button form="task-form" type="submit" loading={saving}>
            {task ? "Salvar" : "Criar tarefa"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={save} className="grid gap-4">
        <Field label="O que precisa ser feito? *">
          <Input autoFocus value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Ligar para apresentar a proposta" />
        </Field>
        <Field label="Tipo">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TASK_TYPES) as TaskType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => set("type", t)}
                className={`h-8 rounded-lg px-3 text-[13px] font-semibold ring-1 transition ${form.type === t ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300"}`}
              >
                {TASK_TYPES[t]}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data e hora">
            <Input type="datetime-local" value={toLocalInput(form.due_at)} onChange={(e) => set("due_at", fromLocalInput(e.target.value))} />
          </Field>
          <Field label="Prioridade">
            <Segmented
              className="w-full [&>button]:flex-1"
              value={(form.priority ?? "media") as Priority}
              onChange={(v) => set("priority", v)}
              options={(Object.keys(PRIORITIES) as Priority[]).map((p) => ({ value: p, label: PRIORITIES[p].label }))}
            />
          </Field>
          <Field label="Lead">
            <Select value={form.lead_id ?? ""} onChange={(e) => set("lead_id", e.target.value || null)}>
              <option value="">Sem lead vinculado</option>
              {(leads ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={form.assigned_to ?? ""} onChange={(e) => set("assigned_to", e.target.value || null)}>
              <option value="">—</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Detalhes">
          <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
