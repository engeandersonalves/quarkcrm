"use client";

import { useState } from "react";
import { toast } from "sonner";
import { confirmar } from "./dialogo";
import { EnderecoForm } from "./endereco-form";
import { Button, Field, Input, Modal, Textarea } from "./ui";
import { useDados } from "@/lib/store";
import { fmtDocumento, fmtTelefone } from "@/lib/format";
import type { Cliente } from "@/lib/types";

/** Cadastro do cliente (novo ou edição). */
export function EditarCliente({ cliente, onClose, onExcluido }: { cliente: Cliente; onClose: () => void; onExcluido?: () => void }) {
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
                onExcluido?.();
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
      </div>
    </Modal>
  );
}

