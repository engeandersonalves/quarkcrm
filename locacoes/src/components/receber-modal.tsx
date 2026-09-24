"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDados } from "@/lib/store";
import { FORMAS_PAGAMENTO } from "@/lib/defaults";
import { hoje, uid } from "@/lib/format";
import { brl } from "@/lib/pricing";
import type { Lancamento } from "@/lib/types";
import { Button, Field, Input, Modal, MoneyInput } from "./ui";

/** Dar baixa em uma cobrança. Recebimento parcial gera um novo lançamento com o restante. */
export function ReceberModal({ lanc, onClose }: { lanc: Lancamento | null; onClose: () => void }) {
  const { salvarLancamento } = useDados();
  const [valor, setValor] = useState(0);
  const [forma, setForma] = useState("PIX");
  const [data, setData] = useState(hoje());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lanc) {
      setValor(lanc.valor);
      setForma(lanc.forma || "PIX");
      setData(hoje());
    }
  }, [lanc]);

  if (!lanc) return null;
  const entrada = lanc.tipo === "entrada";

  async function confirmar() {
    if (!lanc) return;
    if (valor <= 0) return toast.error("Informe o valor");
    setBusy(true);
    try {
      const resto = Math.round((lanc.valor - valor) * 100) / 100;
      await salvarLancamento({ ...lanc, valor: Math.min(valor, lanc.valor), pago: true, pago_em: data, forma });
      if (resto > 0.009) {
        await salvarLancamento({ ...lanc, id: uid(), valor: resto, pago: false, pago_em: null, descricao: `${lanc.descricao} (restante)`, criado_em: new Date().toISOString() });
      }
      toast.success(entrada ? `Recebido ${brl(Math.min(valor, lanc.valor))}` : "Pagamento registrado");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={entrada ? "Registrar recebimento" : "Registrar pagamento"}
      subtitle={`${lanc.descricao} — ${brl(lanc.valor)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="brand" loading={busy} onClick={confirmar}>
            Confirmar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor" hint={valor < lanc.valor ? `Fica em aberto: ${brl(lanc.valor - valor)}` : undefined}>
          <MoneyInput value={valor} onChange={setValor} autoFocus />
        </Field>
        <Field label="Data">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Forma" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {FORMAS_PAGAMENTO.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForma(f)}
                className={`h-9 rounded-full px-4 text-[13px] font-semibold ring-1 transition ${forma === f ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
