"use client";

import type { User } from "@supabase/supabase-js";
import { CheckSquare, FileText, LayoutDashboard, LogOut, Plus, Settings, Sun, UserPlus, Users, ListTodo, Calculator } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Task } from "@/lib/types";
import { AppProvider, useApp } from "./app-context";
import { LeadFormModal } from "./lead-form";
import { TaskFormModal } from "./task-form";
import { Avatar, cx } from "../ui";

const NAV = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/propostas", label: "Propostas", icon: FileText },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/configuracoes", label: "Ajustes", icon: Settings },
];

interface QuickCtx {
  openLead: (lead?: Lead | null, opts?: { onCreated?: (id: string) => void }) => void;
  openTask: (opts?: { task?: Task | null; leadId?: string | null }) => void;
}
const Quick = createContext<QuickCtx>({ openLead: () => {}, openTask: () => {} });
export const useQuick = () => useContext(Quick);

export function Shell({ user, children }: { user: User; children: ReactNode }) {
  return (
    <AppProvider user={user}>
      <ShellInner>{children}</ShellInner>
    </AppProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, settings } = useApp();
  const [leadModal, setLeadModal] = useState<{ open: boolean; lead?: Lead | null; onCreated?: (id: string) => void }>({ open: false });
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; leadId?: string | null }>({ open: false });
  const [fab, setFab] = useState(false);

  const openLead = useCallback(
    (lead?: Lead | null, opts?: { onCreated?: (id: string) => void }) => setLeadModal({ open: true, lead, onCreated: opts?.onCreated }),
    [],
  );
  const openTask = useCallback((o?: { task?: Task | null; leadId?: string | null }) => setTaskModal({ open: true, ...o }), []);

  useEffect(() => setFab(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const signOut = async () => {
    await supabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <Quick.Provider value={{ openLead, openTask }}>
      <div className="min-h-dvh lg:pl-[264px]">
        {/* Sidebar desktop */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-ink-950 text-ink-300 lg:flex">
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sun-500/15 blur-3xl" />
          <Link href="/" className="relative flex items-center gap-3 px-6 pt-7 pb-8">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sun-gradient shadow-glow">
              <Sun className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold text-white">{settings.company_name || "Quark"}</p>
              <p className="text-xs text-ink-500">CRM Solar</p>
            </div>
          </Link>

          <div className="relative px-4">
            <Link
              href="/propostas/nova"
              className="mb-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-sun-gradient text-sm font-semibold text-ink-950 shadow-glow transition hover:brightness-105"
            >
              <Calculator className="h-4 w-4" /> Novo orçamento
            </Link>
          </div>

          <nav className="relative flex flex-1 flex-col gap-1 px-3">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "group flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition",
                    active ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <item.icon className={cx("h-[18px] w-[18px]", active ? "text-sun-400" : "text-ink-500 group-hover:text-ink-300")} />
                  {item.label === "Ajustes" ? "Configurações" : item.label === "Início" ? "Painel" : item.label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sun-400" />}
                </Link>
              );
            })}
            <div className="my-4 h-px bg-white/[0.06]" />
            <button onClick={() => openLead()} className="flex h-10 items-center gap-3 rounded-xl px-3.5 text-sm text-ink-400 transition hover:bg-white/[0.04] hover:text-white">
              <UserPlus className="h-[18px] w-[18px]" /> Novo lead
            </button>
            <button onClick={() => openTask()} className="flex h-10 items-center gap-3 rounded-xl px-3.5 text-sm text-ink-400 transition hover:bg-white/[0.04] hover:text-white">
              <ListTodo className="h-[18px] w-[18px]" /> Nova tarefa
            </button>
          </nav>

          <div className="relative m-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
            <Avatar name={profile?.full_name ?? user.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{profile?.full_name ?? "Usuário"}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
            <button onClick={signOut} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-white/10 hover:text-white" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Topbar mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200/60 bg-ink-50/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sun-gradient">
              <Sun className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
            </div>
            <span className="font-display text-[15px] font-semibold">{settings.company_name || "Quark"}</span>
          </Link>
          <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-xl text-ink-500" aria-label="Sair">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="relative grid h-16 grid-cols-5">
            {NAV.slice(0, 2).map((item) => (
              <TabLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
            <div className="relative flex items-start justify-center">
              <button
                onClick={() => setFab((v) => !v)}
                aria-label="Criar"
                className={cx("absolute -top-5 grid h-14 w-14 place-items-center rounded-2xl bg-sun-gradient text-ink-950 shadow-glow ring-4 ring-ink-50 transition-transform", fab && "rotate-45")}
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </div>
            {NAV.slice(2, 4).map((item) => (
              <TabLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </div>
        </nav>

        {fab && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setFab(false)}>
            <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" />
            <div className="animate-fade-up absolute inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] grid gap-2 rounded-3xl bg-white p-2 shadow-lift">
              <FabItem icon={<Calculator className="h-5 w-5" />} title="Novo orçamento" text="Calcular e gerar proposta" onClick={() => router.push("/propostas/nova")} />
              <FabItem icon={<UserPlus className="h-5 w-5" />} title="Novo lead" text="Cadastrar um cliente" onClick={() => openLead()} />
              <FabItem icon={<ListTodo className="h-5 w-5" />} title="Nova tarefa" text="Agendar um follow-up" onClick={() => openTask()} />
              <FabItem icon={<Settings className="h-5 w-5" />} title="Configurações" text="Empresa, padrões e alertas" onClick={() => router.push("/configuracoes")} />
            </div>
          </div>
        )}

        <LeadFormModal open={leadModal.open} lead={leadModal.lead} onCreated={leadModal.onCreated} onClose={() => setLeadModal({ open: false })} />
        <TaskFormModal open={taskModal.open} task={taskModal.task} leadId={taskModal.leadId} onClose={() => setTaskModal({ open: false })} />
      </div>
    </Quick.Provider>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Sun; active: boolean }) {
  return (
    <Link href={href} className={cx("flex flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-ink-900" : "text-ink-400")}>
      <Icon className={cx("h-[22px] w-[22px]", active && "text-sun-600")} strokeWidth={active ? 2.3 : 2} />
      {label}
    </Link>
  );
}

function FabItem({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl p-3 text-left transition active:bg-ink-50">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-sun-50 text-sun-600 ring-1 ring-sun-200/70">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-500">{text}</p>
      </div>
    </button>
  );
}
