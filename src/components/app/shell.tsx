"use client";

import type { User } from "@supabase/supabase-js";
import { BrandLogo } from "./brand";
import { BarChart3, CheckSquare, ChevronRight, ChevronsLeft, ChevronsRight, FileSignature, Megaphone, Zap, Clock, FileText, Flame, LayoutDashboard, LogOut, Plus, Search, Sun, Trophy, Users, Calculator, Receipt, ScrollText, Moon, Activity } from "lucide-react";
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
import { useTheme, type Theme } from "./theme";
import { Glyph, GlyphTile, type GlyphId } from "./ios-glyphs";

type NavKey = "tasks" | "leads" | "proposals" | "documents" | "alarms";
interface NavItem {
  href: string;
  label: string;
  icon: typeof Sun;
  /** Ícone premium (estilo Ajustes do iOS). */
  glyph: GlyphId;
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
      { href: "/", label: "Painel", icon: LayoutDashboard, glyph: "painel" },
      { href: "/leads", label: "Leads", icon: Users, glyph: "leads", badge: "leads", hint: "leads novos sem contato" },
      { href: "/propostas", label: "Propostas", icon: FileText, glyph: "propostas", badge: "proposals", hint: "propostas vistas aguardando resposta" },
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare, glyph: "tarefas", badge: "tasks", hint: "tarefas para hoje" },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { href: "/orcamento-rapido", label: "Orçamento rápido", icon: Zap, glyph: "raio" },
      { href: "/documentos", label: "Documentos", icon: FileSignature, glyph: "documentos", badge: "documents", hint: "aguardando assinatura" },
      { href: "/contratos", label: "Contratos", icon: ScrollText, glyph: "contratos" },
      { href: "/recibos", label: "Recibos", icon: Receipt, glyph: "recibos" },
      { href: "/marketing", label: "Marketing", icon: Megaphone, glyph: "marketing" },
    ],
  },
  {
    title: "Pós-venda",
    items: [{ href: "/monitoramento", label: "Monitoramento", icon: Activity, glyph: "sol", badge: "alarms", hint: "alarmes ativos nas usinas" }],
  },
  {
    title: "Desempenho",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, glyph: "relatorios" },
    ],
  },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard, glyph: "painel" },
  { href: "/leads", label: "Leads", icon: Users, glyph: "leads", badge: "leads" },
  { href: "/propostas", label: "Propostas", icon: FileText, glyph: "propostas", badge: "proposals" },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, glyph: "tarefas", badge: "tasks" },
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
  const [theme, toggleTheme] = useTheme();
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
      <div className={cx("ios-app min-h-dvh transition-[padding] duration-300 print:pl-0", collapsed ? "lg:pl-[88px]" : "lg:pl-[300px]", theme === "dark" && "theme-dark")}>
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
          theme={theme}
          onTheme={toggleTheme}
        />

        {/* Topbar mobile */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/[0.06] bg-[#F2F2F7]/75 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-200 lg:hidden dark:border-white/[0.06] dark:bg-black/80">
          <Link href="/" className="flex items-center" aria-label={settings.company_name || "Quark Energia"}>
            <BrandLogo variant={theme === "dark" ? "white" : "color"} className="h-7" />
          </Link>
          <div className="flex items-center gap-0.5">
            <XpChip />
            <button onClick={() => router.push(`/perfil/${user.id}`)} className="ml-0.5 rounded-full" aria-label="Meu perfil">
              <Avatar name={profile?.full_name ?? user.email} src={profile?.avatar_url} className="h-8 w-8 text-[10px]" />
            </button>
            <button onClick={() => setPalette(true)} className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[rgba(118,118,128,0.14)] text-ink-700 dark:bg-[rgba(118,118,128,0.26)] dark:text-white" aria-label="Buscar">
              <Search className="h-4 w-4" strokeWidth={2.4} />
            </button>
            <button onClick={toggleTheme} className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[rgba(118,118,128,0.14)] text-ink-700 dark:bg-[rgba(118,118,128,0.26)] dark:text-white" aria-label={theme === "dark" ? "Tema claro" : "Tema escuro"}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={signOut} className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[rgba(118,118,128,0.14)] text-ink-700 dark:bg-[rgba(118,118,128,0.26)] dark:text-white" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <div key={pathname} className="page-in">
            {children}
          </div>
        </main>

        {/* Dock flutuante de vidro líquido (celular) */}
        <nav className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2.5">
            <div className="liquid-glass flex h-[62px] flex-1 items-center gap-0.5 rounded-full px-1">
              {MOBILE_TABS.map((item) => (
                <TabLink key={item.href} {...item} active={isActive(item.href)} count={item.badge ? badges[item.badge] : 0} alert={item.badge === "tasks" && badges.late > 0} />
              ))}
            </div>
            <button onClick={() => setFab((v) => !v)} aria-label="Criar" className="liquid-glass grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full transition active:scale-95">
              <span className={cx("grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_18px_-6px_rgba(155,211,115,0.9)] transition-transform duration-300", fab && "rotate-45")}>
                <Plus className="h-6 w-6" strokeWidth={2.6} />
              </span>
            </button>
          </div>
        </nav>

        {fab && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setFab(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />
            <div className="liquid-glass animate-fade-up absolute inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-[28px] py-1.5">
              <FabItem glyph="calculadora" title="Orçamento solar" text="Calcular e gerar proposta" onClick={() => router.push("/propostas/nova")} />
              <FabItem glyph="plugue" title="Orçamento S.A.V.E" text="Carregador de veículo elétrico" onClick={() => router.push("/propostas/nova?tipo=save")} />
              <FabItem glyph="chave" title="Orçamento de manutenção" text="Limpeza e revisão elétrica" onClick={() => router.push("/propostas/nova?tipo=manutencao")} />
              <FabItem glyph="chama" title="Plano do dia" text="Missões para vender mais hoje" onClick={() => window.dispatchEvent(new Event("quark:briefing"))} />
              <FabItem glyph="raio" title="Orçamento rápido" text="Imagem pronta para o WhatsApp" onClick={() => router.push("/orcamento-rapido")} />
              <FabItem glyph="novoLead" title="Novo lead" text="Cadastrar um cliente" onClick={() => openLead()} />
              <FabItem glyph="novaTarefa" title="Nova tarefa" text="Agendar um follow-up" onClick={() => openTask()} />
              <FabItem glyph="marketing" title="Marketing" text="Artes para Instagram e status" onClick={() => router.push("/marketing")} />
              <FabItem glyph="contratos" title="Contrato" text="Contrato solar para assinar" onClick={() => router.push("/documentos/novo?tipo=contrato")} />
              <FabItem glyph="recibos" title="Recibo" text="PDF com a assinatura da Quark" onClick={() => router.push("/recibos")} />
              <FabItem glyph="documentos" title="Procuração ou aluguel" text="Documentos com assinatura digital" onClick={() => router.push("/documentos")} />
              <FabItem glyph="engrenagem" title="Configurações" text="Empresa, padrões e alertas" onClick={() => router.push("/configuracoes")} last />
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

function TabLink({ href, label, glyph, active, count = 0, alert }: { href: string; label: string; glyph: GlyphId; active: boolean; count?: number; alert?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "relative flex h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold tracking-normal transition-all duration-300 active:scale-95",
        active ? "bg-black/[0.06] text-ink-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-white/[0.13] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "text-ink-500 dark:text-[#8E8E93]",
      )}
    >
      <span className="relative">
        <Glyph id={glyph} mono={!active} className="h-[24px] w-[24px]" />
        {count > 0 && <Badge count={count} alert={alert} className="absolute -top-1.5 -right-3" />}
      </span>
      {label}
    </Link>
  );
}

/** Sinalizador vermelho, como nos apps do iPhone. */
function Badge({ count, alert, className }: { count: number; alert?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF3B30] px-[5px] text-[11px] leading-none font-semibold text-white tabular-nums shadow-[0_2px_6px_rgba(255,59,48,0.45)]",
        alert && "animate-pulse",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Linha de lista agrupada (estilo Ajustes do iOS). */
function Row({
  href,
  onClick,
  glyph,
  label,
  active,
  count = 0,
  alert,
  collapsed,
  last,
  title,
  danger,
}: {
  href?: string;
  onClick?: () => void;
  glyph: GlyphId;
  label: string;
  active?: boolean;
  count?: number;
  alert?: boolean;
  collapsed: boolean;
  last?: boolean;
  title?: string;
  danger?: boolean;
}) {
  const body = collapsed ? (
    <span className="relative">
      <GlyphTile id={glyph} size="md" />
      {count > 0 && <Badge count={count} alert={alert} className="absolute -top-1.5 -right-2" />}
    </span>
  ) : (
    <>
      <GlyphTile id={glyph} size="sm" />
      <span className={cx("min-w-0 flex-1 truncate text-[15px]", danger ? "text-[#FF453A]" : "text-white")}>{label}</span>
      {count > 0 && <Badge count={count} alert={alert} />}
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-[#5A5A5F]" strokeWidth={2.6} />}
      {!last && <span className="pointer-events-none absolute right-0 bottom-0 left-[54px] h-[0.5px] bg-white/[0.14]" />}
    </>
  );
  const cls = cx(
    "group relative flex items-center transition-colors duration-150",
    collapsed ? "mx-auto h-12 w-12 justify-center rounded-[14px]" : "h-[48px] gap-3 pr-3 pl-3",
    active ? (collapsed ? "bg-white/[0.12] ring-1 ring-white/[0.1]" : "bg-[#2C2C2E]") : "hover:bg-white/[0.05] active:bg-white/[0.1]",
  );
  return href ? (
    <Link href={href} title={title ?? (collapsed ? label : undefined)} className={cls} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} title={title ?? (collapsed ? label : undefined)} className={cx(cls, "w-full text-left")}>
      {body}
    </button>
  );
}

function Group({ title, collapsed, children }: { title?: string; collapsed: boolean; children: ReactNode }) {
  return (
    <div className={cx(collapsed ? "px-2 pt-3" : "px-3 pt-4")}>
      {collapsed ? <div className="mx-auto mb-2 h-px w-8 bg-white/[0.08]" /> : title && <p className="mb-1.5 px-4 text-[12px] font-medium tracking-[0.02em] text-[#8E8E93] uppercase">{title}</p>}
      <div className={cx(collapsed ? "grid gap-1.5" : "overflow-hidden rounded-[20px] bg-[#1C1C1E]")}>{children}</div>
    </div>
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
  theme,
  onTheme,
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
  theme: Theme;
  onTheme: () => void;
}) {
  const { profile, user, settings } = useApp();
  const { xp, streak } = useReward();
  const lvl = xp != null ? levelOf(xp) : null;
  const pathname = usePathname();
  const name = profile?.full_name || "Você";

  return (
    <aside
      className={cx(
        "palette-classic ios-keep no-print fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-white/[0.06] bg-black text-white transition-[width] duration-300 lg:flex",
        collapsed ? "w-[88px]" : "w-[300px]",
      )}
    >
      {/* topo */}
      <div className={cx("relative flex shrink-0 items-center pt-6 pb-4", collapsed ? "flex-col gap-4 px-3" : "justify-between px-5")}>
        <Link href="/" className="flex items-end gap-2" aria-label={settings.company_name || "Quark Energia"}>
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/symbol.png" alt="" className="h-9 w-9 object-contain" />
          ) : (
            <>
              <BrandLogo className="h-9" />
              <span className="mb-0.5 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-brand-lime">CRM</span>
            </>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="liquid-glass grid h-8 w-8 place-items-center rounded-full text-[#AEAEB2] transition hover:text-white"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* busca + orçamento */}
      <div className={cx("relative grid shrink-0 gap-2.5 pb-1", collapsed ? "px-3" : "px-4")}>
        <button
          onClick={onSearch}
          title="Buscar (Ctrl K)"
          className={cx("liquid-glass flex h-10 items-center gap-2 rounded-full text-[15px] text-[#8E8E93] transition hover:text-white", collapsed ? "justify-center" : "px-3.5")}
        >
          <Search className="h-[17px] w-[17px]" strokeWidth={2.4} />
          {!collapsed && (
            <>
              Buscar
              <kbd className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#AEAEB2]">⌘K</kbd>
            </>
          )}
        </button>
        <Link
          href="/propostas/nova"
          title="Novo orçamento"
          className="anam-shine relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#C7E36B] to-[#9BD373] text-[15px] font-semibold text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_30px_-12px_rgba(243,234,59,0.7)] transition hover:brightness-105 active:scale-[0.98]"
        >
          <Calculator className="h-4 w-4" /> {!collapsed && "Novo orçamento"}
        </Link>
      </div>

      <nav className="sidebar-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 [mask-image:linear-gradient(180deg,transparent,black_12px,black_calc(100%-18px),transparent)]">
        {/* conta (como o topo dos Ajustes) */}
        <div className={cx(collapsed ? "px-2 pt-3" : "px-3 pt-4")}>
          <div className={cx("flex items-center gap-3", collapsed ? "flex-col" : "rounded-[20px] bg-[#1C1C1E] p-3")}>
            <button onClick={onAvatar} className="relative shrink-0 rounded-full" title="Meu perfil">
              <Avatar name={profile?.full_name ?? user.email} src={profile?.avatar_url} className={cx("ring-1 ring-white/15", collapsed ? "h-11 w-11" : "h-12 w-12")} />
              {streak > 1 && (
                <span className="absolute -right-1 -bottom-1 flex items-center rounded-full bg-[#2C2C2E] px-1 text-[9px] font-bold text-[#FF9F0A] ring-1 ring-black">
                  <Flame className="h-2.5 w-2.5" />
                  {streak}
                </span>
              )}
            </button>
            {!collapsed && (
              <Link href={`/perfil/${user.id}`} className="flex min-w-0 flex-1 items-center gap-2" title="Meu perfil">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold text-white">{name}</p>
                  {lvl ? (
                    <>
                      <p className="truncate text-[12px] text-[#8E8E93]">
                        Nív. {lvl.level.n} · {lvl.level.title}
                      </p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#FFD60A] to-[#30D158] transition-all duration-700" style={{ width: `${Math.max(4, lvl.progress * 100)}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="truncate text-[12px] text-[#8E8E93]">Perfil e conquistas</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#5A5A5F]" strokeWidth={2.6} />
              </Link>
            )}
          </div>
        </div>

        {SECTIONS.map((sec) => {
          const items = sec.items.filter((item) => !item.admin || profile?.role === "admin");
          return (
            <Group key={sec.title} title={sec.title} collapsed={collapsed}>
              {items.map((item, i) => {
                const n = item.badge ? badges[item.badge] : 0;
                return (
                  <Row
                    key={item.href}
                    href={item.href}
                    glyph={item.glyph}
                    label={item.label}
                    active={isActive(item.href)}
                    count={n}
                    alert={item.badge === "tasks" && badges.late > 0}
                    collapsed={collapsed}
                    last={i === items.length - 1}
                    title={collapsed ? `${item.label}${n ? ` · ${n} ${item.hint ?? ""}` : ""}` : n ? `${n} ${item.hint ?? ""}` : undefined}
                  />
                );
              })}
            </Group>
          );
        })}

        <Group title="Atalhos" collapsed={collapsed}>
          <Row onClick={onNewLead} glyph="novoLead" label="Novo lead" collapsed={collapsed} />
          <Row onClick={onNewTask} glyph="novaTarefa" label="Nova tarefa" collapsed={collapsed} />
          <Row onClick={() => window.dispatchEvent(new Event("quark:briefing"))} glyph="chama" label="Plano do dia" collapsed={collapsed} last />
        </Group>

        <Group title="Conta" collapsed={collapsed}>
          <Row href="/configuracoes" glyph="engrenagem" label="Configurações" active={pathname.startsWith("/configuracoes")} collapsed={collapsed} />
          <Row onClick={onTheme} glyph="aparencia" label={theme === "dark" ? "Tema claro" : "Tema escuro"} collapsed={collapsed} />
          <Row onClick={onSignOut} glyph="sair" label="Sair" danger collapsed={collapsed} last />
        </Group>
      </nav>
    </aside>
  );
}

function FabItem({ glyph, title, text, onClick, last }: { glyph: GlyphId; title: string; text: string; onClick: () => void; last?: boolean }) {
  return (
    <button onClick={onClick} className="relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-black/[0.05] dark:active:bg-white/[0.08]">
      <GlyphTile id={glyph} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink-900">{title}</p>
        <p className="truncate text-[13px] text-ink-500">{text}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 dark:text-[#5A5A5F]" strokeWidth={2.6} />
      {!last && <span className="pointer-events-none absolute right-0 bottom-0 left-[64px] h-px bg-black/[0.07] dark:bg-white/[0.08]" />}
    </button>
  );
}

function XpChip() {
  const { xp, streak } = useReward();
  if (xp == null) return null;
  const { level } = levelOf(xp);
  return (
    <Link href="/perfil" className="flex h-8 items-center gap-1.5 rounded-full bg-[#1C1C1E] px-2.5 text-[11px] font-bold text-white dark:bg-[rgba(118,118,128,0.26)]" aria-label={`Nível ${level.n}: ${level.title}`}>
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
