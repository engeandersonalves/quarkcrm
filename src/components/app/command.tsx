"use client";

import { CheckSquare, CornerDownLeft, FileText, LayoutDashboard, ListTodo, PlugZap, Search, Settings, Sun, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { productOf } from "@/lib/constants";
import { formatPhone, onlyDigits } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal } from "@/lib/types";
import { cx } from "../ui";

interface Item {
  id: string;
  group: "Ações" | "Leads" | "Propostas" | "Ir para";
  label: string;
  sub?: string;
  icon: ReactNode;
  keywords: string;
  run: () => void;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Busca global (Ctrl/⌘ + K): leads, propostas, páginas e ações rápidas. */
export function CommandPalette({ open, onClose, onNewLead, onNewTask }: { open: boolean; onClose: () => void; onNewLead: () => void; onNewTask: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data } = useLive(
    async () => {
      if (!open) return null;
      const sb = supabase();
      const [leads, proposals] = await Promise.all([
        sb.from("leads").select("id,name,phone,city,email,status").order("created_at", { ascending: false }).limit(2000),
        sb.from("proposals").select("id,number,title,final_price,inputs->product,lead:leads(name)").order("created_at", { ascending: false }).limit(2000),
      ]);
      return {
        leads: must(leads) as Pick<Lead, "id" | "name" | "phone" | "city" | "email" | "status">[],
        proposals: must(proposals) as unknown as (Pick<Proposal, "id" | "number" | "title" | "final_price"> & { product: string | null; lead: { name: string } | null })[],
      };
    },
    [open],
    [],
  );

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const actions: Item[] = [
      { id: "a-lead", group: "Ações", label: "Novo lead", icon: <UserPlus className="h-4 w-4" />, keywords: "novo lead cliente cadastrar", run: onNewLead },
      { id: "a-solar", group: "Ações", label: "Novo orçamento solar", icon: <Sun className="h-4 w-4" />, keywords: "novo orcamento proposta solar", run: go("/propostas/nova") },
      { id: "a-save", group: "Ações", label: "Novo orçamento S.A.V.E", icon: <PlugZap className="h-4 w-4" />, keywords: "novo orcamento proposta save carregador veicular", run: go("/propostas/nova?tipo=save") },
      { id: "a-task", group: "Ações", label: "Nova tarefa", icon: <ListTodo className="h-4 w-4" />, keywords: "nova tarefa follow up lembrete", run: onNewTask },
    ];
    const pages: Item[] = [
      { id: "p-home", group: "Ir para", label: "Painel", icon: <LayoutDashboard className="h-4 w-4" />, keywords: "painel inicio dashboard", run: go("/") },
      { id: "p-leads", group: "Ir para", label: "Leads", icon: <Users className="h-4 w-4" />, keywords: "leads funil kanban clientes", run: go("/leads") },
      { id: "p-props", group: "Ir para", label: "Propostas", icon: <FileText className="h-4 w-4" />, keywords: "propostas orcamentos", run: go("/propostas") },
      { id: "p-tasks", group: "Ir para", label: "Tarefas", icon: <CheckSquare className="h-4 w-4" />, keywords: "tarefas agenda", run: go("/tarefas") },
      { id: "p-cfg", group: "Ir para", label: "Configurações", icon: <Settings className="h-4 w-4" />, keywords: "configuracoes ajustes empresa kits", run: go("/configuracoes") },
    ];
    const leads: Item[] = (data?.leads ?? []).map((l) => ({
      id: `l-${l.id}`,
      group: "Leads",
      label: l.name,
      sub: [l.city, formatPhone(l.phone)].filter(Boolean).join(" · "),
      icon: <Users className="h-4 w-4" />,
      keywords: `${l.name} ${l.city ?? ""} ${l.email ?? ""} ${onlyDigits(l.phone)}`,
      run: go(`/leads/${l.id}`),
    }));
    const proposals: Item[] = (data?.proposals ?? []).map((p) => {
      const save = productOf({ product: p.product }) === "save";
      return {
        id: `p-${p.id}`,
        group: "Propostas",
        label: `${save ? "S.A.V.E" : "Proposta"} #${p.number} · ${p.lead?.name ?? "Sem cliente"}`,
        sub: [p.title, brl(Number(p.final_price), 0)].filter(Boolean).join(" · "),
        icon: save ? <PlugZap className="h-4 w-4" /> : <FileText className="h-4 w-4" />,
        keywords: `${p.number} #${p.number} ${p.lead?.name ?? ""} ${p.title ?? ""} ${save ? "save carregador" : "solar"}`,
        run: go(`/propostas/${p.id}`),
      };
    });
    const term = norm(q.trim());
    const digits = onlyDigits(q);
    const match = (it: Item) => {
      if (!term) return true;
      const k = norm(`${it.label} ${it.keywords}`);
      return term.split(/\s+/).every((w) => k.includes(w)) || (digits.length >= 4 && k.includes(digits));
    };
    if (!term) return [...actions, ...pages, ...leads.slice(0, 5), ...proposals.slice(0, 5)];
    return [...actions.filter(match), ...leads.filter(match).slice(0, 8), ...proposals.filter(match).slice(0, 8), ...pages.filter(match)];
  }, [data, q, router, onNewLead, onNewTask]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (it?: Item) => {
    if (!it) return;
    onClose();
    it.run();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(items[active]);
    } else if (e.key === "Escape") onClose();
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="animate-fade-up relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink-200">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4">
          <Search className="h-5 w-5 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar cliente, telefone, nº da proposta ou ação…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400"
          />
          <kbd className="hidden rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500 sm:block">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="px-3 py-10 text-center text-sm text-ink-500">Nada encontrado para “{q}”.</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{header}</p>}
                <button
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(it)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === active ? "bg-sun-50 text-ink-900" : "text-ink-700")}
                >
                  <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", i === active ? "bg-sun-gradient text-ink-900" : "bg-ink-100 text-ink-500")}>{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.label}</span>
                    {it.sub && <span className="block truncate text-xs text-ink-500">{it.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="h-4 w-4 shrink-0 text-ink-400" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hidden items-center gap-4 border-t border-ink-100 px-4 py-2.5 text-[11px] text-ink-400 sm:flex">
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          <span className="ml-auto">Ctrl/⌘ + K em qualquer tela</span>
        </div>
      </div>
    </div>
  );
}
