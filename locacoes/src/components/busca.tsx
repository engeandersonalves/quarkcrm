"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, CalendarClock, ClipboardList, CornerDownLeft, Package, Search, Sparkles, UserRound, Wallet } from "lucide-react";
import { useDados } from "@/lib/store";
import { codigo, fmtTelefone, normalizar } from "@/lib/format";
import { brl } from "@/lib/pricing";
import { STATUS } from "@/lib/status";
import { cx } from "./ui";

interface Resultado {
  id: string;
  grupo: string;
  titulo: string;
  sub?: string;
  href: string;
  icone: React.ReactNode;
  extra?: React.ReactNode;
}

const ATALHOS: Resultado[] = [
  { id: "a1", grupo: "Ir para", titulo: "Novo orçamento", href: "/", icone: <Sparkles className="h-4 w-4" /> },
  { id: "a2", grupo: "Ir para", titulo: "Locações", href: "/locacoes", icone: <ClipboardList className="h-4 w-4" /> },
  { id: "a3", grupo: "Ir para", titulo: "Agenda de entregas e coletas", href: "/agenda", icone: <CalendarClock className="h-4 w-4" /> },
  { id: "a4", grupo: "Ir para", titulo: "Estoque", href: "/estoque", icone: <Boxes className="h-4 w-4" /> },
  { id: "a5", grupo: "Ir para", titulo: "Financeiro", href: "/financeiro", icone: <Wallet className="h-4 w-4" /> },
];

/** Busca global: Ctrl+K (ou /) em qualquer tela. */
export function Busca({ aberta, onClose }: { aberta: boolean; onClose: () => void }) {
  const { dados } = useDados();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberta) {
      setQ("");
      setSel(0);
    }
  }, [aberta]);

  const resultados = useMemo<Resultado[]>(() => {
    const t = normalizar(q.trim());
    if (!t) return ATALHOS;
    const td = q.replace(/\D/g, "");
    const out: Resultado[] = [];
    for (const l of [...dados.locacoes].sort((a, b) => b.numero - a.numero)) {
      const alvo = normalizar(`${l.numero} ${codigo(l.numero)} ${l.cliente_nome} ${l.endereco.bairro} ${l.endereco.logradouro} ${l.itens.map((i) => i.nome).join(" ")}`);
      if (alvo.includes(t) || (td.length >= 4 && l.cliente_telefone.replace(/\D/g, "").includes(td))) {
        out.push({
          id: l.id,
          grupo: "Locações",
          titulo: `${codigo(l.numero)} · ${l.cliente_nome || "Cliente sem nome"}`,
          sub: [l.endereco.bairro, brl(l.valor_total)].filter(Boolean).join(" · "),
          href: `/locacoes/${l.id}`,
          icone: <ClipboardList className="h-4 w-4" />,
          extra: <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset", STATUS[l.status].cor)}>{STATUS[l.status].curto}</span>,
        });
      }
      if (out.length >= 6) break;
    }
    for (const c of dados.clientes) {
      if (normalizar(`${c.nome} ${c.documento} ${c.endereco.bairro}`).includes(t) || (td.length >= 4 && c.telefone.replace(/\D/g, "").includes(td))) {
        out.push({ id: c.id, grupo: "Clientes", titulo: c.nome, sub: [fmtTelefone(c.telefone), c.endereco.bairro].filter(Boolean).join(" · "), href: `/clientes?id=${c.id}`, icone: <UserRound className="h-4 w-4" /> });
      }
      if (out.filter((x) => x.grupo === "Clientes").length >= 5) break;
    }
    for (const e of dados.equipamentos) {
      if (normalizar(`${e.nome} ${e.categoria}`).includes(t)) {
        out.push({ id: e.id, grupo: "Equipamentos", titulo: e.nome, sub: `${brl(e.preco_mensal)}/mês`, href: `/estoque?id=${e.id}`, icone: <Package className="h-4 w-4" /> });
      }
    }
    return [...out, ...ATALHOS.filter((a) => normalizar(a.titulo).includes(t))];
  }, [q, dados]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!aberta) return null;

  const ir = (r?: Resultado) => {
    if (!r) return;
    onClose();
    router.push(r.href);
    // Se a tela já estiver aberta, ela não recarrega: avisa para abrir o item.
    const id = r.href.split("?id=")[1];
    if (id) setTimeout(() => window.dispatchEvent(new CustomEvent("quark:abrir", { detail: id })), 50);
  };

  let ultimoGrupo = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-fade-up relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink-200">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4">
          <Search className="h-5 w-5 shrink-0 text-ink-400" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(resultados.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                ir(resultados[sel]);
              } else if (e.key === "Escape") onClose();
            }}
            placeholder="Buscar cliente, nº da locação, bairro, telefone…"
            className="h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-ink-400"
          />
          <kbd className="hidden rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500 sm:block">Esc</kbd>
        </div>
        <div ref={lista} className="max-h-[60vh] overflow-y-auto p-2">
          {resultados.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-500">Nada encontrado para “{q}”.</p>}
          {resultados.map((r, i) => {
            const cabecalho = r.grupo !== ultimoGrupo ? r.grupo : null;
            ultimoGrupo = r.grupo;
            return (
              <div key={`${r.grupo}-${r.id}`}>
                {cabecalho && <p className="px-3 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.14em] text-ink-400 uppercase">{cabecalho}</p>}
                <button
                  data-i={i}
                  onMouseMove={() => setSel(i)}
                  onClick={() => ir(r)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", sel === i ? "bg-ink-900 text-white" : "text-ink-800")}
                >
                  <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", sel === i ? "bg-white/10 text-brand-300" : "bg-ink-100 text-ink-500")}>{r.icone}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{r.titulo}</span>
                    {r.sub && <span className={cx("block truncate text-[12px]", sel === i ? "text-ink-300" : "text-ink-500")}>{r.sub}</span>}
                  </span>
                  {r.extra}
                  {sel === i && <CornerDownLeft className="hidden h-4 w-4 text-ink-400 sm:block" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
