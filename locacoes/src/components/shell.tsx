"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Boxes, CalendarClock, ClipboardList, Cloud, HardDrive, Loader2, LogOut, MoreHorizontal, Settings, Sparkles, Users, Wallet } from "lucide-react";
import { useDados } from "@/lib/store";
import { diffDias, hoje } from "@/lib/format";
import { Login } from "./login";
import { Logo } from "./logo";
import { cx, Modal } from "./ui";

const NAV = [
  { href: "/", label: "Orçamento", icon: Sparkles },
  { href: "/locacoes", label: "Locações", icon: ClipboardList },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];
const MOBILE = ["/", "/locacoes", "/agenda", "/estoque"];

function ativo(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { dados, modo, session, authPronto, semAcesso, carregando, sair } = useDados();
  const [mais, setMais] = useState(false);

  const badges = useMemo(() => {
    const h = hoje();
    const agenda = dados.locacoes.filter(
      (l) => (l.status === "agendada" && l.data_entrega && diffDias(h, l.data_entrega) <= 0) || (l.status === "na_obra" && l.data_coleta && diffDias(h, l.data_coleta) <= 0),
    ).length;
    const orc = dados.locacoes.filter((l) => l.status === "orcamento").length;
    return { "/agenda": agenda, "/locacoes": orc } as Record<string, number>;
  }, [dados.locacoes]);

  if (!authPronto) {
    return (
      <div className="bg-navy-gradient grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }
  if (modo === "nuvem" && !session) return <Login />;
  if (semAcesso) {
    return (
      <div className="bg-navy-gradient grid min-h-dvh place-items-center px-5">
        <div className="max-w-sm rounded-3xl bg-white p-6 text-center shadow-lift">
          <p className="font-display text-lg font-semibold">Acesso ainda não liberado</p>
          <p className="mt-2 text-sm text-ink-600">
            O e-mail <b>{session?.user.email}</b> não está na equipe. Peça para quem administra o app adicionar você em <b>Ajustes → Equipe</b>.
          </p>
          <button onClick={sair} className="mt-5 text-sm font-semibold text-ink-500 hover:text-ink-900">
            Sair
          </button>
        </div>
      </div>
    );
  }
  // Documento para impressão: sem menu.
  if (path.startsWith("/documento")) return <>{children}</>;

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {/* Menu lateral (computador) */}
      <aside className="bg-navy-gradient fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col px-4 py-6 lg:flex">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_40%)]" />
        <Link href="/" className="relative px-2">
          <Logo />
        </Link>
        <nav className="relative mt-9 flex flex-col gap-1">
          {NAV.map((n) => {
            const on = ativo(path, n.href);
            const b = badges[n.href];
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "group flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition",
                  on ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]" : "text-ink-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <n.icon className={cx("h-[18px] w-[18px]", on ? "text-brand-400" : "text-ink-400 group-hover:text-ink-200")} />
                {n.label}
                {b ? <span className="ml-auto rounded-full bg-brand-400 px-2 py-0.5 text-[11px] font-bold text-ink-950">{b}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto space-y-3">
          <div className="rounded-xl bg-white/5 p-3 text-[12px] text-ink-300 ring-1 ring-white/10">
            <div className="flex items-center gap-2 font-semibold text-white">
              {modo === "nuvem" ? <Cloud className="h-4 w-4 text-brand-400" /> : <HardDrive className="h-4 w-4 text-amber-300" />}
              {modo === "nuvem" ? "Sincronizado na nuvem" : "Modo demonstração"}
            </div>
            <p className="mt-1 leading-snug text-ink-400">
              {modo === "nuvem" ? session?.user.email : "Dados salvos só neste navegador. Veja Ajustes para ativar a nuvem."}
            </p>
          </div>
          {modo === "nuvem" && (
            <button onClick={sair} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-400 hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          )}
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="bg-navy-gradient sticky top-0 z-30 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
        <Link href="/">
          <Logo />
        </Link>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-brand-400" />}
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">{children}</main>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => {
            const on = ativo(path, n.href);
            const b = badges[n.href];
            return (
              <Link key={n.href} href={n.href} className={cx("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", on ? "text-ink-950" : "text-ink-400")}>
                <span className={cx("grid h-8 w-12 place-items-center rounded-full transition", on && "bg-brand-100")}>
                  <n.icon className={cx("h-5 w-5", on && "text-brand-700")} />
                </span>
                {n.label}
                {b ? <span className="absolute top-1.5 right-[calc(50%-22px)] rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{b}</span> : null}
              </Link>
            );
          })}
          <button onClick={() => setMais(true)} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", ["/financeiro", "/clientes", "/ajustes"].some((h) => path.startsWith(h)) ? "text-ink-950" : "text-ink-400")}>
            <span className="grid h-8 w-12 place-items-center rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </span>
            Mais
          </button>
        </div>
      </nav>

      <Modal open={mais} onClose={() => setMais(false)} title="Mais opções">
        <div className="grid gap-2">
          {NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMais(false)} className="flex h-14 items-center gap-3 rounded-2xl bg-ink-50 px-4 font-semibold text-ink-800 ring-1 ring-ink-200">
              <n.icon className="h-5 w-5 text-brand-600" /> {n.label}
            </Link>
          ))}
          {modo === "nuvem" && (
            <button onClick={sair} className="flex h-14 items-center gap-3 rounded-2xl px-4 font-semibold text-ink-500">
              <LogOut className="h-5 w-5" /> Sair
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
