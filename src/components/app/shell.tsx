"use client";

import type { User } from "@supabase/supabase-js";
import { BrandLogo } from "./brand";
import { BarChart3, CheckSquare, ChevronsLeft, ChevronsRight, FileSignature, Megaphone, Zap, Clock, FileText, Flame, LayoutDashboard, LogOut, Plus, PlugZap, Search, Settings, Sun, Trophy, UserPlus, Users, ListTodo, Calculator } from "lucide-react";
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
import { AvatarPicker, OpeningFlow } from "./onboarding";
import { useNavBadges, type NavBadges } from "./nav-badges";
import { useProposalViewAlerts } from "./view-alerts";

type NavKey = "tasks" | "leads" | "proposals" | "documents";
interface NavItem {
  href: string;
  label: string;
  icon: typeof Sun;
  badge?: NavKey;
  hint?: string;
  /** Só aparece para o master (administrador). */
  admin?: boolean;
}

/** Menu em seções: o S.A.V.E fica dentro de Propostas (lá se escolhe o tipo). */
const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Vendas",
    items: [
      { href: "/", label: "Painel", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Users, badge: "leads", hint: "leads novos sem contato" },
      { href: "/propostas", label: "Propostas", icon: FileText, badge: "proposals", hint: "propostas vistas aguardando resposta" },
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare, badge: "tasks", hint: "tarefas para hoje" },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { href: "/orcamento-rapido", label: "Orçamento rápido", icon: Zap },
      { href: "/documentos", label: "Documentos", icon: FileSignature, badge: "documents", hint: "aguardando assinatura" },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
    ],
  },
  {
    title: "Desempenho",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users, badge: "leads" },
  { href: "/propostas", label: "Propostas", icon: FileText, badge: "proposals" },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, badge: "tasks" },
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
      <CelebrationProvider>
        <AccessGate>
          <RewardProvider>
            <ShellInner>{children}</ShellInner>
            <Splash />
            <OpeningFlow />
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
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      // Atalhos de uma tecla (fora de campos de texto e janelas abertas): / busca, N lead, T tarefa
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (k === "n") {
        e.preventDefault();
        setLeadModal({ open: true });
      } else if (k === "t") {
        e.preventDefault();
        setTaskModal({ open: true });
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

  useEffect(() => {
    setFab(false);
  }, [pathname]);

  const search = useSearchParams();
  void search;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const badges = useNavBadges(user.id);
  useProposalViewAlerts();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {
      /* navegação privada */
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem("sidebar-collapsed", v ? "0" : "1");
      } catch {
        /* navegação privada */
      }
      return !v;
    });
  const signOut = async () => {
    await supabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <Quick.Provider value={{ openLead, openTask }}>
      <div className={cx("min-h-dvh transition-[padding] duration-300 print:pl-0", collapsed ? "lg:pl-[88px]" : "lg:pl-[276px]")}>
        <div className="app-aurora" aria-hidden />
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          isActive={isActive}
          badges={badges}
          onSearch={() => setPalette(true)}
          onNewLead={() => openLead()}
          onNewTask={() => openTask()}
          onAvatar={() => router.push(`/perfil/${user.id}`)}
          onSignOut={signOut}
        />

        {/* Topbar mobile */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/60 bg-white/55 px-4 shadow-[0_1px_0_rgba(28,18,52,0.05)] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
          <Link href="/" className="flex items-center" aria-label={settings.company_name || "Quark Energia"}>
            <BrandLogo variant="color" className="h-8" />
          </Link>
          <div className="flex items-center gap-1">
            <XpChip />
            <button onClick={() => router.push(`/perfil/${user.id}`)} className="ml-0.5 rounded-full" aria-label="Meu perfil">
              <Avatar name={profile?.full_name ?? user.email} src={profile?.avatar_url} className="h-8 w-8 text-[10px]" />
            </button>
            <button onClick={() => setPalette(true)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-600" aria-label="Buscar">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-xl text-ink-500" aria-label="Sair">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <div key={pathname} className="page-in">
            {children}
          </div>
        </main>

        {/* Bottom nav mobile */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/65 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgba(28,18,52,0.18)] backdrop-blur-2xl backdrop-saturate-150 lg:hidden">
          <div className="relative grid h-16 grid-cols-5">
            {MOBILE_TABS.slice(0, 2).map((item) => (
              <TabLink key={item.href} {...item} active={isActive(item.href)} count={item.badge ? badges[item.badge] : 0} alert={item.badge === "tasks" && badges.late > 0} />
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
            {MOBILE_TABS.slice(2, 4).map((item) => (
              <TabLink key={item.href} {...item} active={isActive(item.href)} count={item.badge ? badges[item.badge] : 0} alert={item.badge === "tasks" && badges.late > 0} />
            ))}
          </div>
        </nav>

        {fab && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setFab(false)}>
            <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" />
            <div className="animate-fade-up absolute inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] grid max-h-[calc(100dvh-8rem)] gap-1 overflow-y-auto rounded-3xl bg-white/85 p-2 shadow-lift ring-1 ring-white/70 backdrop-blur-2xl">
              <FabItem icon={<Calculator className="h-5 w-5" />} title="Orçamento solar" text="Calcular e gerar proposta" onClick={() => router.push("/propostas/nova")} />
              <FabItem icon={<PlugZap className="h-5 w-5" />} title="Orçamento S.A.V.E" text="Carregador de veículo elétrico" onClick={() => router.push("/propostas/nova?tipo=save")} />
              <FabItem icon={<Flame className="h-5 w-5" />} title="Plano do dia" text="Missões para vender mais hoje" onClick={() => window.dispatchEvent(new Event("quark:briefing"))} />
              <FabItem icon={<Zap className="h-5 w-5" />} title="Orçamento rápido" text="Imagem pronta para o WhatsApp" onClick={() => router.push("/orcamento-rapido")} />
              <FabItem icon={<UserPlus className="h-5 w-5" />} title="Novo lead" text="Cadastrar um cliente" onClick={() => openLead()} />
              <FabItem icon={<ListTodo className="h-5 w-5" />} title="Nova tarefa" text="Agendar um follow-up" onClick={() => openTask()} />
              <FabItem icon={<Megaphone className="h-5 w-5" />} title="Marketing" text="Artes para Instagram e status" onClick={() => router.push("/marketing")} />
              <FabItem icon={<FileSignature className="h-5 w-5" />} title="Procuração ou contrato" text="Documentos com assinatura digital" onClick={() => router.push("/documentos")} />
              <FabItem icon={<Settings className="h-5 w-5" />} title="Configurações" text="Empresa, padrões e alertas" onClick={() => router.push("/configuracoes")} />
            </div>
          </div>
        )}

        <AvatarPicker open={avatarOpen} onClose={() => setAvatarOpen(false)} />
        <CommandPalette open={palette} onClose={() => setPalette(false)} onNewLead={() => openLead()} onNewTask={() => openTask()} />
        <LeadFormModal open={leadModal.open} lead={leadModal.lead} onCreated={leadModal.onCreated} onClose={() => setLeadModal({ open: false })} />
        <TaskFormModal open={taskModal.open} task={taskModal.task} leadId={taskModal.leadId} onClose={() => setTaskModal({ open: false })} />
      </div>
    </Quick.Provider>
  );
}

function TabLink({ href, label, icon: Icon, active, count = 0, alert }: { href: string; label: string; icon: typeof Sun; active: boolean; count?: number; alert?: boolean }) {
  return (
    <Link href={href} className={cx("flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition active:scale-95", active ? "text-ink-900" : "text-ink-400")}>
      <span className={cx("relative grid h-8 w-14 place-items-center rounded-full transition-all duration-300", active && "bg-gradient-to-br from-[#F3EA3B]/45 to-[#9BD373]/45 shadow-[0_6px_16px_-8px_rgba(127,203,134,0.9)] ring-1 ring-white/70")}>
        <Icon className={cx("h-[21px] w-[21px]", active && "text-ink-900")} strokeWidth={active ? 2.3 : 2} />
        {count > 0 && <Badge count={count} alert={alert} className="absolute -top-1.5 right-0.5" />}
      </span>
      {label}
    </Link>
  );
}

/** Sinalizador estilo app de celular. */
function Badge({ count, alert, className }: { count: number; alert?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] leading-none font-bold tabular-nums shadow-[0_4px_12px_-2px_rgba(0,0,0,0.35)] ring-2",
        alert ? "bg-[#FF3B5C] text-white ring-[#FF3B5C]/25" : "bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234] ring-black/10",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Sidebar({
  collapsed,
  onToggle,
  isActive,
  badges,
  onSearch,
  onNewLead,
  onNewTask,
  onAvatar,
  onSignOut,
}: {
  collapsed: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
  badges: NavBadges;
  onSearch: () => void;
  onNewLead: () => void;
  onNewTask: () => void;
  onAvatar: () => void;
  onSignOut: () => void;
}) {
  const { profile, user, settings } = useApp();
  const { xp, streak } = useReward();
  const lvl = xp != null ? levelOf(xp) : null;
  const pathname = usePathname();
  const first = (profile?.full_name ?? "").split(" ")[0] || "Você";

  return (
    <aside
      className={cx(
        "no-print fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-white/[0.06] text-ink-300 transition-[width] duration-300 lg:flex",
        collapsed ? "w-[88px]" : "w-[276px]",
      )}
      style={{ background: "linear-gradient(180deg, #16102C 0%, #0D0A1C 45%, #08070F 100%)" }}
    >
      {/* brilhos de fundo */}
      <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[#5B34D6]/35 blur-[90px]" />
      <div className="pointer-events-none absolute top-1/2 -right-32 h-72 w-72 rounded-full bg-[#9BD373]/10 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-60 w-60 rounded-full bg-[#F3EA3B]/10 blur-[90px]" />

      {/* topo */}
      <div className={cx("relative flex shrink-0 items-center pt-6 pb-5", collapsed ? "flex-col gap-4 px-3" : "justify-between px-5")}>
        <Link href="/" className="flex items-end gap-2" aria-label={settings.company_name || "Quark Energia"}>
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/symbol.png" alt="" className="h-9 w-9 object-contain" />
          ) : (
            <>
              <BrandLogo className="h-9" />
              <span className="mb-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] text-brand-lime">CRM</span>
            </>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 ring-1 ring-white/[0.08] transition hover:bg-white/[0.08] hover:text-white"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* busca + orçamento */}
      <div className={cx("relative grid shrink-0 gap-2.5 pb-3", collapsed ? "px-3" : "px-4")}>
        <button
          onClick={onSearch}
          title="Buscar (Ctrl K)"
          className={cx(
            "flex h-10 items-center gap-2.5 rounded-xl bg-white/[0.05] text-sm text-ink-400 ring-1 ring-white/[0.08] backdrop-blur-md transition hover:bg-white/[0.09] hover:text-white",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          <Search className="h-4 w-4" />
          {!collapsed && (
            <>
              Buscar…
              <kbd className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink-300">Ctrl K</kbd>
            </>
          )}
        </button>
        <Link
          href="/propostas/nova"
          title="Novo orçamento"
          className="anam-shine relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#F3EA3B] via-[#C7E36B] to-[#9BD373] text-sm font-bold text-[#1C1234] shadow-[0_12px_30px_-12px_rgba(243,234,59,0.7)] transition hover:brightness-105 active:scale-[0.98]"
        >
          <Calculator className="h-4 w-4" /> {!collapsed && "Novo orçamento"}
        </Link>
      </div>

      {/* navegação (rola quando não cabe) */}
      <nav className="sidebar-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 [mask-image:linear-gradient(180deg,transparent,black_14px,black_calc(100%-18px),transparent)]">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="px-3 pt-3">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-8 bg-white/[0.08]" />
            ) : (
              <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.2em] text-ink-500 uppercase">{sec.title}</p>
            )}
            <div className="grid gap-0.5">
              {sec.items.filter((item) => !item.admin || profile?.role === "admin").map((item) => {
                const active = isActive(item.href);
                const n = item.badge ? badges[item.badge] : 0;
                const alert = item.badge === "tasks" && badges.late > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? `${item.label}${n ? ` · ${n} ${item.hint ?? ""}` : ""}` : n ? `${n} ${item.hint ?? ""}` : undefined}
                    className={cx(
                      "group relative flex h-11 items-center gap-3 rounded-xl text-[14px] font-medium transition-all duration-200",
                      collapsed ? "justify-center" : "px-3",
                      active
                        ? "bg-gradient-to-r from-white/[0.13] to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/[0.08]"
                        : "text-ink-300 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    {active && <span className="absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#F3EA3B] to-[#9BD373] shadow-[0_0_12px_rgba(243,234,59,0.8)]" />}
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                      <item.icon
                        className={cx("h-[19px] w-[19px] transition-transform duration-200 group-hover:scale-110", active ? "text-[#F3EA3B]" : "text-ink-500 group-hover:text-ink-200")}
                        strokeWidth={active ? 2.3 : 2}
                      />
                      {collapsed && n > 0 && <Badge count={n} alert={alert} className="absolute -top-1 -right-2" />}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {n > 0 && <Badge count={n} alert={alert} className="ml-auto" />}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* atalhos */}
        <div className={cx("pt-4", collapsed ? "px-3" : "px-4")}>
          {!collapsed && <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.2em] text-ink-500 uppercase">Atalhos</p>}
          <div className={cx("grid gap-2", collapsed ? "grid-cols-1" : "grid-cols-3")}>
            {[
              { label: "Lead", icon: UserPlus, run: onNewLead, title: "Novo lead" },
              { label: "Tarefa", icon: ListTodo, run: onNewTask, title: "Nova tarefa" },
              { label: "Plano", icon: Flame, run: () => window.dispatchEvent(new Event("quark:briefing")), title: "Plano do dia" },
            ].map((a) => (
              <button
                key={a.label}
                onClick={a.run}
                title={a.title}
                className="group flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] py-2.5 text-[11px] font-semibold text-ink-400 ring-1 ring-white/[0.06] transition hover:bg-white/[0.08] hover:text-white"
              >
                <a.icon className={cx("h-[18px] w-[18px] transition group-hover:scale-110", a.label === "Plano" && "text-[#F3EA3B]")} />
                {!collapsed && a.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* perfil */}
      <div className="relative shrink-0 border-t border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-xl">
        <div className={cx("flex items-center gap-3 rounded-2xl p-2", collapsed ? "flex-col" : "bg-white/[0.04] ring-1 ring-white/[0.06]")}>
          <button onClick={onAvatar} className="relative shrink-0 rounded-full" title="Meu perfil">
            <span className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] opacity-80" />
            <Avatar name={profile?.full_name ?? user.email} src={profile?.avatar_url} className="relative h-10 w-10 ring-2 ring-[#0D0A1C]" />
            {streak > 1 && (
              <span className="absolute -right-1 -bottom-1 flex items-center rounded-full bg-[#1C1234] px-1 text-[9px] font-bold text-[#FFB36B] ring-1 ring-white/10">
                <Flame className="h-2.5 w-2.5" />
                {streak}
              </span>
            )}
          </button>
          {!collapsed && (
            <Link href={`/perfil/${user.id}`} className="min-w-0 flex-1" title="Meu perfil">
              <p className="truncate text-sm font-semibold text-white">{first}</p>
              {lvl ? (
                <>
                  <p className="truncate text-[11px] font-semibold text-[#F3EA3B]">
                    Nív. {lvl.level.n} · {lvl.level.title}
                  </p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] transition-all duration-700" style={{ width: `${Math.max(4, lvl.progress * 100)}%` }} />
                  </div>
                </>
              ) : (
                <p className="truncate text-[11px] text-ink-500">{user.email}</p>
              )}
            </Link>
          )}
          <div className={cx("flex", collapsed ? "flex-col gap-1" : "gap-0.5")}>
            <Link
              href="/configuracoes"
              title="Configurações"
              className={cx("grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/10 hover:text-white", pathname.startsWith("/configuracoes") ? "text-[#F3EA3B]" : "text-ink-500")}
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button onClick={onSignOut} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-white/10 hover:text-white" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
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



function XpChip() {
  const { xp, streak } = useReward();
  if (xp == null) return null;
  const { level } = levelOf(xp);
  return (
    <Link href="/perfil" className="flex h-8 items-center gap-1.5 rounded-full bg-ink-900 px-2.5 text-[11px] font-bold text-white" aria-label={`Nível ${level.n}: ${level.title}`}>
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
