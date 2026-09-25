"use client";

import type { User } from "@supabase/supabase-js";
import { BrandLogo } from "./brand";
import { CheckSquare, Clock, FileText, Flame, LayoutDashboard, LogOut, Plus, PlugZap, Search, Settings, Sun, Trophy, UserPlus, Users, ListTodo, Calculator } from "lucide-react";
import { CommandPalette } from "./command";
import { RewardProvider, useReward } from "./rewards";
import { levelOf } from "@/lib/gamification";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Task } from "@/lib/types";
import { AppProvider, useApp } from "./app-context";
import { CelebrationProvider } from "./celebration";
import { Splash } from "./splash";
import { pickDaily, quotePool } from "@/lib/inspiration";
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
const SAVE_NAV = { href: "/propostas?tipo=save", label: "S.A.V.E", icon: PlugZap };
const ARENA_NAV = { href: "/ranking", label: "Arena", icon: Trophy };
const DESKTOP_NAV = [...NAV.slice(0, 3), SAVE_NAV, NAV[3], ARENA_NAV, NAV[4]];


interface QuickCtx {
  openLead: (lead?: Lead | null, opts?: { onCreated?: (id: string) => void }) => void;
  openTask: (opts?: { task?: Task | null; leadId?: string | null }) => void;
}
const Quick = createContext<QuickCtx>({ openLead: () => {}, openTask: () => {} });
export const useQuick = () => useContext(Quick);

export function Shell({ user, children }: { user: User; children: ReactNode }) {
  return (
    <AppProvider user={user}>
      <CelebrationProvider>
        <AccessGate>
          <RewardProvider>
            <ShellInner>{children}</ShellInner>
            <Splash />
          </RewardProvider>
        </AccessGate>
      </CelebrationProvider>
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
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openLead = useCallback(
    (lead?: Lead | null, opts?: { onCreated?: (id: string) => void }) => setLeadModal({ open: true, lead, onCreated: opts?.onCreated }),
    [],
  );
  const openTask = useCallback((o?: { task?: Task | null; leadId?: string | null }) => setTaskModal({ open: true, ...o }), []);

  useEffect(() => setFab(false), [pathname]);

  const search = useSearchParams();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === SAVE_NAV.href) return pathname.startsWith("/propostas") && search.get("tipo") === "save";
    if (href === "/propostas") return pathname.startsWith("/propostas") && search.get("tipo") !== "save";
    return pathname.startsWith(href);
  };
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
          <Link href="/" className="relative flex items-end gap-2.5 px-6 pt-7 pb-8" aria-label={settings.company_name || "Quark Energia"}>
            <BrandLogo className="h-10" />
            <span className="mb-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.18em] text-brand-lime">CRM</span>
          </Link>

          <div className="relative px-4">
            <button
              onClick={() => setPalette(true)}
              className="mb-3 flex h-10 w-full items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 text-sm text-ink-400 ring-1 ring-white/[0.06] transition hover:bg-white/[0.09] hover:text-white"
            >
              <Search className="h-4 w-4" /> Buscar…
              <kbd className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink-300">Ctrl K</kbd>
            </button>
            <Link
              href="/propostas/nova"
              className="mb-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-sun-gradient text-sm font-semibold text-ink-950 shadow-glow transition hover:brightness-105"
            >
              <Calculator className="h-4 w-4" /> Novo orçamento
            </Link>
          </div>

          <nav className="relative flex flex-1 flex-col gap-1 px-3">
            {DESKTOP_NAV.map((item) => {
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

          <XpCard />
          <SidebarQuote />
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
          <Link href="/" className="flex items-center" aria-label={settings.company_name || "Quark Energia"}>
            <BrandLogo variant="color" className="h-8" />
          </Link>
          <div className="flex items-center gap-1">
            <XpChip />
            <button onClick={() => setPalette(true)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-600" aria-label="Buscar">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-xl text-ink-500" aria-label="Sair">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
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
              <FabItem icon={<Calculator className="h-5 w-5" />} title="Orçamento solar" text="Calcular e gerar proposta" onClick={() => router.push("/propostas/nova")} />
              <FabItem icon={<PlugZap className="h-5 w-5" />} title="Orçamento S.A.V.E" text="Carregador de veículo elétrico" onClick={() => router.push("/propostas/nova?tipo=save")} />
              <FabItem icon={<UserPlus className="h-5 w-5" />} title="Novo lead" text="Cadastrar um cliente" onClick={() => openLead()} />
              <FabItem icon={<ListTodo className="h-5 w-5" />} title="Nova tarefa" text="Agendar um follow-up" onClick={() => openTask()} />
              <FabItem icon={<Settings className="h-5 w-5" />} title="Configurações" text="Empresa, padrões e alertas" onClick={() => router.push("/configuracoes")} />
            </div>
          </div>
        )}

        <CommandPalette open={palette} onClose={() => setPalette(false)} onNewLead={() => openLead()} onNewTask={() => openTask()} />
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

function SidebarQuote() {
  const { settings } = useApp();
  const q = pickDaily(quotePool(settings.app.customQuotes, settings.app.useDefaultQuotes), 7);
  if (!q) return null;
  return (
    <div className="relative mx-4 mb-2 border-l-2 border-[#9BD373]/60 pl-3">
      <p className="font-serif text-[13px] leading-snug text-ink-300 italic">“{q.text}”</p>
      <p className="mt-1 text-[10px] tracking-[0.18em] text-ink-500 uppercase">{q.author}</p>
    </div>
  );
}

/** Nível, XP e sequência de dias — leva para a Arena. */
function XpCard() {
  const { xp, streak } = useReward();
  if (xp == null) return null;
  const { level, next, progress, toNext } = levelOf(xp);
  return (
    <Link href="/ranking" className="relative mx-3 mb-3 block rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-3.5 ring-1 ring-white/[0.08] transition hover:ring-white/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-ink-400 uppercase">Nível {level.n}</p>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-yellow">
            <Flame className="h-3.5 w-3.5" /> {streak} {streak === 1 ? "dia" : "dias"}
          </span>
        )}
      </div>
      <p className="text-sun-gradient mt-0.5 font-display text-lg font-bold">{level.title}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-sun-gradient transition-all duration-700" style={{ width: `${Math.max(4, progress * 100)}%` }} />
      </div>
      <p className="tnum mt-1.5 text-[11px] text-ink-400">
        {xp.toLocaleString("pt-BR")} XP{next ? ` · faltam ${toNext.toLocaleString("pt-BR")} para ${next.title}` : " · topo do mundo"}
      </p>
    </Link>
  );
}

function XpChip() {
  const { xp, streak } = useReward();
  if (xp == null) return null;
  const { level } = levelOf(xp);
  return (
    <Link href="/ranking" className="flex h-8 items-center gap-1.5 rounded-full bg-ink-900 px-2.5 text-[11px] font-bold text-white" aria-label={`Nível ${level.n}: ${level.title}`}>
      <Trophy className="h-3.5 w-3.5 text-brand-yellow" />
      <span className="text-sun-gradient">{level.title}</span>
      {streak > 1 && (
        <span className="flex items-center text-brand-yellow">
          <Flame className="h-3 w-3" />
          {streak}
        </span>
      )}
    </Link>
  );
}

/** Quem se cadastrou sozinho só entra depois que um administrador liberar o acesso. */
function AccessGate({ children }: { children: ReactNode }) {
  const { profile, settings } = useApp();
  if (profile?.active !== false) return <>{children}</>;
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-950 p-6 text-center text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sun-500/20 blur-[120px]" />
      <div className="relative max-w-md">
        <BrandLogo className="mx-auto h-12" />
        <div className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
          <Clock className="h-7 w-7 text-brand-yellow" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold">Quase lá, {(profile.full_name ?? "").split(" ")[0] || "vendedor"}!</h1>
        <p className="mt-3 text-white/70">
          Seu cadastro foi recebido. Um administrador da {settings.company_name || "equipe"} precisa liberar o seu acesso em Configurações → Equipe. Assim que for liberado, é só
          atualizar esta página.
        </p>
        <p className="mt-8 font-serif text-lg text-white/60 italic">“A sorte é o que acontece quando a preparação encontra a oportunidade.”</p>
        <button
          onClick={async () => {
            await supabase().auth.signOut();
            window.location.href = "/login";
          }}
          className="mt-8 text-sm font-semibold text-brand-lime hover:underline"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
