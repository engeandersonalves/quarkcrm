"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Boxes, CalendarClock, Check, ClipboardList, CloudOff, CloudUpload, HardDrive, Loader2, LogOut, MoreHorizontal, Search, Settings, Sparkles, Users, Wallet } from "lucide-react";
import { useDados } from "@/lib/store";
import { diffDias, hoje } from "@/lib/format";
import { Busca } from "./busca";
import { Login, NovaSenha } from "./login";
import { Logo } from "./logo";
import { Button, cx, Modal, Skeleton } from "./ui";

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

/** "Tudo salvo" / "Salvando…" / "Sem internet": a pessoa sempre sabe se o que fez já está na nuvem. */
function IndicadorSync({ escuro, compacto }: { escuro?: boolean; compacto?: boolean }) {
  const { modo, sync } = useDados();
  if (modo === "local")
    return (
      <Link href="/ajustes" className={cx("inline-flex items-center gap-1.5 text-[12px] font-semibold", escuro ? "text-amber-300" : "text-amber-700")} title="Dados só neste navegador — toque para conectar a nuvem">
        <HardDrive className="h-4 w-4" />
        {!compacto && "Só neste aparelho"}
      </Link>
    );
  const cfg = {
    ok: { icon: <Check className="h-4 w-4" />, texto: "Tudo salvo", cor: escuro ? "text-brand-300" : "text-brand-700" },
    salvando: { icon: <Loader2 className="h-4 w-4 animate-spin" />, texto: `Salvando${sync.pendentes > 1 ? ` ${sync.pendentes}` : ""}…`, cor: escuro ? "text-ink-200" : "text-ink-600" },
    offline: { icon: <CloudOff className="h-4 w-4" />, texto: `Sem internet · ${sync.pendentes} aguardando`, cor: escuro ? "text-amber-300" : "text-amber-700" },
  }[sync.estado];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[12px] font-semibold", cfg.cor)} title={sync.estado === "offline" ? "As alterações ficam guardadas e são enviadas sozinhas quando a internet voltar." : undefined} aria-live="polite">
      {cfg.icon}
      {(!compacto || sync.estado !== "ok") && cfg.texto}
    </span>
  );
}

/** Dados do modo demonstração neste aparelho: oferece levar para a nuvem. */
function Migracao() {
  const { migracao, migrar, dispensarMigracao } = useDados();
  const [busy, setBusy] = useState(false);
  if (!migracao) return null;
  return (
    <Modal
      open
      onClose={dispensarMigracao}
      title="Levar os dados deste aparelho para a nuvem?"
      subtitle="Encontramos dados do modo demonstração salvos aqui."
      footer={
        <>
          <Button variant="ghost" onClick={dispensarMigracao}>
            Não, deixar aqui
          </Button>
          <Button
            variant="brand"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await migrar();
              setBusy(false);
            }}
          >
            <CloudUpload className="h-4 w-4" /> Enviar para a nuvem
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["locações", migracao.locacoes.length],
          ["clientes", migracao.clientes.length],
          ["lançamentos", migracao.lancamentos.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-ink-50 py-3 ring-1 ring-ink-200">
            <p className="tnum font-display text-2xl font-semibold">{v}</p>
            <p className="text-[12px] text-ink-500">{k}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-600">Nada que já está na nuvem é apagado. Clientes e equipamentos repetidos não duplicam, e locações com número já usado ganham o próximo número livre.</p>
    </Modal>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { dados, modo, session, authPronto, semAcesso, carregando, sair } = useDados();
  const [mais, setMais] = useState(false);
  const [busca, setBusca] = useState(false);

  // Ctrl+K / ⌘K / "/" abre a busca em qualquer tela.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = alvo.closest("input, textarea, select, [contenteditable]");
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !digitando)) {
        e.preventDefault();
        setBusca(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Fecha o menu "Mais" ao trocar de tela.
  useEffect(() => setMais(false), [path]);

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
        <div className="flex flex-col items-center gap-5">
          <Logo />
          <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
        </div>
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
            O e-mail <b>{session?.user.email}</b> não está na equipe. Peça para quem administra o app liberar você em <b>Ajustes → Equipe</b>, depois toque em “Tentar de novo”.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="ghost" onClick={sair}>
              Sair
            </Button>
            <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
          </div>
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
        <button
          onClick={() => setBusca(true)}
          className="relative mt-7 flex h-10 items-center gap-2.5 rounded-xl bg-white/5 px-3 text-[13px] text-ink-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-ink-200"
        >
          <Search className="h-4 w-4" /> Buscar
          <kbd className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-300">Ctrl K</kbd>
        </button>
        <nav className="relative mt-4 flex flex-col gap-1">
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
                {b ? (
                  <span className={cx("ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold", n.href === "/agenda" ? "bg-amber-400 text-ink-950" : "bg-white/15 text-white")} title={n.href === "/agenda" ? "Entregas/coletas para hoje ou atrasadas" : "Orçamentos esperando resposta"}>
                    {b}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto space-y-2">
          <div className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
            <IndicadorSync escuro />
            {modo === "nuvem" && <p className="mt-1 truncate text-[11.5px] text-ink-400">{session?.user.email}</p>}
          </div>
          {modo === "nuvem" && (
            <button onClick={sair} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-400 hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          )}
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="bg-navy-gradient sticky top-0 z-30 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
        <Link href="/" className="mr-auto">
          <Logo />
        </Link>
        {carregando ? <Loader2 className="h-4 w-4 animate-spin text-brand-400" /> : <IndicadorSync escuro compacto />}
        <button onClick={() => setBusca(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white" aria-label="Buscar">
          <Search className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
        {carregando && dados.equipamentos.length === 0 && dados.locacoes.length === 0 ? (
          <div className="grid gap-5" aria-busy="true" aria-label="Carregando">
            <Skeleton className="h-9 w-64" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-3xl" />
          </div>
        ) : (
          children
        )}
      </main>

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
                {b ? <span className={cx("absolute top-1.5 right-[calc(50%-22px)] rounded-full px-1.5 text-[10px] font-bold", n.href === "/agenda" ? "bg-amber-400 text-ink-950" : "bg-ink-900 text-white")}>{b}</span> : null}
              </Link>
            );
          })}
          <button onClick={() => setMais(true)} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", ["/financeiro", "/clientes", "/ajustes"].some((h) => path.startsWith(h)) ? "text-ink-950" : "text-ink-400")}>
            <span className={cx("grid h-8 w-12 place-items-center rounded-full", ["/financeiro", "/clientes", "/ajustes"].some((h) => path.startsWith(h)) && "bg-brand-100")}>
              <MoreHorizontal className="h-5 w-5" />
            </span>
            Mais
          </button>
        </div>
      </nav>

      <Modal open={mais} onClose={() => setMais(false)} title="Mais opções">
        <div className="grid gap-2">
          {NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className="flex h-14 items-center gap-3 rounded-2xl bg-ink-50 px-4 font-semibold text-ink-800 ring-1 ring-ink-200">
              <n.icon className="h-5 w-5 text-brand-600" /> {n.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between rounded-2xl px-4 py-2 text-sm">
            <span className="min-w-0">
              <IndicadorSync />
              {modo === "nuvem" && <span className="block truncate text-[12px] text-ink-500">{session?.user.email}</span>}
            </span>
            {modo === "nuvem" && (
              <Button variant="ghost" size="sm" onClick={sair}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Busca aberta={busca} onClose={() => setBusca(false)} />
      <Migracao />
      <NovaSenha />
    </div>
  );
}
