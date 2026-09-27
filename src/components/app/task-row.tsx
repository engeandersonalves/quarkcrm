"use client";

import { AlertCircle, CalendarPlus, CheckCircle2, ChevronDown, Circle, Copy, FileSignature, Mail, MessageCircle, Paperclip, Phone, Sparkles, Calculator, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { renderCopy } from "@/lib/cadence";
import { TASK_TYPES, stageOf } from "@/lib/constants";
import { formatDateTime, whatsappUrl } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Task } from "@/lib/types";
import { useApp } from "./app-context";
import { useQuick } from "./shell";
import { useReward } from "./rewards";
import { cx } from "../ui";

type LeadInfo = NonNullable<Task["lead"]>;

export function TaskRow({ task, showLead = true, lead: leadProp }: { task: Task; showLead?: boolean; lead?: LeadInfo | null }) {
  const { openTask } = useQuick();
  const { reward } = useReward();
  const { user, profile, settings } = useApp();
  const [open, setOpen] = useState(false);
  const [attached, setAttached] = useState<string[]>([]);
  const lead = task.lead ?? leadProp ?? null;
  const overdue = !task.done && task.due_at && new Date(task.due_at) < new Date();
  const materials = settings.cadence.materials.filter((m) => m.url.trim());

  const text = task.copy
    ? renderCopy(task.copy, { name: lead?.name, seller: profile?.full_name, company: settings.company_name, segment: lead?.segment, city: lead?.city }) +
      materials
        .filter((m) => attached.includes(m.url))
        .map((m) => `\n\n${m.title}: ${m.url}`)
        .join("")
    : "";

  const setDone = async (done: boolean, silent = false) => {
    const { error } = await supabase()
      .from("tasks")
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    if (done) {
      if (!silent) toast.success("Tarefa concluída ✓");
      reward("tarefa", task.id);
    }
  };

  const logActivity = (type: string, content: string) => {
    if (!task.lead_id) return;
    supabase()
      .from("activities")
      .insert({ lead_id: task.lead_id, type, content, created_by: user.id })
      .select("id")
      .single()
      .then(({ data }: { data: { id: string } | null }) => reward("followup", data?.id));
  };

  const sendWhatsApp = () => {
    window.open(whatsappUrl(lead?.phone, text), "_blank", "noopener");
    logActivity("whatsapp", `Mensagem enviada: ${task.title}`);
    if (!task.done) {
      setDone(true, true);
      toast.success("Mensagem aberta no WhatsApp e tarefa concluída", { action: { label: "Desfazer", onClick: () => setDone(false) } });
    }
  };

  const sendEmail = () => {
    const m = text.match(/^Assunto:\s*(.+)\n+/);
    const subject = m ? m[1] : task.title;
    const body = m ? text.slice(m[0].length) : text;
    window.location.href = `mailto:${lead?.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    logActivity("email", `E-mail enviado: ${task.title}`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Mensagem copiada");
  };

  return (
    <div className={cx("group rounded-xl transition", open ? "bg-ink-50" : "hover:bg-ink-50")}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button onClick={() => setDone(!task.done)} className="mt-0.5 shrink-0 text-ink-300 transition hover:text-emerald-600" aria-label={task.done ? "Reabrir" : "Concluir"}>
          {task.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
        </button>
        <button onClick={() => openTask({ task })} className="min-w-0 flex-1 text-left">
          <p className={cx("truncate text-sm font-medium", task.done ? "text-ink-400 line-through" : "text-ink-900")}>{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
            <span className={cx(overdue && "font-semibold text-rose-600")}>
              {overdue && <AlertCircle className="mr-0.5 inline h-3 w-3" />}
              {task.due_at ? formatDateTime(task.due_at) : "Sem data"}
            </span>
            <span>· {TASK_TYPES[task.type]}</span>
            {showLead && lead && <span className="truncate">· {lead.name}</span>}
            {task.priority === "alta" && <span className="font-semibold text-rose-600">· Alta</span>}
            {task.cadence && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-ink-900 px-1.5 py-px text-[10px] font-semibold text-brand-yellow" title="Criada automaticamente pela cadência">
                <Zap className="h-2.5 w-2.5" /> {stageOf(task.cadence).label}
              </span>
            )}
          </p>
        </button>
        {task.copy && !task.done && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={cx(
              "mt-0.5 flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition",
              open ? "bg-white text-ink-900 ring-1 ring-ink-200" : "bg-sun-50 text-sun-700 ring-1 ring-sun-200/70 hover:bg-sun-100",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{task.type === "ligacao" || task.type === "tarefa" ? "Roteiro" : "Mensagem"}</span>
            <ChevronDown className={cx("h-3.5 w-3.5 transition", open && "rotate-180")} />
          </button>
        )}
        {task.due_at && !task.done && (
          <a
            href={googleCalendarUrl(task, lead?.name)}
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

      {open && task.copy && (
        <div className="animate-fade-up px-3 pb-3 sm:pl-11">
          <div className="relative rounded-2xl rounded-tl-md bg-white p-3.5 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-800 shadow-soft ring-1 ring-ink-200/70">{text}</div>
          {materials.length > 0 && (task.type === "whatsapp" || task.type === "email" || task.type === "tarefa") && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-500">
                <Paperclip className="h-3 w-3" /> Anexar:
              </span>
              {materials.map((m) => {
                const on = attached.includes(m.url);
                return (
                  <button
                    key={m.url}
                    onClick={() => setAttached((a) => (on ? a.filter((x) => x !== m.url) : [...a, m.url]))}
                    className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition", on ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300")}
                  >
                    {m.title}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {lead?.phone && task.type !== "email" && (
              <button onClick={sendWhatsApp} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[13px] font-semibold text-white shadow-soft hover:bg-emerald-700">
                <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
              </button>
            )}
            {lead?.phone && task.type === "ligacao" && (
              <a href={`tel:${lead.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink-900 px-3 text-[13px] font-semibold text-white hover:bg-ink-800">
                <Phone className="h-4 w-4" /> Ligar
              </a>
            )}
            {(task.type === "email" || lead?.email) && (
              <button onClick={sendEmail} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-semibold text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50">
                <Mail className="h-4 w-4" /> E-mail
              </button>
            )}
            <button onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-semibold text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50">
              <Copy className="h-4 w-4" /> Copiar
            </button>
            {task.action === "procuracao" && task.lead_id && (
              <Link href={`/documentos/novo?tipo=procuracao&lead=${task.lead_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-sun-gradient px-3 text-[13px] font-semibold text-ink-950 shadow-glow">
                <FileSignature className="h-4 w-4" /> Gerar procuração
              </Link>
            )}
            {task.action === "proposta" && task.lead_id && (
              <Link href={`/propostas/nova?lead=${task.lead_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-sun-gradient px-3 text-[13px] font-semibold text-ink-950 shadow-glow">
                <Calculator className="h-4 w-4" /> Criar proposta
              </Link>
            )}
            <button onClick={() => setDone(true)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50">
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Link "adicionar evento" do Google Agenda (30 min a partir do horário da tarefa). */
function googleCalendarUrl(task: Task, leadName?: string | null) {
  const start = new Date(task.due_at!);
  const end = new Date(start.getTime() + 30 * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const details = [TASK_TYPES[task.type], leadName && `Cliente: ${leadName}`, task.description].filter(Boolean).join("\n");
  const q = new URLSearchParams({ action: "TEMPLATE", text: task.title, dates: `${f(start)}/${f(end)}`, details });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
