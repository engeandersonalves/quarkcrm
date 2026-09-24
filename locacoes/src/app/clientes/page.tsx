"use client";

import { confirmar } from "@/components/dialogo";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAbrirItem } from "@/lib/abrir";
import { toast } from "sonner";
import { MapPin, MessageCircle, Phone, Plus, Search, Sparkles, Users } from "lucide-react";
import { EnderecoForm } from "@/components/endereco-form";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea, ButtonLink } from "@/components/ui";
import { useDados } from "@/lib/store";
import { fmtData, fmtDocumento, fmtTelefone, linhaEndereco, linkWhatsApp, normalizar, codigo } from "@/lib/format";
import { novoCliente } from "@/lib/novo";
import { brl } from "@/lib/pricing";
import { saldoLocacao, STATUS } from "@/lib/status";
import type { Cliente } from "@/lib/types";

function EditarCliente({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const { dados, salvarCliente, excluirCliente } = useDados();
  const [c, setC] = useState(cliente);
  const set = (p: Partial<Cliente>) => setC((x) => ({ ...x, ...p }));
  const locs = dados.locacoes.filter((l) => l.cliente_id === c.id).sort((a, b) => b.numero - a.numero);
  const existe = dados.clientes.some((x) => x.id === c.id);

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={existe ? c.nome || "Cliente" : "Novo cliente"}
      footer={
        <>
          {existe && locs.length === 0 && (
            <Button
              variant="ghost"
              className="mr-auto text-rose-600 hover:bg-rose-50"
              onClick={async () => {
                if (!(await confirmar({ titulo: `Excluir ${c.nome || "este cliente"}?`, texto: "O cadastro some da lista de clientes.", ok: "Excluir", perigo: true }))) return;
                await excluirCliente(c.id);
                onClose();
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            onClick={async () => {
              if (!c.nome.trim()) return toast.error("Informe o nome");
              await salvarCliente({ ...c, nome: c.nome.trim() });
              toast.success("Cliente salvo");
              onClose();
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Nome completo" className="sm:col-span-6">
          <Input autoFocus={!existe} value={c.nome} onChange={(e) => set({ nome: e.target.value })} />
        </Field>
        <Field label="WhatsApp" className="sm:col-span-2">
          <Input inputMode="tel" value={c.telefone} onChange={(e) => set({ telefone: e.target.value })} onBlur={(e) => set({ telefone: fmtTelefone(e.target.value) })} />
        </Field>
        <Field label="CPF / CNPJ" className="sm:col-span-2">
          <Input value={c.documento} onChange={(e) => set({ documento: e.target.value })} onBlur={(e) => set({ documento: fmtDocumento(e.target.value) })} />
        </Field>
        <Field label="E-mail" className="sm:col-span-2">
          <Input type="email" value={c.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <div className="sm:col-span-6">
          <p className="mb-2 text-[13px] font-semibold text-ink-700">Endereço</p>
          <EnderecoForm value={c.endereco} onChange={(endereco) => set({ endereco })} />
        </div>
        <Field label="Observações" className="sm:col-span-6">
          <Textarea className="min-h-[60px]" value={c.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Ex.: paga sempre no PIX, obra grande em andamento…" />
        </Field>
        {locs.length > 0 && (
          <div className="sm:col-span-6">
            <p className="mb-2 text-[13px] font-semibold text-ink-700">Locações ({locs.length})</p>
            <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
              {locs.map((l) => (
                <li key={l.id}>
                  <Link href={`/locacoes/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50">
                    <span className="font-mono text-xs text-ink-400">{codigo(l.numero)}</span>
                    <Badge className={STATUS[l.status].cor} dot={STATUS[l.status].ponto}>
                      {STATUS[l.status].curto}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-ink-600">{l.endereco.bairro}</span>
                    <span className="text-xs text-ink-500">{fmtData(l.data_entrega)}</span>
                    <span className="tnum font-semibold">{brl(l.valor_total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Clientes() {
  const { dados, carregando } = useDados();
  const [q, setQ] = useState("");
  const [editar, setEditar] = useState<Cliente | null>(null);
  useAbrirItem(
    useCallback(
      (id: string) => {
        const c = dados.clientes.find((x) => x.id === id);
        if (c) setEditar(c);
        return Boolean(c);
      },
      [dados.clientes],
    ),
  );

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
          {lista.map(({ c, qtd, total, aberto, ativas }) => (
            <Card key={c.id} className="flex flex-col p-4 transition hover:shadow-lift">
              <button className="flex items-start gap-3 text-left" onClick={() => setEditar(c)}>
                <Avatar name={c.nome} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-950">{c.nome}</p>
                  <p className="text-[12.5px] text-ink-500">{fmtTelefone(c.telefone) || "sem telefone"}</p>
                  {linhaEndereco(c.endereco, false) && (
                    <p className="mt-1 flex items-start gap-1 text-[12.5px] text-ink-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{linhaEndereco(c.endereco, false)}</span>
                    </p>
                  )}
                </div>
                {ativas > 0 && <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{ativas} ativa{ativas > 1 && "s"}</Badge>}
              </button>
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
