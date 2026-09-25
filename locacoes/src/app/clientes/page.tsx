"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, MapPin, MessageCircle, Phone, Plus, Search, Sparkles, Users } from "lucide-react";
import { EditarCliente } from "@/components/editar-cliente";
import { Avatar, Badge, Button, ButtonLink, Card, Empty, Input, PageHeader } from "@/components/ui";
import { useDados } from "@/lib/store";
import { fmtData, fmtTelefone, linhaEndereco, linkWhatsApp, normalizar } from "@/lib/format";
import { novoCliente } from "@/lib/novo";
import { brl } from "@/lib/pricing";
import { saldoLocacao } from "@/lib/status";
import type { Cliente } from "@/lib/types";

export default function Clientes() {
  const { dados, carregando } = useDados();
  const [q, setQ] = useState("");
  const [editar, setEditar] = useState<Cliente | null>(null);

  const lista = useMemo(() => {
    const t = normalizar(q);
    return dados.clientes
      .filter((c) => !t || normalizar(`${c.nome} ${c.telefone} ${c.documento} ${c.endereco.bairro}`).includes(t))
      .map((c) => {
        const locs = dados.locacoes.filter((l) => l.cliente_id === c.id);
        const fechadas = locs.filter((l) => l.status !== "orcamento" && l.status !== "recusada");
        const aberto = fechadas.reduce((s, l) => s + saldoLocacao(l, dados.lancamentos).aberto, 0);
        return {
          c,
          qtd: fechadas.length,
          total: fechadas.reduce((s, l) => s + l.valor_total, 0),
          aberto,
          ativas: locs.filter((l) => l.status === "na_obra" || l.status === "agendada").length,
          ultima: locs.reduce((m, l) => (l.criado_em > m ? l.criado_em : m), ""),
        };
      })
      .sort((a, b) => b.ultima.localeCompare(a.ultima) || a.c.nome.localeCompare(b.c.nome));
  }, [dados, q]);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${dados.clientes.length} cadastrados — criados automaticamente a cada orçamento.`}
        actions={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefone, bairro…" className="pl-9" />
            </div>
            <Button variant="brand" onClick={() => setEditar(novoCliente())}>
              <Plus className="h-4 w-4" /> Cliente
            </Button>
          </>
        }
      />
      {!carregando && lista.length === 0 ? (
        <Card>
          <Empty icon={<Users className="h-6 w-6" />} title={q ? "Ninguém encontrado" : "Nenhum cliente ainda"} text="Os clientes são salvos automaticamente quando você faz um orçamento." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map(({ c, qtd, total, aberto, ativas, ultima }) => (
            <Card key={c.id} className="flex flex-col p-4 transition hover:shadow-lift">
              <Link href={`/clientes/${c.id}`} className="group flex items-start gap-3 text-left">
                <Avatar name={c.nome} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-950">{c.nome}</p>
                  <p className="text-[12.5px] text-ink-500">
                    {fmtTelefone(c.telefone) || "sem telefone"}
                    {ultima && <span className="text-ink-400"> · última {fmtData(ultima.slice(0, 10))}</span>}
                  </p>
                  {linhaEndereco(c.endereco, false) && (
                    <p className="mt-1 flex items-start gap-1 text-[12.5px] text-ink-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{linhaEndereco(c.endereco, false)}</span>
                    </p>
                  )}
                </div>
                {ativas > 0 && <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{ativas} ativa{ativas > 1 && "s"}</Badge>}
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-600" />
              </Link>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-ink-50 py-2">
                  <p className="tnum text-[15px] font-bold">{qtd}</p>
                  <p className="text-[10.5px] text-ink-500">locações</p>
                </div>
                <div className="rounded-xl bg-ink-50 py-2">
                  <p className="tnum text-[13px] font-bold">{brl(total)}</p>
                  <p className="text-[10.5px] text-ink-500">total</p>
                </div>
                <div className="rounded-xl bg-ink-50 py-2">
                  <p className={`tnum text-[13px] font-bold ${aberto > 0 ? "text-amber-700" : "text-ink-400"}`}>{brl(aberto)}</p>
                  <p className="text-[10.5px] text-ink-500">em aberto</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <ButtonLink href={`/?cliente=${c.id}`} size="sm" variant="secondary" className="flex-1">
                    <Sparkles className="h-3.5 w-3.5" /> Novo orçamento
                  </ButtonLink>
                {c.telefone && (
                  <>
                    <ButtonLink href={`tel:${c.telefone.replace(/\D/g, "")}`} size="sm" variant="secondary" aria-label="Ligar">
                        <Phone className="h-3.5 w-3.5" />
                      </ButtonLink>
                    <ButtonLink href={linkWhatsApp(c.telefone, `Olá, ${c.nome.split(" ")[0]}! Aqui é da ${dados.config.empresa_nome}.`)} target="_blank" size="sm" variant="secondary" aria-label="WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </ButtonLink>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editar && <EditarCliente cliente={editar} onClose={() => setEditar(null)} />}
    </>
  );
}
