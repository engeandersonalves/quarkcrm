"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button, cx, Modal } from "./ui";

export interface OpcoesConfirmar {
  titulo: string;
  texto?: string;
  ok?: string;
  cancelar?: string;
  /** Ação destrutiva: botão vermelho. */
  perigo?: boolean;
}

type Pedido = OpcoesConfirmar & { responder: (v: boolean) => void };
let abrir: ((p: Pedido) => void) | null = null;

/** Pergunta com a cara do app (no lugar do confirm() do navegador). */
export function confirmar(o: OpcoesConfirmar): Promise<boolean> {
  return new Promise((responder) => {
    if (!abrir) return responder(window.confirm([o.titulo, o.texto].filter(Boolean).join("\n\n")));
    abrir({ ...o, responder });
  });
}

/** Fica montado uma vez no layout e mostra as perguntas. */
export function Dialogos() {
  const [p, setP] = useState<Pedido | null>(null);
  useEffect(() => {
    abrir = setP;
    return () => {
      abrir = null;
    };
  }, []);
  if (!p) return null;
  const fechar = (v: boolean) => {
    p.responder(v);
    setP(null);
  };
  return (
    <Modal
      open
      onClose={() => fechar(false)}
      title={
        <span className="flex items-center gap-2.5">
          <span className={cx("grid h-9 w-9 place-items-center rounded-xl", p.perigo ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700")}>
            {p.perigo ? <AlertTriangle className="h-[18px] w-[18px]" /> : <HelpCircle className="h-[18px] w-[18px]" />}
          </span>
          {p.titulo}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => fechar(false)}>
            {p.cancelar ?? "Voltar"}
          </Button>
          <Button variant={p.perigo ? "danger" : "primary"} onClick={() => fechar(true)} autoFocus>
            {p.ok ?? "Confirmar"}
          </Button>
        </>
      }
    >
      {p.texto && <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink-600">{p.texto}</p>}
    </Modal>
  );
}
