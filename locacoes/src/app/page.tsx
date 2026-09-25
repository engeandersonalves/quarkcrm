"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowUpRight, FileClock, PackageCheck, Truck } from "lucide-react";
import { Orcamento } from "@/components/orcamento";
import { cx } from "@/components/ui";
import { useDados } from "@/lib/store";
import { diffDias, hoje } from "@/lib/format";

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Resumo() {
  const { dados } = useDados();
  const r = useMemo(() => {
    const h = hoje();
    const ls = dados.locacoes;
    return {
      entregas: ls.filter((l) => l.status === "agendada" && l.data_entrega && diffDias(h, l.data_entrega) <= 0).length,
      coletas: ls.filter((l) => l.status === "na_obra" && l.data_coleta === h).length,
      vencidas: ls.filter((l) => l.status === "na_obra" && l.data_coleta && diffDias(h, l.data_coleta) < 0).length,
      orcamentos: ls.filter((l) => l.status === "orcamento").length,
    };
  }, [dados.locacoes]);
  const chips = [
    { href: "/agenda", label: "Entregas hoje", v: r.entregas, icon: Truck, alerta: false },
    { href: "/agenda", label: "Coletas hoje", v: r.coletas, icon: PackageCheck, alerta: false },
    { href: "/agenda", label: "Vencidas", v: r.vencidas, icon: AlertTriangle, alerta: r.vencidas > 0 },
    { href: "/locacoes", label: "Orçamentos abertos", v: r.orcamentos, icon: FileClock, alerta: false },
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
      {chips.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={cx(
            "group flex min-w-[150px] items-center gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink-200/70 transition hover:ring-ink-300",
            c.alerta && "bg-rose-50 ring-rose-200",
          )}
        >
          <span className={cx("grid h-9 w-9 place-items-center rounded-xl", c.alerta ? "bg-rose-600 text-white" : "bg-ink-100 text-ink-600")}>
            <c.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="tnum block font-display text-xl leading-none font-semibold">{c.v}</span>
            <span className="text-[12px] whitespace-nowrap text-ink-500">{c.label}</span>
          </span>
          <ArrowUpRight className="ml-auto h-4 w-4 text-ink-300 group-hover:text-ink-600" />
        </Link>
      ))}
    </div>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const editar = params.get("editar");
  return (
    <>
      <div className="mb-6 flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-brand-700">{saudacao()} 👷</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-[30px]">{editar ? "Editar orçamento" : "Orçamento rápido"}</h1>
        </div>
        {!editar && <Resumo />}
      </div>
      <Orcamento editarId={editar} clienteId={params.get("cliente")} />
    </>
  );
}

export default function Home() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
