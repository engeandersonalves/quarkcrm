"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Boxes, HardDrive, Wallet, Building2, Check, FileClock, PackageCheck, Truck, Users } from "lucide-react";
import { Orcamento } from "@/components/orcamento";
import { Button, ButtonLink, cx } from "@/components/ui";
import { useDados } from "@/lib/store";
import { codigo, diffDias, hoje } from "@/lib/format";
import { mesclarConfig } from "@/lib/defaults";
import { brl } from "@/lib/pricing";

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
      vencido: dados.lancamentos.filter((x) => x.tipo === "entrada" && !x.pago && x.data < h).reduce((s, x) => s + x.valor, 0),
    };
  }, [dados.locacoes, dados.lancamentos]);
  const chips = [
    { href: "/agenda", label: "Entregar hoje", v: r.entregas, icon: Truck, alerta: false },
    { href: "/agenda", label: "Coletar hoje", v: r.coletas, icon: PackageCheck, alerta: false },
    { href: "/agenda", label: "Vencidas", v: r.vencidas, icon: AlertTriangle, alerta: r.vencidas > 0 },
    { href: "/locacoes", label: "Orçamentos abertos", v: r.orcamentos, icon: FileClock, alerta: false },
    { href: "/financeiro", label: "A receber vencido", v: brl(r.vencido), icon: Wallet, alerta: r.vencido > 0 },
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 xl:grid-cols-5">
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

/** Modo demonstração: lembra que os dados estão só neste aparelho. */
function AvisoDemonstracao() {
  const { modo } = useDados();
  if (modo !== "local") return null;
  return (
    <Link href="/ajustes" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100">
      <HardDrive className="h-5 w-5 shrink-0 text-amber-600" />
      <span className="flex-1">
        <b>Modo demonstração:</b> os dados ficam só neste aparelho. Conecte a nuvem para usar no celular e no computador.
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

/** Primeiro acesso (nuvem vazia): os 3 passos para começar, e some quando termina. */
function PrimeirosPassos() {
  const { dados, carregando, carregarCatalogo } = useDados();
  const empresaOk = JSON.stringify(dados.config) !== JSON.stringify(mesclarConfig(null));
  const estoqueOk = dados.equipamentos.length > 0;
  // Some assim que o estoque existe (é o único passo que impede de orçar).
  if (carregando || estoqueOk) return null;
  const passos = [
    {
      ok: estoqueOk,
      icon: Boxes,
      titulo: "Cadastre o estoque",
      texto: "Comece com os itens do seu termo (andaime 1,5 m, plataforma e betoneira) e ajuste as quantidades.",
      acao: estoqueOk ? null : (
        <Button size="sm" variant="brand" onClick={() => carregarCatalogo()}>
          Carregar catálogo
        </Button>
      ),
    },
    { ok: empresaOk, icon: Building2, titulo: "Confira empresa e PIX", texto: "Dados que saem no orçamento, no termo e no QR Code do PIX.", acao: <ButtonLink href="/ajustes" size="sm" variant="secondary">Abrir ajustes</ButtonLink> },
    { ok: false, icon: Users, titulo: "Libere a equipe", texto: "Em Ajustes → Equipe, adicione o e-mail de quem vai usar o app.", acao: <ButtonLink href="/ajustes" size="sm" variant="secondary">Equipe</ButtonLink> },
  ];
  return (
    <div className="grid gap-3 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-brand-200 sm:p-5">
      <p className="font-display text-[15px] font-semibold">Primeiros passos</p>
      <div className="grid gap-2 md:grid-cols-3">
        {passos.map((p) => (
          <div key={p.titulo} className={cx("flex flex-col gap-2 rounded-2xl p-3.5 ring-1", p.ok ? "bg-brand-50 ring-brand-200" : "bg-ink-50 ring-ink-200")}>
            <div className="flex items-center gap-2">
              <span className={cx("grid h-7 w-7 place-items-center rounded-lg", p.ok ? "bg-brand-500 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200")}>
                {p.ok ? <Check className="h-4 w-4" strokeWidth={3} /> : <p.icon className="h-4 w-4" />}
              </span>
              <p className="text-[13.5px] font-semibold">{p.titulo}</p>
            </div>
            <p className="text-[12.5px] text-ink-600">{p.texto}</p>
            {!p.ok && <div className="mt-auto">{p.acao}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const editar = params.get("editar");
  const { dados, session } = useDados();
  const primeiroNome = (session?.user.user_metadata?.nome as string | undefined)?.trim().split(" ")[0];
  const emEdicao = editar ? dados.locacoes.find((l) => l.id === editar) : null;
  return (
    <>
      <div className="mb-6 flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-brand-700">{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""} 👷</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-[30px]">{emEdicao ? `Editar ${emEdicao.status === "orcamento" ? "orçamento" : "locação"} ${codigo(emEdicao.numero)}` : editar ? "Editar orçamento" : "Orçamento rápido"}</h1>
        </div>
        {!editar && <AvisoDemonstracao />}
        {!editar && <PrimeirosPassos />}
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
